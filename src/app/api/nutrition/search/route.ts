import { NextRequest, NextResponse } from 'next/server';

const USDA_API_KEY = process.env.USDA_API_KEY || 'DEMO_KEY';
const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';

// Nutrient IDs we care about
const NUTRIENT_IDS = {
  calories: 1008,  // Energy (kcal)
  protein: 1003,   // Protein (g)
  fat: 1004,       // Total lipid/fat (g)
  carbs: 1005,     // Carbohydrate (g)
  fiber: 1079,     // Fiber (g)
  sugar: 2000,     // Sugars, total (g)
  sodium: 1093,    // Sodium (mg)
};

interface USDANutrient {
  nutrientId: number;
  nutrientName: string;
  value: number;
  unitName: string;
}

interface USDAFood {
  fdcId: number;
  description: string;
  brandName?: string;
  brandOwner?: string;
  dataType: string;
  foodNutrients: USDANutrient[];
  servingSize?: number;
  servingSizeUnit?: string;
}

function extractMacros(nutrients: USDANutrient[]) {
  const get = (id: number) => {
    const n = nutrients.find(n => n.nutrientId === id);
    return n ? Math.round(n.value) : 0;
  };
  return {
    calories: get(NUTRIENT_IDS.calories),
    protein: get(NUTRIENT_IDS.protein),
    fat: get(NUTRIENT_IDS.fat),
    carbs: get(NUTRIENT_IDS.carbs),
    fiber: get(NUTRIENT_IDS.fiber),
    sugar: get(NUTRIENT_IDS.sugar),
    sodium: get(NUTRIENT_IDS.sodium),
  };
}

export async function GET(req: NextRequest) {
  try {
    const query = req.nextUrl.searchParams.get('q');
    const pageSize = req.nextUrl.searchParams.get('limit') || '10';

    if (!query) {
      return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
    }

    // Encode dataType param properly — spaces in URL were causing 502
    const dataTypes = ['Foundation', 'SR Legacy', 'Survey (FNDDS)'].map(encodeURIComponent).join(',');
    const url = `${USDA_BASE}/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(query)}&pageSize=${pageSize}&dataType=${dataTypes}`;

    // Add timeout to prevent Railway proxy from killing the request
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } catch (fetchErr) {
      clearTimeout(timeout);
      const msg = fetchErr instanceof Error ? fetchErr.message : 'Unknown fetch error';
      // AbortError means timeout
      if (msg.includes('abort')) {
        return NextResponse.json(
          { error: 'USDA API timed out — try a shorter query', timeout: true },
          { status: 504, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      return NextResponse.json({ error: `USDA API unreachable: ${msg}` }, { status: 502 });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      // Rate-limited by DEMO_KEY
      if (response.status === 429) {
        return NextResponse.json(
          { error: 'USDA rate limit hit — set USDA_API_KEY env var for higher limits', rateLimited: true },
          { status: 429, headers: { 'Retry-After': '60' } }
        );
      }
      console.error(`USDA API ${response.status}: ${errBody.substring(0, 200)}`);
      return NextResponse.json({ error: 'USDA API error', status: response.status }, { status: 502 });
    }

    const data = await response.json();
    const foods = (data.foods || []).map((food: USDAFood) => ({
      id: food.fdcId,
      name: food.description,
      brand: food.brandName || food.brandOwner || null,
      dataType: food.dataType,
      servingSize: food.servingSize || 100,
      servingUnit: food.servingSizeUnit || 'g',
      macros: extractMacros(food.foodNutrients),
    }));

    // Cache successful nutrition searches for 1 hour — USDA data doesn't change frequently
    return NextResponse.json(
      { success: true, query, count: foods.length, foods, accuracy: 'usda_verified' },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('USDA search error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
