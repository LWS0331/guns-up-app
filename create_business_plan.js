const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, 
        PageBreak, AlignmentType, WidthType, ShadingType, BorderStyle, HeadingLevel } = require('docx');
const fs = require('fs');

// Table border styling
const lightGrayBorder = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: lightGrayBorder, bottom: lightGrayBorder, left: lightGrayBorder, right: lightGrayBorder };
const lightGrayShading = { fill: "E8E8E8", type: ShadingType.CLEAR };

// Helper function to create a table cell
function createCell(text, width, isHeader = false, bold = false) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: isHeader ? lightGrayShading : { fill: "FFFFFF", type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      children: [new TextRun({
        text: text,
        bold: isHeader || bold,
        font: "Arial",
        size: 22
      })],
      alignment: AlignmentType.CENTER
    })]
  });
}

// Helper function to create a pricing table row
function createPricingRow(tier, codename, model, monthly, annual, apiCost, stripeFee, infra, trainerShare, platformRev, margin, isHeader = false) {
  const width = 9360;
  const colWidth = 936; // 9360 / 10 columns
  
  const cells = [
    createCell(tier, colWidth, isHeader, isHeader),
    createCell(codename, colWidth, isHeader, isHeader),
    createCell(model, colWidth, isHeader, isHeader),
    createCell(monthly, colWidth, isHeader, isHeader),
    createCell(annual, colWidth, isHeader, isHeader),
    createCell(apiCost, colWidth, isHeader, isHeader),
    createCell(stripeFee, colWidth, isHeader, isHeader),
    createCell(infra, colWidth, isHeader, isHeader),
    createCell(trainerShare, colWidth, isHeader, isHeader),
    createCell(platformRev, colWidth, isHeader, isHeader),
  ];

  // Add margin column
  cells.push(createCell(margin, colWidth, isHeader, isHeader));
  
  return new TableRow({ children: cells });
}

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: "Arial", size: 24 }
      }
    },
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 32, bold: true, font: "Arial" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0 }
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 28, bold: true, font: "Arial" },
        paragraph: { spacing: { before: 180, after: 120 }, outlineLevel: 1 }
      }
    ]
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0,
            format: "bullet",
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } }
          }
        ]
      }
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    children: [
      // ===== TITLE PAGE =====
      new Paragraph({
        children: [new TextRun({ text: "", font: "Arial", size: 24 })],
        spacing: { before: 800 }
      }),
      new Paragraph({
        children: [new TextRun({
          text: "GUNS UP FITNESS",
          bold: true,
          font: "Arial",
          size: 48
        })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 }
      }),
      new Paragraph({
        children: [new TextRun({
          text: "App Feature & Pricing Update",
          font: "Arial",
          size: 32
        })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      }),
      new Paragraph({
        children: [new TextRun({
          text: "Business Plan Supplement v3.1",
          bold: true,
          font: "Arial",
          size: 28
        })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 }
      }),
      new Paragraph({
        children: [new TextRun({
          text: "March 2026",
          font: "Arial",
          size: 26
        })],
        alignment: AlignmentType.CENTER
      }),
      new Paragraph({ children: [new PageBreak()] }),

      // ===== SECTION 1: PRICING & MARGIN ANALYSIS =====
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("SECTION 1: UPDATED TIER PRICING & MARGIN ANALYSIS")]
      }),
      new Paragraph({
        children: [new TextRun({
          text: "Corrected pricing reflecting actual API costs with prompt caching implementation. API costs reduced 90%+ from v3.0 estimates.",
          font: "Arial",
          size: 22
        })],
        spacing: { after: 240 }
      }),

      // Pricing Table
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [936, 936, 936, 936, 936, 936, 936, 936, 936, 936],
        rows: [
          createPricingRow("Tier", "Codename", "AI Model", "Monthly", "Annual", "API Cost", "Stripe Fee", "Infra", "Trainer Share", "Platform Rev", true),
          createPricingRow("Haiku", "RECON", "claude-haiku-4-5", "$2.00", "$1.67/mo", "$0.07", "$0.36", "$0.10", "$0.50", "$0.97", "48.5%"),
          createPricingRow("Sonnet", "OPERATOR", "claude-sonnet-4-6", "$5.00", "$4.17/mo", "$0.34", "$0.45", "$0.10", "$1.50", "$2.61", "52.2%"),
          createPricingRow("Opus", "COMMANDER", "claude-opus-4-6", "$15.00", "$12.50/mo", "$0.56", "$0.74", "$0.10", "$3.00", "$10.60", "70.7%"),
          createPricingRow("Opus", "WARFIGHTER", "claude-opus-4-6", "$49.99", "$41.58/mo", "$0.56", "$1.75", "$0.10", "$20.00", "$27.58", "55.2%"),
        ]
      }),

      new Paragraph({
        children: [new TextRun({
          text: "Key Change: API costs dropped 90%+ due to prompt caching. RECON margin improved from negative to 48.5%.",
          font: "Arial",
          size: 22,
          italic: true
        })],
        spacing: { before: 200, after: 400 }
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // ===== SECTION 2: REVENUE PROJECTIONS =====
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("SECTION 2: REVENUE PROJECTIONS (Per 100 Users)")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("Conservative (Beta)")]
      }),
      new Paragraph({
        children: [new TextRun({
          text: "60 RECON, 25 OPERATOR, 12 COMMANDER, 3 WARFIGHTER",
          font: "Arial",
          size: 22,
          bold: true
        })],
        spacing: { after: 80 }
      }),
      new Paragraph({
        children: [new TextRun({
          text: "Monthly: $520  |  Annual: $6,240",
          font: "Arial",
          size: 22
        })],
        spacing: { after: 240 }
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("Growth Scenario")]
      }),
      new Paragraph({
        children: [new TextRun({
          text: "40 RECON, 30 OPERATOR, 20 COMMANDER, 10 WARFIGHTER",
          font: "Arial",
          size: 22,
          bold: true
        })],
        spacing: { after: 80 }
      }),
      new Paragraph({
        children: [new TextRun({
          text: "Monthly: $780  |  Annual: $9,360",
          font: "Arial",
          size: 22
        })],
        spacing: { after: 240 }
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("Mature Market")]
      }),
      new Paragraph({
        children: [new TextRun({
          text: "25 RECON, 30 OPERATOR, 30 COMMANDER, 15 WARFIGHTER",
          font: "Arial",
          size: 22,
          bold: true
        })],
        spacing: { after: 80 }
      }),
      new Paragraph({
        children: [new TextRun({
          text: "Monthly: $1,100  |  Annual: $13,200",
          font: "Arial",
          size: 22
        })],
        spacing: { after: 240 }
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("Premium Mix")]
      }),
      new Paragraph({
        children: [new TextRun({
          text: "15 RECON, 25 OPERATOR, 35 COMMANDER, 25 WARFIGHTER",
          font: "Arial",
          size: 22,
          bold: true
        })],
        spacing: { after: 80 }
      }),
      new Paragraph({
        children: [new TextRun({
          text: "Monthly: $1,630  |  Annual: $19,560",
          font: "Arial",
          size: 22
        })],
        spacing: { after: 400 }
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // ===== SECTION 3: COMPLETE FEATURE INVENTORY =====
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("SECTION 3: COMPLETE FEATURE INVENTORY (50 Features)")]
      }),

      // AI & GUNNY
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("AI & GUNNY (5 Features)")]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Gunny AI Chat (military persona, context-aware) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", All tiers",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "AI Workout Generation (periodized programs from intake) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", All tiers",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "AI Macro Estimation (natural language meal logging) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", All tiers",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "16-Expert Knowledge Base (Filly, Galpin, Huberman, Norton, etc.) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", All tiers",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Voice Input (Web Speech API, talk to Gunny during workouts) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", All tiers",
          font: "Arial",
          size: 22
        })],
        spacing: { after: 240 }
      }),

      // WORKOUT ENGINE
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("WORKOUT ENGINE (6 Features)")]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Weekly Workout Planner (calendar with month/week/day views) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", All tiers",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Workout Execution Mode (live set logging, RPE, PR detection) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", All tiers",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Exercise Library (214 exercises, 12 categories, video demos) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", All tiers",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Superset/Circuit Linking — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", All tiers",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Warm-up & Cooldown Sections — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", All tiers",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Day Tags (color coding on calendar) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", All tiers",
          font: "Arial",
          size: 22
        })],
        spacing: { after: 240 }
      }),

      // NUTRITION
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("NUTRITION (4 Features)")]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Macro Targets Dashboard (daily rings) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", All tiers",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Food Database (200+ items, 13 categories) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", All tiers",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Meal Logging (manual + AI) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", All tiers",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Nutrition Charts (14-day trend) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", OPERATOR+",
          font: "Arial",
          size: 22
        })],
        spacing: { after: 240 }
      }),

      // TRACKING & ANALYTICS
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("TRACKING & ANALYTICS (6 Features)")]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "PR Board with Phase Lines (milestone visualization) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", All tiers",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Volume Tracking (30-day area chart) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", OPERATOR+",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Strength Progression (per exercise line chart) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", OPERATOR+",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Workout Frequency (12-week bar chart) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", OPERATOR+",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Body Composition Tracking (weight + body fat) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", OPERATOR+",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Injury Tracker (active/recovering/cleared) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", All tiers",
          font: "Arial",
          size: 22
        })],
        spacing: { after: 240 }
      }),

      // GAMIFICATION & SOCIAL
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("GAMIFICATION & SOCIAL (4 Features)")]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Achievement Badge System (22 badges, 4 tiers, XP leveling) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", All tiers",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Leaderboard (team + global, points system) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", All tiers",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Social Activity Feed (real-time, team filter) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", All tiers",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Streak Tracking (with bonuses) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", All tiers",
          font: "Arial",
          size: 22
        })],
        spacing: { after: 240 }
      }),

      // WEARABLE INTEGRATION
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("WEARABLE INTEGRATION (3 Features)")]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Wearable Connection (Oura, Whoop, Garmin, Fitbit via Vital) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", COMMANDER+",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Live HR Zone Tracking — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", COMMANDER+",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Sleep & Recovery Metrics (HRV, readiness) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", COMMANDER+",
          font: "Arial",
          size: 22
        })],
        spacing: { after: 240 }
      }),

      // TRAINER TOOLS
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("TRAINER TOOLS (5 Features)")]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Multi-Client Dashboard (OPS CENTER) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", Trainer",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Trainer Notes → Gunny Personality — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", Trainer",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Client Intake Management — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", Trainer",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Team System — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", Trainer",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Trainer Rank System (5 ranks, revenue share bonuses) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", Trainer",
          font: "Arial",
          size: 22
        })],
        spacing: { after: 240 }
      }),

      // BILLING & BUSINESS
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("BILLING & BUSINESS (6 Features)")]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Stripe Checkout — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", Platform",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Stripe Webhooks — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", Platform",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Customer Billing Portal — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", Platform",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Subscription Tier Changes (proration) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", Platform",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Beta User Management (45-day trials) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", Platform",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Promo System — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", Platform",
          font: "Arial",
          size: 22
        })],
        spacing: { after: 240 }
      }),

      // PLATFORM
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("PLATFORM (5 Features)")]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Push Notifications (streak warnings, PR alerts) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "BUILT",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", All tiers",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Beta Feedback System (auto-categorization, critical alerts) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", Beta users",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "PWA (installable, offline-capable) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", All tiers",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "PostgreSQL + Prisma — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", Platform",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Railway Auto-Deploy — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "LIVE",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", Platform",
          font: "Arial",
          size: 22
        })],
        spacing: { after: 240 }
      }),

      // PLANNED
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("PLANNED (3 Features)")]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Custom Exercise Video Upload — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "PLANNED",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: " (~1 month)",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "AI Form Analysis (video) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "PLANNED",
          bold: true,
          font: "Arial",
          size: 22
        }), new TextRun({
          text: ", WARFIGHTER",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Gym Partnership Portal (B2B) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "PLANNED",
          bold: true,
          font: "Arial",
          size: 22
        })],
        spacing: { after: 400 }
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // ===== SECTION 4: APP LAUNCH READINESS CHECKLIST =====
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("SECTION 4: UPDATED APP LAUNCH READINESS CHECKLIST")]
      }),
      new Paragraph({
        children: [new TextRun({
          text: "Progress on critical items from v3.0 Business Plan:",
          font: "Arial",
          size: 22
        })],
        spacing: { after: 200 }
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "✓ Stripe subscription management — ",
          font: "Arial",
          size: 22,
          bold: true
        }), new TextRun({
          text: "DONE (checkout, webhooks, portal, tier changes)",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "✓ Database persistence (PostgreSQL) — ",
          font: "Arial",
          size: 22,
          bold: true
        }), new TextRun({
          text: "DONE (Railway + Prisma)",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "✓ Mobile PWA polish (push notifications, installable) — ",
          font: "Arial",
          size: 22,
          bold: true
        }), new TextRun({
          text: "DONE",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "⬜ Real authentication (email/password, JWT) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "Still needed",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "⬜ Trainer dashboard (client roster, revenue tracking) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "Partially built (OPS CENTER exists)",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "⬜ Client onboarding (trainer selection, tier choice) — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "Partially built",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "⬜ Terms of Service & Privacy Policy — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "Needed",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "⬜ Load testing — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "Needed before scale",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "⬜ Analytics integration — ",
          font: "Arial",
          size: 22
        }), new TextRun({
          text: "Needed",
          font: "Arial",
          size: 22
        })],
        spacing: { after: 400 }
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // ===== SECTION 5: COMPETITIVE ADVANTAGES =====
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("SECTION 5: COMPETITIVE ADVANTAGES")]
      }),
      new Paragraph({
        children: [new TextRun({
          text: "GUNS UP vs. Trainerize, Future, Caliber, and Strong",
          font: "Arial",
          size: 22,
          bold: true
        })],
        spacing: { after: 200 }
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("Unique Competitive Advantages")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Only app with full conversational AI trainer (Gunny, tier-gated Claude models). Competitors use limited Q&A or no AI.",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Only app with trainer personality customization via natural language notes. Competitors have static templates.",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Only app with military/tactical fitness specialization (MTI, Stew Smith, Barrett Tillman sourced protocols). Competitors generalist.",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Only app with achievement/badge gamification (22 badges, 4 tiers, XP leveling). Competitors minimal or none.",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Only app with live heart rate zones during workout execution. Competitors show HRV retrospectively.",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "Only app with 5-tier trainer rank system with revenue share bonuses (5%-30%). Competitors flat commission.",
          font: "Arial",
          size: 22
        })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun({
          text: "PWA (Progressive Web App): No app store gatekeeping, instant updates, native feel. Competitors app-only.",
          font: "Arial",
          size: 22
        })],
        spacing: { after: 200 }
      }),

      new Paragraph({
        children: [new TextRun({
          text: "Feature Parity Summary: 22 core features match or exceed competitor offerings. 7 unique advantages where all competitors = NO or PARTIAL.",
          font: "Arial",
          size: 22,
          italic: true
        })],
        spacing: { after: 0 }
      }),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("/sessions/inspiring-lucid-noether/mnt/Desktop/GUNS_UP_Business_Plan_Supplement_v3.1.docx", buffer);
  console.log("Document created successfully!");
});
