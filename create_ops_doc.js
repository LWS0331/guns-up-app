const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, Header, Footer, AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign, HeadingLevel, PageNumber, PageBreak, PageOrientation } = require('docx');
const fs = require('fs');

// Color constants
const HEADER_COLOR = "1B3A5C";
const LIGHT_BG = "F0F0F0";
const BORDER = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

// Helper function to create checkpoint paragraphs
function createCheckpoint(text) {
  return new Paragraph({
    children: [new TextRun(`☐ ${text}`)],
    indent: { left: 360 }
  });
}

// Helper function to create table with consistent styling
function createTable(rows, columnWidths) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: columnWidths,
    rows: rows.map((row, rowIdx) => {
      const isHeader = rowIdx === 0;
      return new TableRow({
        children: row.map((cell, colIdx) => {
          const bgColor = isHeader ? HEADER_COLOR : (rowIdx % 2 === 1 ? LIGHT_BG : "FFFFFF");
          const textColor = isHeader ? "FFFFFF" : "000000";
          const bold = isHeader;
          return new TableCell({
            borders: BORDERS,
            width: { size: columnWidths[colIdx], type: WidthType.DXA },
            shading: { fill: bgColor, type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                children: [new TextRun({ text: cell, bold: bold, color: textColor, size: 22 })],
                alignment: AlignmentType.LEFT
              })
            ]
          });
        })
      });
    })
  });
}

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: "Arial", size: 22 }
      }
    },
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: "FFFFFF" },
        paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 }
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: HEADER_COLOR },
        paragraph: { spacing: { before: 180, after: 120 }, outlineLevel: 1 }
      },
      {
        id: "Heading3",
        name: "Heading 3",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: HEADER_COLOR },
        paragraph: { spacing: { before: 120, after: 80 }, outlineLevel: 2 }
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
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            children: [new TextRun({ text: "CLASSIFIED — INTERNAL USE ONLY", bold: true, size: 20, color: "C00000" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 }
          })
        ]
      })
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: "Page ", size: 20 }),
              new TextRun({ text: PageNumber.CURRENT, size: 20 }),
              new TextRun({ text: "  |  OPERATION UNDOUBTED — MISSION OPS CHECKLIST", size: 20, italics: true })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200 }
          })
        ]
      })
    },
    children: [
      // PAGE 1: MISSION OVERVIEW
      new Paragraph({
        children: [new TextRun({ text: "OPERATION UNDOUBTED", bold: true, size: 44, color: HEADER_COLOR })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 }
      }),
      new Paragraph({
        children: [new TextRun({ text: "MISSION OPS CHECKLIST", bold: true, size: 36, color: HEADER_COLOR })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 }
      }),
      new Paragraph({
        children: [new TextRun({ text: "GUNS UP FITNESS × LONE WOLF SEARCH", italics: true, size: 26, color: "000000" })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 }
      }),
      new Paragraph({
        children: [new TextRun({ text: "COMPOUND ACQUISITION TIMELINE", bold: true, size: 24, color: HEADER_COLOR })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 }
      }),

      // KEY STATS BOX
      createTable([
        ["MISSION PARAMETER", "DETAILS"],
        ["Mission Start", "March 21, 2026"],
        ["Target Completion (Property)", "March 2027"],
        ["Target Completion (Grand Opening)", "September 2027"],
        ["Location", "Madera Ranchos / Clovis / Sanger, CA"],
        ["County", "Fresno County"],
        ["Property Target", "3–5+ acres, warehouse/shop, ADU-capable"],
        ["Price Target", "$750K–$1.1M"],
        ["Down Payment Target", "$200K (20% of $1M)"],
        ["Monthly Mortgage Estimate", "$5,060/mo (30yr @ 6.5% on $800K)"]
      ], [2340, 7020]),

      new Paragraph({ children: [new TextRun("")], spacing: { after: 360 } }),

      // PAGE 2: FINANCIAL BURDEN ANALYSIS
      new Paragraph({ children: [new PageBreak()] }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("FINANCIAL BURDEN ANALYSIS")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("CURRENT MONTHLY BURDEN (Pre-Launch)")]
      }),

      createTable([
        ["Item", "Cost"],
        ["Claude Max subscription (dev)", "$200"],
        ["Railway hosting", "$20"],
        ["Domain/misc", "$10"],
        ["TOTAL CURRENT BURDEN", "$230/mo"]
      ], [4680, 4680]),

      new Paragraph({ children: [new TextRun("")], spacing: { after: 200 } }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("PHASE 1 BURDEN (Beta — Months 1–2)")]
      }),

      createTable([
        ["Item", "Cost"],
        ["Claude Max subscription", "$200"],
        ["Railway hosting", "$20"],
        ["Anthropic API key (beta, 4 users)", "~$5"],
        ["Domain registration", "$15"],
        ["TOTAL PHASE 1 BURDEN", "$240/mo"],
        ["Revenue", "$0 (beta)"],
        ["NET BURN", "–$240/mo"]
      ], [4680, 4680]),

      new Paragraph({ children: [new TextRun("")], spacing: { after: 200 } }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("PHASE 2 BURDEN (Launch — Months 3–4)")]
      }),

      createTable([
        ["Item", "Cost"],
        ["Claude Max (can downgrade after launch)", "$200"],
        ["Railway hosting (Pro)", "$20"],
        ["Anthropic API (30–70 users)", "$50–$150"],
        ["Stripe fees (2.9% + $0.30 per txn)", "~$15–$30"],
        ["Legal (ToS, Privacy Policy)", "$500 one-time"],
        ["TOTAL PHASE 2 BURDEN", "$285–$400/mo"],
        ["Revenue (30–70 subs)", "$168–$392"],
        ["Trainer payouts", "–$42–$98"],
        ["NET", "–$159 to –$106/mo"]
      ], [4680, 4680]),

      new Paragraph({ children: [new TextRun("")], spacing: { after: 200 } }),

      // PAGE 3: MORE FINANCIAL BURDEN
      new Paragraph({ children: [new PageBreak()] }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("PHASE 3 BURDEN (Growth — Months 5–8)")]
      }),

      createTable([
        ["Item", "Cost"],
        ["Railway hosting (scaled)", "$30–$50"],
        ["Anthropic API (120–330 users)", "$200–$600"],
        ["Stripe fees", "$50–$150"],
        ["Marketing/ads", "$200–$500"],
        ["TOTAL PHASE 3 BURDEN", "$480–$1,300/mo"],
        ["Revenue (120–330 subs)", "$672–$1,848"],
        ["Trainer payouts", "–$168–$462"],
        ["NET", "+$24 to +$86/mo"]
      ], [4680, 4680]),

      new Paragraph({ children: [new TextRun("")], spacing: { after: 200 } }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("PHASE 4 BURDEN (Scale — Months 9–12)")]
      }),

      createTable([
        ["Item", "Cost"],
        ["Railway hosting (scaled)", "$50–$100"],
        ["Anthropic API (400–600 users)", "$700–$1,100"],
        ["Stripe fees", "$150–$250"],
        ["Marketing", "$500–$1,000"],
        ["Insurance (business liability)", "$200"],
        ["TOTAL PHASE 4 BURDEN", "$1,600–$2,650/mo"],
        ["Revenue (400–600 subs)", "$2,240–$3,360"],
        ["Trainer payouts", "–$560–$840"],
        ["NET", "+$80 to +$870/mo"]
      ], [4680, 4680]),

      new Paragraph({ children: [new TextRun("")], spacing: { after: 200 } }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("PROPERTY ACQUISITION BURDEN (Month 12+)")]
      }),

      createTable([
        ["Item", "Monthly Cost"],
        ["Mortgage ($800K @ 6.5%, 30yr)", "$5,060"],
        ["Property tax (1.1% of $1M / 12)", "$917"],
        ["Insurance (homeowner + business)", "$400"],
        ["Utilities (home + warehouse)", "$500"],
        ["TOTAL PROPERTY BURDEN", "$6,877/mo"],
        ["Business use deduction (40%)", "–$2,751"],
        ["NET AFTER-TAX PROPERTY BURDEN", "~$4,126/mo"]
      ], [4680, 4680]),

      new Paragraph({ children: [new TextRun("")], spacing: { after: 200 } }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("LWS INCOME OFFSET")]
      }),

      createTable([
        ["Source", "Monthly"],
        ["LWS recruiting income (conservative)", "$20,000–$35,000"],
        ["GUNS UP net revenue (Month 12)", "$2,520"],
        ["TOTAL INCOME", "$22,520–$37,520"],
        ["Total burden (all expenses)", "~$9,500"],
        ["MONTHLY SURPLUS FOR SAVINGS", "$13,000–$28,000"]
      ], [4680, 4680]),

      new Paragraph({ children: [new TextRun("")], spacing: { after: 360 } }),

      // PAGE 4: PHASE LINE ALPHA
      new Paragraph({ children: [new PageBreak()] }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("PHASE LINE ALPHA — BETA OPERATIONS")]
      }),

      new Paragraph({
        children: [new TextRun({ text: "Mission: Validate the app with 4 beta testers. Collect feedback. Fix bugs.", italics: true })],
        spacing: { after: 160 }
      }),

      new Paragraph({
        children: [new TextRun({ text: "Timeline: March 21 – May 15, 2026", bold: true })],
        spacing: { after: 200 }
      }),

      createCheckpoint("Deploy current build to production (COMPLETE)"),
      createCheckpoint("All 4 beta users active (Ruben, Britney, Efrain, Erika)"),
      createCheckpoint("Each beta user logs minimum 5 workouts"),
      createCheckpoint("Each beta user logs minimum 10 meals via Gunny"),
      createCheckpoint("Each beta user submits minimum 3 feedback items"),
      createCheckpoint("Fix all critical bugs reported during beta"),
      createCheckpoint("Keyboard input issue resolved on mobile (COMPLETE)"),
      createCheckpoint("Text readability improvements (COMPLETE)"),
      createCheckpoint("PWA installs correctly on iOS and Android"),
      createCheckpoint("Test trainer workout feed (client asks 'what did my trainer do')"),
      createCheckpoint("Test macro estimation accuracy with real meals"),
      createCheckpoint("Test Spanish language toggle across all screens"),
      createCheckpoint("Document all UX issues for pre-launch fix"),
      createCheckpoint("Create dedicated Anthropic API key for production"),
      createCheckpoint("Set up API usage monitoring dashboard"),
      createCheckpoint("Establish baseline API cost per user per tier"),

      new Paragraph({ children: [new TextRun("")], spacing: { after: 200 } }),

      new Paragraph({
        children: [new TextRun({ text: "Success Criteria: ", bold: true }), new TextRun("All 4 users active, bug list <5 items, core features working on mobile.")],
        spacing: { after: 100 }
      }),

      new Paragraph({
        children: [new TextRun({ text: "Burden: ", bold: true }), new TextRun("$240/mo | Revenue: $0 | Net: –$240/mo")],
        spacing: { after: 360 }
      }),

      // PAGE 5: PHASE LINE BRAVO
      new Paragraph({ children: [new PageBreak()] }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("PHASE LINE BRAVO — INFRASTRUCTURE")]
      }),

      new Paragraph({
        children: [new TextRun({ text: "Mission: Build the payment and auth backbone. Make the app production-ready.", italics: true })],
        spacing: { after: 160 }
      }),

      new Paragraph({
        children: [new TextRun({ text: "Timeline: May 15 – June 15, 2026", bold: true })],
        spacing: { after: 200 }
      }),

      createCheckpoint("Set up Stripe account for GUNS UP FITNESS LLC"),
      createCheckpoint("Implement Stripe subscription billing (4 tiers)"),
      createCheckpoint("Build trainer payout system (Stripe Connect)"),
      createCheckpoint("Implement real authentication (email/password signup)"),
      createCheckpoint("Build trainer invite flow (trainer sends link → client signs up)"),
      createCheckpoint("Migrate from in-memory state to PostgreSQL on Railway"),
      createCheckpoint("Set up database backup system"),
      createCheckpoint("Build client onboarding flow (tier selection, payment)"),
      createCheckpoint("Build trainer dashboard (client roster, revenue, directives)"),
      createCheckpoint("Draft Terms of Service"),
      createCheckpoint("Draft Privacy Policy"),
      createCheckpoint("Set up business email (support@gunsupfitness.com or similar)"),
      createCheckpoint("Register domain for GUNS UP FITNESS"),
      createCheckpoint("SSL certificate and security audit"),
      createCheckpoint("Load test with simulated 100 concurrent users"),
      createCheckpoint("Set up error monitoring (Sentry or similar)"),
      createCheckpoint("Create app store-style landing page"),
      createCheckpoint("Set up OVERWATCH ↔ GUNS UP financial bridge (see integration spec)"),

      new Paragraph({ children: [new TextRun("")], spacing: { after: 200 } }),

      new Paragraph({
        children: [new TextRun({ text: "Success Criteria: ", bold: true }), new TextRun("Stripe live, auth working, database persistent, legal docs done.")],
        spacing: { after: 100 }
      }),

      new Paragraph({
        children: [new TextRun({ text: "Burden: ", bold: true }), new TextRun("$400/mo + ~$1,500 one-time (legal, domain, setup) | Revenue: $0 | Net: –$400/mo")],
        spacing: { after: 360 }
      }),

      // PAGE 6: PHASE LINE CHARLIE
      new Paragraph({ children: [new PageBreak()] }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("PHASE LINE CHARLIE — SOFT LAUNCH")]
      }),

      new Paragraph({
        children: [new TextRun({ text: "Mission: Recruit first 5 trainers. Onboard 30+ paying subscribers.", italics: true })],
        spacing: { after: 160 }
      }),

      new Paragraph({
        children: [new TextRun({ text: "Timeline: June 15 – July 31, 2026", bold: true })],
        spacing: { after: 200 }
      }),

      createCheckpoint("Recruit Trainer #1 (personal network)"),
      createCheckpoint("Recruit Trainer #2 (personal network)"),
      createCheckpoint("Recruit Trainer #3 (local gym/CrossFit)"),
      createCheckpoint("Recruit Trainer #4 (social media outreach)"),
      createCheckpoint("Recruit Trainer #5 (social media outreach)"),
      createCheckpoint("Each trainer onboards minimum 5 clients"),
      createCheckpoint("First Stripe payment processed successfully"),
      createCheckpoint("First trainer payout issued"),
      createCheckpoint("Monitor API costs vs projections"),
      createCheckpoint("Collect first round of paying user feedback"),
      createCheckpoint("Fix any payment/billing issues"),
      createCheckpoint("Track MRR daily — target: $168 by end of Month 3"),
      createCheckpoint("Post launch announcement on social media"),
      createCheckpoint("Create Instagram/TikTok content showing app features"),
      createCheckpoint("Create trainer recruitment pitch deck"),

      new Paragraph({ children: [new TextRun("")], spacing: { after: 200 } }),

      new Paragraph({
        children: [new TextRun({ text: "Success Criteria: ", bold: true }), new TextRun("5 trainers, 30+ subs, $168+ MRR, zero payment issues.")],
        spacing: { after: 100 }
      }),

      new Paragraph({
        children: [new TextRun({ text: "Burden: ", bold: true }), new TextRun("$285–$400/mo | Revenue: $168–$250 | Net: –$117 to –$150/mo")],
        spacing: { after: 360 }
      }),

      // PAGE 7: PHASE LINE DELTA
      new Paragraph({ children: [new PageBreak()] }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("PHASE LINE DELTA — GROWTH OPS")]
      }),

      new Paragraph({
        children: [new TextRun({ text: "Mission: Scale to 30+ trainers, 250+ subscribers. Prove the revenue model.", italics: true })],
        spacing: { after: 160 }
      }),

      new Paragraph({
        children: [new TextRun({ text: "Timeline: August – November 2026", bold: true })],
        spacing: { after: 200 }
      }),

      createCheckpoint("Recruit trainers 6–15 (Month 5–6)"),
      createCheckpoint("Recruit trainers 16–25 (Month 7–8)"),
      createCheckpoint("Recruit trainers 26–30 (Month 8)"),
      createCheckpoint("Hit 100 subscriber milestone"),
      createCheckpoint("Hit 200 subscriber milestone"),
      createCheckpoint("Hit $1,000 MRR milestone"),
      createCheckpoint("First trainer earns $50+/mo from revenue share"),
      createCheckpoint("Launch referral program (trainers get bonus for referring trainers)"),
      createCheckpoint("A/B test pricing (run Sonnet at $7 for new signups, measure conversion)"),
      createCheckpoint("Build and publish case study (trainer testimonial)"),
      createCheckpoint("Launch targeted ads ($200–$500/mo budget)"),
      createCheckpoint("Fresno/Clovis local gym partnerships"),
      createCheckpoint("Attend local fitness events/expos"),
      createCheckpoint("Begin property search in Madera Ranchos/Clovis/Sanger"),
      createCheckpoint("Get pre-approved for mortgage"),
      createCheckpoint("Tour minimum 5 properties"),
      createCheckpoint("Compound fund balance check — target: $100K+"),
      createCheckpoint("Monthly financial review against business plan projections"),

      new Paragraph({ children: [new TextRun("")], spacing: { after: 200 } }),

      new Paragraph({
        children: [new TextRun({ text: "Success Criteria: ", bold: true }), new TextRun("30 trainers, 250 subs, $1,400 MRR, $100K in compound fund.")],
        spacing: { after: 100 }
      }),

      new Paragraph({
        children: [new TextRun({ text: "Burden: ", bold: true }), new TextRun("$480–$1,300/mo | Revenue: $672–$1,848 | Net: +$24 to +$86/mo")],
        spacing: { after: 360 }
      }),

      // PAGE 8: PHASE LINE ECHO
      new Paragraph({ children: [new PageBreak()] }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("PHASE LINE ECHO — ACQUISITION")]
      }),

      new Paragraph({
        children: [new TextRun({ text: "Mission: Acquire the compound property. Begin buildout planning.", italics: true })],
        spacing: { after: 160 }
      }),

      new Paragraph({
        children: [new TextRun({ text: "Timeline: December 2026 – March 2027", bold: true })],
        spacing: { after: 200 }
      }),

      createCheckpoint("Hit 50 trainer milestone"),
      createCheckpoint("Hit 400+ subscriber milestone"),
      createCheckpoint("Hit $2,000 MRR milestone"),
      createCheckpoint("Compound fund balance: $200K+"),
      createCheckpoint("Make offer on property"),
      createCheckpoint("Secure mortgage financing"),
      createCheckpoint("Close on property"),
      createCheckpoint("Begin warehouse assessment (structural, electrical, plumbing)"),
      createCheckpoint("Get contractor quotes for gym buildout"),
      createCheckpoint("Get contractor quotes for office partition (LWS HQ)"),
      createCheckpoint("ADU permits filed for parent housing unit"),
      createCheckpoint("ADU permits filed for in-law housing unit"),
      createCheckpoint("File business address change for LWS LLC"),
      createCheckpoint("File business address change for GUNS UP FITNESS LLC"),
      createCheckpoint("Set up business utilities accounts"),
      createCheckpoint("Order gym equipment (Section 179 deduction — file in Year 1)"),
      createCheckpoint("Insurance quotes (commercial liability, property)"),

      new Paragraph({ children: [new TextRun("")], spacing: { after: 200 } }),

      new Paragraph({
        children: [new TextRun({ text: "Success Criteria: ", bold: true }), new TextRun("Property closed, buildout plans finalized, equipment ordered.")],
        spacing: { after: 100 }
      }),

      new Paragraph({
        children: [new TextRun({ text: "Burden: ", bold: true }), new TextRun("$6,877/mo property + $1,600–$2,650 app | Revenue: LWS $25K+ + app $2.5K | Net: surplus")],
        spacing: { after: 360 }
      }),

      // PAGE 9: PHASE LINE FOXTROT
      new Paragraph({ children: [new PageBreak()] }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("PHASE LINE FOXTROT — BUILD & LAUNCH")]
      }),

      new Paragraph({
        children: [new TextRun({ text: "Mission: Build out the UNDOUBTED Training Center. Grand opening.", italics: true })],
        spacing: { after: 160 }
      }),

      new Paragraph({
        children: [new TextRun({ text: "Timeline: April – September 2027", bold: true })],
        spacing: { after: 200 }
      }),

      createCheckpoint("Warehouse buildout begins (gym side)"),
      createCheckpoint("Office buildout begins (LWS HQ side)"),
      createCheckpoint("ADU construction begins (Phase 1 — parents)"),
      createCheckpoint("Gym equipment delivered and installed"),
      createCheckpoint("LWS office operational"),
      createCheckpoint("Internet/phone/security installed"),
      createCheckpoint("Business licenses and permits obtained"),
      createCheckpoint("Grand opening marketing campaign"),
      createCheckpoint("60+ trainers on app platform"),
      createCheckpoint("600+ subscribers"),
      createCheckpoint("First in-person trainer recruited to work at facility"),
      createCheckpoint("GRAND OPENING — UNDOUBTED TRAINING CENTER"),
      createCheckpoint("Parents move in (ADU #1)"),
      createCheckpoint("In-laws move in (ADU #2, Phase 2)"),

      new Paragraph({ children: [new TextRun("")], spacing: { after: 200 } }),

      new Paragraph({
        children: [new TextRun({ text: "Success Criteria: ", bold: true }), new TextRun("Doors open. Both businesses operational from compound.")],
        spacing: { after: 360 }
      }),

      // PAGE 10: INTEGRATION & API SETUP
      new Paragraph({ children: [new PageBreak()] }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("COMMAND CENTER FINANCIAL BRIDGE")]
      }),

      new Paragraph({
        children: [new TextRun({ text: "OVERWATCH ↔ GUNS UP Financial Integration", italics: true })],
        spacing: { after: 160 }
      }),

      new Paragraph({
        children: [new TextRun({ text: "The LWS OVERWATCH Command Center needs a financial dashboard that shows combined revenue from both businesses.", italics: true })],
        spacing: { after: 200 }
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Integration Architecture")]
      }),

      new Paragraph({
        children: [new TextRun({ text: "1. GUNS UP API Endpoint", bold: true })],
        spacing: { after: 100 }
      }),

      new Paragraph({
        children: [new TextRun("Build a /api/financials endpoint on the GUNS UP Railway app that returns subscription revenue, user counts, trainer payouts, and API costs in JSON format.")],
        indent: { left: 360 },
        spacing: { after: 160 }
      }),

      new Paragraph({
        children: [new TextRun({ text: "2. OVERWATCH Dashboard Widget", bold: true })],
        spacing: { after: 100 }
      }),

      new Paragraph({
        children: [new TextRun("Add a GUNS UP section to the OVERWATCH Command Center dashboard showing: GUNS UP MRR (real-time from API), LWS Revenue (from existing OVERWATCH data), Combined Monthly Income, Compound Fund Balance, and Burn rate/runway.")],
        indent: { left: 360 },
        spacing: { after: 160 }
      }),

      new Paragraph({
        children: [new TextRun({ text: "3. API Key Authentication", bold: true })],
        spacing: { after: 100 }
      }),

      new Paragraph({
        children: [new TextRun("Secure the bridge with an API key shared between the two Railway apps.")],
        indent: { left: 360 },
        spacing: { after: 160 }
      }),

      new Paragraph({
        children: [new TextRun({ text: "4. Monthly Reconciliation", bold: true })],
        spacing: { after: 100 }
      }),

      new Paragraph({
        children: [new TextRun("Automated report combining LWS placement fees, GUNS UP subscription revenue, total expenses, and net savings toward compound fund.")],
        indent: { left: 360 },
        spacing: { after: 200 }
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Implementation Steps")]
      }),

      createCheckpoint("Create /api/financials route on GUNS UP Railway app"),
      createCheckpoint("Add API key authentication middleware"),
      createCheckpoint("Build OVERWATCH dashboard widget for GUNS UP data"),
      createCheckpoint("Create combined financial view in OVERWATCH"),
      createCheckpoint("Set up monthly automated report generation"),
      createCheckpoint("Create compound fund savings tracker"),

      new Paragraph({ children: [new TextRun("")], spacing: { after: 360 } }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("DEDICATED API KEY — COST ISOLATION")]
      }),

      new Paragraph({
        children: [new TextRun({ text: "Purpose: Separate development API usage from production usage to accurately track per-user costs.", italics: true })],
        spacing: { after: 200 }
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Setup Steps")]
      }),

      createCheckpoint("Create new Anthropic API key labeled GUNS-UP-PRODUCTION"),
      createCheckpoint("Set up usage alerts at $50, $100, $250, $500 thresholds"),
      createCheckpoint("Implement per-tier request tagging (haiku/sonnet/opus metadata on each API call)"),
      createCheckpoint("Build internal cost dashboard showing total spend, cost per tier, cost per user, projected monthly, and tier revenue margin"),
      createCheckpoint("Set up weekly cost report (automated email or Slack)"),
      createCheckpoint("Implement rate limiting per user (prevent abuse)"),
      createCheckpoint("Set monthly budget caps per tier as safety rails"),

      new Paragraph({ children: [new TextRun("")], spacing: { after: 200 } }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Alert Thresholds")]
      }),

      new Paragraph({
        children: [new TextRun("Per-user daily: 50 requests max (haiku), 30 (sonnet), 20 (opus)")]
      }),
      new Paragraph({
        children: [new TextRun("Monthly budget: Start at $500, increase with subscriber growth")]
      }),
      new Paragraph({
        children: [new TextRun("Margin alert: If any tier's API cost exceeds 80% of price, flag for review")]
      })
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  const outputPath = "/sessions/inspiring-lucid-noether/mnt/Desktop/GUNS_UP_Mission_Ops_Checklist.docx";
  fs.writeFileSync(outputPath, buffer);
  console.log(`Document created successfully: ${outputPath}`);
});
