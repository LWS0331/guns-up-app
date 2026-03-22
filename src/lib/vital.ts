import { VitalClient, VitalEnvironment } from '@tryvital/vital-node';

// Junction (formerly Vital) client singleton — lazy initialization
const globalForVital = globalThis as unknown as { vital: VitalClient | undefined };

function createVitalClient(): VitalClient {
  const apiKey = process.env.VITAL_API_KEY;
  if (!apiKey) {
    throw new Error('VITAL_API_KEY environment variable is required');
  }

  const env = process.env.VITAL_ENVIRONMENT === 'production'
    ? VitalEnvironment.Production
    : VitalEnvironment.Sandbox;

  return new VitalClient({ apiKey, environment: env });
}

// Lazy getter — only creates client when first accessed at runtime (not at import/build time)
export function getVitalClient(): VitalClient {
  if (!globalForVital.vital) {
    globalForVital.vital = createVitalClient();
  }
  return globalForVital.vital;
}

// Provider display names and icons for the UI
export const SUPPORTED_PROVIDERS = [
  { slug: 'apple_health_kit', name: 'Apple Health', icon: '🍎', requiresMobile: true },
  { slug: 'whoop_v2', name: 'WHOOP', icon: 'W', requiresMobile: false },
  { slug: 'garmin', name: 'Garmin', icon: 'G', requiresMobile: false },
  { slug: 'fitbit', name: 'Fitbit', icon: 'F', requiresMobile: false },
  { slug: 'oura', name: 'Oura Ring', icon: 'O', requiresMobile: false },
  { slug: 'google_fit', name: 'Google Fit', icon: 'G', requiresMobile: true },
  { slug: 'samsung', name: 'Samsung Health', icon: 'S', requiresMobile: true },
  { slug: 'polar', name: 'Polar', icon: 'P', requiresMobile: false },
  { slug: 'withings', name: 'Withings', icon: 'W', requiresMobile: false },
  { slug: 'peloton', name: 'Peloton', icon: 'P', requiresMobile: false },
] as const;

export type ProviderSlug = typeof SUPPORTED_PROVIDERS[number]['slug'];
