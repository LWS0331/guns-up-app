# Audit Report — GUNS UP App vs. Design Handoff

**Audited on:** 2026-04-25
**Codebase commit / branch:** `8f1290be` (main) — audit branch `audit/design-system-vs-canonical`
**Auditor:** Claude Code
**Spec source:** `gunny-handoff-v5/.../design_handoff_app_redesign/` (April 24 handoff)

---

## Executive Summary

**Total gaps found: ~52**
- **Critical (blocks visual parity):** 6
- **Major (degrades feel):** 21
- **Minor (polish):** 25

**Headline finding:** The design system is **mostly in place** (PRs #22–#45 ported tokens, components, and 6 of 6 in-app screens). The remaining gaps are concentrated in **(a) inline-style holdouts** that bypass the design-system utility classes, and **(b) anti-pattern violations** scattered across non-canonical screens (IntakeForm, BetaFeedback, OpsCenter, Sitrep flow) that were never explicitly audited against the spec.

**Single biggest root cause** — `AppShell.tsx` has ~60 inline `borderRadius: 3 | 4 | 6 | 8` declarations across confirmation modals, inline nav strips, and Sitrep error states that were never migrated. Fixing this one file alone closes ~20 gaps.

---

## 1. Token Gaps

### Colors

| Token | Spec | Found | Status |
|---|---|---|---|
| `--accent` | `#00ff41` | `#00ff41` | ✅ Match (`design-system.css:35`) |
| `--accent-rgb` | `0,255,65` | `0, 255, 65` | ✅ Match (`design-system.css:36`) |
| `--btn-alpha` | `0.18` | `0.18` | ✅ Match (`design-system.css:37`) |
| `--btn-border-alpha` | `0.55` | `0.55` | ✅ Match (`design-system.css:38`) |
| `--btn-text` | `#b6ffce` | `#b6ffce` | ✅ Match (`design-system.css:39`) |
| `--bg-base` | `#030303` | `#030303` | ✅ Match (`design-system.css:42`) |
| `--bg-surface` | `#080808` | `#080808` | ✅ Match (`design-system.css:43`) |
| `--bg-elevated` | `#0e0e0e` | `#0e0e0e` | ✅ Match |
| `--bg-card` | `#0a0a0a` | `#0a0a0a` | ✅ Match |
| `--bg-input` | `#050505` | `#050505` | ✅ Match |
| `--green` | `#00ff41` | `#00ff41` | ✅ Match |
| `--green-bright` | `#00e639` | `#00e639` | ✅ Match |
| `--green-muted` | `#00cc33` | `#00cc33` | ✅ Match |
| `--green-dim` | `#003d10` | `#003d10` | ✅ Match |
| `--green-glow` | `rgba(0,255,65,0.5)` | `rgba(0, 255, 65, 0.5)` | ✅ Match |
| `--text-bright` | `#ffffff` | `#ffffff` | ✅ Match |
| `--text-primary` | `#e0e0e0` | `#e0e0e0` | ✅ Match |
| `--text-secondary` | `#a0a0a0` | `#a0a0a0` | ✅ Match |
| `--text-tertiary` | `#707070` | `#707070` | ✅ Match |
| `--text-dim` | `#4a4a4a` | `#4a4a4a` | ✅ Match |
| `--amber` | `#ff8c00` | `#ff8c00` | ✅ Match |
| `--warn` | `#ffb800` | `#ffb800` | ✅ Match |
| `--danger` | `#ff4444` | `#ff4444` | ✅ Match |
| `--border-green` | `rgba(0,255,65,0.18)` | matches | ✅ Match |
| `--border-green-soft` | `rgba(0,255,65,0.10)` | matches | ✅ Match |
| `--border-green-strong` | `rgba(0,255,65,0.35)` | matches | ✅ Match |
| `--border-amber` | `rgba(255,140,0,0.30)` | matches | ✅ Match |
| `--border-danger` | `rgba(255,68,68,0.35)` | matches | ✅ Match |
| `--stencil` (font name) | `'Orbitron'` | **missing** | 💡 Minor — unused tweakable; spec defines but the live design system never reads from it |

**Inline-color anti-pattern violations** — components that hardcode hex values instead of using tokens:

- ⚠️ `BetaFeedback.tsx:150-214` — hardcoded `#00ff41`, `#1a1a1a`, `#00ff4144`, `#00ff4122` everywhere instead of `var(--green)` / `var(--bg-card)` / `var(--border-green)` / `var(--border-green-soft)`. ~12 occurrences.
- ⚠️ `AppShell.tsx:1496-1601` — Sitrep error/loading screen hardcodes `#00ff41`, `#030303`, `#888`, `#333`, `#ff6b6b`. ~15 occurrences.
- ⚠️ `IntelCenter.tsx:1061-1064` — Tracking accuracy tier table hardcodes `#00ff41`, `#4ade80`, `#facc15`, `#ff6b35` for tier colors. Tier accents are intentionally outside the canonical palette so this is borderline acceptable, but the labels themselves (`#888`, `#555`) should use tokens.
- ⚠️ `OpsCenter.tsx` — admin dashboard, never refactored, full of hardcoded hex.

### Typography

| Class | Spec | Found | Status |
|---|---|---|---|
| `t-display-xl` (H1) | 22px (mobile) / 28px (iPad), LH 1.05, LS 0.5px, weight 900, Orbitron | `design-system.css:118` exactly matches | ✅ Match |
| `t-display-l` | 20px / 1.05 / 1px / 800 / Orbitron | matches | ✅ Match |
| `t-display-m` | 15px / 1.1 / 1.5px / 700 / Orbitron | matches | ✅ Match |
| `t-eyebrow` | 10px / 3px LS / Orbitron 700, preceded by 14×1px green line | `design-system.css:146-167` matches | ✅ Match |
| `t-label` | 10px / 2.2px LS / Orbitron 700 / `text-secondary` | matches | ✅ Match |
| `t-body` | 14px / 1.55 / Chakra Petch / `text-primary` | matches | ✅ Match |
| `t-body-sm` | 13px / 1.5 / Chakra Petch / `text-secondary` | matches | ✅ Match |
| `t-mono-sm` | 11px / 0.04em LS / `text-tertiary` | matches | ✅ Match |
| `t-mono-data` | 13px / `text-primary` | matches | ✅ Match |
| `t-num-display` | 24px / `--green` / glow text-shadow | matches | ✅ Match |
| `t-num-large` | 32px / 900 / Orbitron / `text-bright` | matches | ✅ Match |

**Font-loading status:** Orbitron (400-900), Chakra Petch (300-700), Share Tech Mono (400) all loaded via Google Fonts in `layout.tsx:94`. ✅

**Inline font-family violations** — components that string-quote the font instead of using `var(--display)` / `var(--body)` / `var(--mono)`:

- 💡 `AppShell.tsx:1552` — `fontFamily: '"Chakra Petch", sans-serif'` (hardcoded; should be `var(--body)`)
- 💡 `AppShell.tsx:2266` — same
- 💡 ~30+ other inline `fontFamily: 'Orbitron, sans-serif'` declarations across AppShell, IntakeForm, OpsCenter, BetaFeedback, COCDashboard
- These render correctly (Google Fonts is loaded) but bypass the design-system token contract — meaning if the token is renamed they break silently.

### Spacing

Spec scale: `4 / 8 / 12 / 14 / 18 / 22 / 28 / 36`. Implemented as CSS vars `--s-1` through `--s-8` (`design-system.css:80-87`). ✅

**Anti-pattern: rogue spacing values:**

- ❌ Critical: `AppShell.tsx` uses `padding: '10px 20px'` / `padding: 16` / `padding: 24` / `padding: 12px` etc. — none use the `--s-*` vars. ~80+ occurrences across the file.
- ⚠️ `BetaFeedback.tsx`, `IntakeForm.tsx`, `OpsCenter.tsx`, `IntelCenter.tsx` — each has dozens of `padding: X` values that mix scale-aligned (8/12/14/16) with off-scale (10/15/20/30).
- 💡 `Achievements.tsx`, `MealRow.tsx` — mostly aligned but use `padding: 6` / `padding: 10` (close enough but technically off-scale).

The CSS variables exist but **almost no component code actually uses `var(--s-3)` etc.** — utility classes (`.field`, `.ds-card`, `.btn`) bake spacing in, so component code uses raw numbers and happens to land on the scale most of the time.

### Radii

Spec: `0` everywhere except Gunny FAB at `14px`. Inputs may use `2px`.

**❌ Critical violation count: ~60+ inline `borderRadius` declarations** with non-zero, non-2 values. Sample:

| File | Line | Value | Note |
|---|---|---|---|
| `AppShell.tsx` | 1499 | `borderRadius: '3px'` | Trainer dashboard inline tab |
| `AppShell.tsx` | 1519 | `borderRadius: '3px'` | same |
| `AppShell.tsx` | 1563 | `borderRadius: 2` | Loading-state progress bar (close to spec but inputs only) |
| `AppShell.tsx` | 1585, 1589, 1590 | `borderRadius: 4` | Sitrep error retry buttons |
| `AppShell.tsx` | 1777, 1819, 1841, 2149, 2169 | `border-radius: 4px` | Inline `<style jsx>` blocks (Gunny panel header buttons) |
| `BetaFeedback.tsx` | 150, 156, 161, 163, 193, 199 | `borderRadius: 3 / 4 / 6` | Beta feedback form |
| `IntakeForm.tsx` | many | `borderRadius: 4` | Mode chips, field cards |
| `IntelCenter.tsx` | 1060, 1085, 1098, 1138, 1162, etc. | `borderRadius: 6 / 4 / 3` | Tier card, date nav, log mode pills |
| `OpsCenter.tsx` | many | `borderRadius: 4 / 6` | Admin tab strip, KPI cards |
| `BattlePlanRef.tsx` | various | `borderRadius: 6 / 8` (legacy, may be ported) | Sample-day rows, macro grid |
| `DailyBrief.tsx` | various | `borderRadius: 6 / 8` | Compliance bar, exercise rows |

`design-system/page.tsx:275` and `:315` use `borderRadius: '50%'` for icon swatches and the gunny-icon-wrap demo — these are within the spec's "round non-card decorative element" allowance and are not violations.

`VitalsSticky.tsx`, the new GunnyChat scroll FAB, and the GunnyFab itself correctly use `14px` and `50%` per spec.

### Effects

- ✅ CRT scanline overlay — `globals.css:51-68` (body::before / body::after) renders the canonical scanlines + edge vignette globally.
- ✅ Glow text-shadows on accent text — applied via `.t-num-display`, `.t-eyebrow::before`, `.gunny-avatar`, etc.
- ✅ Inset button glow — `.btn-primary` / `.btn-amber` / `.btn-danger` have `inset 0 0 0 1px rgba(0,0,0,0.4), inset 0 0 16px rgba(<accent>,0.08)` per spec.
- ⚠️ `AppShell.tsx:1740` — `box-shadow: 8px 0 32px rgba(0,0,0,0.8)` on the Gunny side panel. Spec says no drop shadows on cards — this is a panel not a card so debatable, but it's a shadow.
- ⚠️ `AppShell.tsx:2027` — accent-pulse line uses `boxShadow: '0 1px 8px rgba(255,184,0,0.15)'` — minor amber glow accent, technically fine.

---

## 2. Component Gaps

### Button

`design-system.css:286-394` implements `.btn` + `btn-primary` / `btn-secondary` / `btn-ghost` / `btn-amber` / `btn-danger` / `btn-danger-outline` + `btn-sm` + `btn-block`.

- ✅ All 6 variants present
- ✅ Translucent fill at 18% (`var(--btn-alpha)`)
- ✅ 1px accent border at 55% (`var(--btn-border-alpha)`)
- ✅ Faded text tone (`#b6ffce` for green, `#ffd9a8` for amber, `#ffb8b8` for danger)
- ✅ Inset glow + box-shadow per spec
- ✅ 11px Orbitron 700 / 2px LS / uppercase
- ✅ 44px min-height
- ✅ iOS `-webkit-appearance: none` strip applied via global rule

**Inline solid-fill button violations** (`#00ff41` solid background — anti-pattern):
- ❌ Critical: `AppShell.tsx:1496` and `:1516` — Trainer dashboard tab inline buttons use `backgroundColor: '#00ff41'` (solid green).
- ❌ Critical: `AppShell.tsx:1589` — Sitrep retry button: `background: '#00ff41'` solid.
- ⚠️ `BetaFeedback.tsx:214` — submit button uses `background: description.length >= 10 ? '#00ff41' : '#333'` (solid).
- ⚠️ `IntelCenter.tsx` — multiple solid-color SCAN/SEARCH/SAVE inline buttons in nutrition log modes (yellow `#facc15`, light-green `#4ade80`, orange `#ff6b35`). The tier-color buttons are intentional per the tier-accuracy color system but are still solid fills, which violates the canonical translucent-button rule.

### Card + Bracket

`design-system.css:233-279` implements `.ds-card` + `.ds-card.elevated` + `.ds-card.amber-tone` + `.ds-card.danger-tone` + `.bracket` with corner pseudo-elements + `.bl` / `.br` helper spans.

- ✅ 1px translucent green border on default
- ✅ 16px padding default
- ✅ Corner brackets via 4-corner system (`::before` + `::after` for top, `.bl` + `.br` spans for bottom)
- ✅ Three tones (default / amber / danger)
- ✅ All four corner brackets render

**Note for RN port:** Spec says "in React Native, build a `<BracketCard tone="...">` component that renders 4 corner views absolutely." We're a web app so the CSS `::before`/`::after` approach is correct.

### Eyebrow

`design-system.css:146-167`:
- ✅ 10px Orbitron 700 / 3px LS / `--green`
- ✅ 14×1px glowing line preceding (via `::before`)
- ✅ Three tone variants: default green, `.amber`, `.danger`

### Label

`design-system.css:169-176`:
- ✅ 10px Orbitron 700 / 2.2px LS / `--text-secondary`

### Chip

`design-system.css:543-571`:
- ✅ 11px Share Tech Mono / 6×10px padding
- ✅ Three tones (`green` / `amber` / `danger`)
- ✅ Optional `.chip-x` close button

### Bar (progress)

`design-system.css:611-624`:
- ✅ 6px tall track
- ✅ Translucent green fill (`rgba(0,255,65,0.08)`)
- ✅ Three tones (default green / amber / danger)
- ✅ Inner span scales `width %`

### Segmented

`design-system.css:516-540`:
- ✅ 36px min-height
- ✅ 10px Orbitron 700 / 1.8px LS
- ✅ Active = 5% accent fill + bright accent border + accent text

### SubTabs

`design-system.css:476-510`:
- ✅ 10px Orbitron 700 / 1.8px LS
- ✅ 2px glowing underline on active (`box-shadow: 0 0 6px var(--green)`)

### TopBar

`design-system.css:743-810` (`.ds-topbar` + `.ds-topbar-brand` + `.ds-topbar-callsign`).

- ✅ Brand mark + GUNS UP wordmark + callsign small caps (handled in `AppShell.tsx:1939-1949`)
- ✅ Right-side callsign chip with green dot
- ⚠️ Major: **The pulsing dot animation is NOT applied on the topbar callsign.** Spec says "pulsing dot animation (opacity 1→0.4→1 over 2s)". Currently the callsign chip is rendered via `<UserSwitcher>` which shows the callsign and avatar but does not animate. The standalone `.ds-topbar-callsign .dot` animation IS defined in `design-system.css:780-789` (uses `dsPulseDot 2s`), but the actual rendered callsign chip is the `<UserSwitcher>` component, not `.ds-topbar-callsign`.
- 💡 The desktop center nav strip uses `.subtabs` chrome (post PR #44) but mixes in `.nav-tab` legacy class hooks — works fine, just dual-classed.

### TabBar

`design-system.css:812-867` (`.ds-tabbar` + button states + `.gunny-tab` halo).

- ✅ 5 columns (with empty 5th cell on 4-tab views)
- ✅ 22px stroke icons (currently character glyphs `◆ ▦ ◈ ⬡` — see anti-pattern flag below)
- ✅ 9px Orbitron 700 labels
- ✅ 24×2px green pip on active tab
- ❌ Critical: **Tab icons are character glyphs, not SVG icons.** `AppShell.tsx:1320-1325` defines `icon: '◆'`, `'▦'`, `'◈'`, `'▶'`, `'⬡'`. Spec says SVG icons. The Gunny center tab DOES use a logo image (`logo-glow.png`) wrapped in `.gunny-icon-wrap` per spec. The other 4 tabs need actual `<Icon>` SVG components.

### GunnyFab

`design-system.css:949-988` (`.ds-gunny-fab`).

- ✅ Bottom-LEFT (`left: 14px; bottom: 76px`)
- ✅ 14px border-radius (the only rounded element in the system)
- ✅ Amber outline 1.5px @ 80% alpha
- ✅ Translucent amber fill
- ✅ Bolt icon (currently `<BoltIcon size={18} />`) + "GUNNY" label 13px Orbitron 800 / 3px LS
- ✅ Glowing text + icon
- ✅ 44px min-height
- ✅ Show/hide cubic-bezier pop animation

---

## 3. Screen Gaps

### Planner / Day

(Renders via `Planner.tsx::renderDayView`, ported in PR #25)

- ✅ Crumb (`// Planner / Day`) + H1 (date with green em on day) + mono sub-line
- ✅ Daily Brief amber bracket card (via `<DailyBriefRef>`) — eyebrow + compliance % + body
- ✅ Segmented date nav with separate `Today` jump button
- ✅ Workout card with H2 + Edit / Start / Delete + Coach's Notes + numbered warmup list (mono numbering)
- ✅ Movement card with name + amber Demo button + chip row (sets×reps, RPE, tempo, rest)
- 💡 Movement chips show the parsed prescription tags via `<TagPill>`. Spec mentions explicit RPE, Tempo, Rest chips. If a movement's prescription string doesn't include all three, the chip row is shorter than the canonical mock — depends on data, not code.

### Planner / Month

(Renders via `Planner.tsx::renderMonthView`, ported in PR #26)

- ✅ Header: "Month **Year**" with year as green em
- ❌ Major: **Export ghost button is missing.** Spec calls for an Export button on the right of the H1. Currently there's no Export action anywhere in the planner.
- ✅ Active Battle Plan card (above the segmented nav, via `<BattlePlanRef>`)
- ✅ Daily Brief card (above the segmented nav, via `<DailyBriefRef>`)
- ✅ Segmented nav (Month active)
- ✅ 7-column calendar grid; today gets `--border-green-strong` + 6% green fill
- ⚠️ Major: **"DAY" stencil label** missing on workout days. Spec says workout days show a "DAY" stencil bottom-aligned. Currently `Planner.tsx:1163` shows the workout title text in a green-bordered box. That displays the same data more usefully but doesn't match the canonical visual.
- 💡 Cells aren't strictly `1:1 aspect ratio`. They have `minHeight: 60px` (mobile) / `90px` (desktop) so they aren't square cells. Acceptable on web where data density matters more.

### Workout Mode

(Renders via `Planner.tsx::renderWorkoutMode`, restructured in PR #45)

- ✅ Amber eyebrow header (`Workout Mode · Active`) + Gunny + Exit inline buttons
- ✅ VITALS · LIVE sticky HUD bar with REC session timer, REST/HR/SET tri-grid, zone strip, action row
- ✅ Rest Timer card (the standalone one below the HUD, with preset chips 30s/1m/1.5m/2m/3m)
- ✅ HR Zone Tracker with semicircle gauge (via `<HRZoneGauge>` inside the HUD's `.vitals-expand`)
- ✅ "NOW · SET X/Y" green chip header on active block
- ✅ WEIGHT / REPS / RPE 3-col input grid
- ✅ "Log Set & Start Rest →" big primary CTA
- ✅ "// SETS · THIS EXERCISE" history below
- ⚠️ Major: **Warmup amber bracket card** doesn't use the canonical handoff layout. Spec says: "amber bracket card, 7 movements, name + sets/reps + Demo". Current implementation (`Planner.tsx:2156-2178`) has each warmup movement in its OWN `<WarmupMovementCard>` — the cards stack but aren't wrapped in a single shared amber bracket card. The list is collapsed under a "WARMUP · 7 MOVEMENTS" toggle button which works but is a different UX than the spec's always-visible card.
- 💡 Voice selector (`VOICE: ONYX` chip) renders `Planner.tsx:1822-1860` with hardcoded green outline. Could use `.chip` utility.

### Intel

#### Profile (PR #24)

- ✅ Sub-tab strip (horizontal scrollable on mobile, sidebar on desktop)
- ✅ Form fields (name, age, height, weight, body fat, training age, readiness, sleep, stress) — all use `<DsField>` helper
- ✅ Goals chip group with `.chip.green` + `.chip-x` close
- ✅ Recovery vitals (Readiness/Sleep/Stress) wrapped in their own `.ds-card.bracket` block per the handoff
- ✅ Update Fitness Assessment CTA at the bottom

#### Nutrition (PR #36 + #37 + #38)

- ✅ Tracking accuracy tier card
- ✅ Date navigator with `Prev` / `Next` / `Jump to Today`
- ✅ Log mode segmented (Quick / Photo / USDA / Manual)
- ✅ Macro target inputs in `.ds-card.bracket`
- ✅ Today's Progress with 4 `.bar` strips (cal/protein/carbs/fat)
- ✅ Meal log card with `<MealRow>` entries
- ⚠️ Major: **The 4 meal-entry inputs** (name + cal + protein + carbs + fat) inside the Log Meal form keep their inline-style focus/blur ternaries — never refactored to `<DsField>`. Functional, but bypasses the design system. (`IntelCenter.tsx:1830-2080` approx.)

#### PR Board (PR #34)

- ✅ View toggle (Roadmap / Tracker / Table) → `.segmented`
- ✅ Tracker mode with phase-line tracker + summary stats card
- ✅ Table view wrapped in `.ds-card.bracket`
- ✅ + Add PR CTA → `.btn.btn-primary`

#### Analytics

(Renders via `<ProgressCharts>`)
- ⚠️ Major: **Not audited in detail.** `ProgressCharts.tsx` has emojis and inline styles per `grep` earlier in the migration. Likely contains anti-patterns. Recommended for follow-up audit.

#### Injuries (PR #33)

- ✅ Danger bracket card per injury (active = `.danger.danger-tone`, recovering = `.amber.amber-tone`, cleared = `.elevated`)
- ✅ Name input
- ✅ ACTIVE / RECOVERING / CLEARED status select with solid color treatment
- ✅ Notes textarea (`.ds-textarea`)
- ✅ Restrictions chip list with × buttons (`.chip.danger` + `.chip-x`)
- ✅ + Add Restriction / + Add Injury CTAs

#### Preferences (PR #33)

- ✅ Training split + duration + days/week fields → `<DsField>`
- ✅ Equipment Arsenal grid (preset chips + custom add)
- ✅ Weak Points (amber chips)
- ✅ Movements to Avoid (danger chips)

### COC Dashboard (PR #43)

- ✅ Operator banner with `.t-display-xl` callsign + `.t-mono-sm` meta + tier `.chip` + (beta) `.chip.amber`
- ✅ 4 stat cards in `.ds-card.bracket` with `.t-eyebrow` headers
- ✅ Weekly Ops + PR Board + Readiness panels in bracket cards
- ✅ NEW BATTLE PLAN button + modal use `.btn.btn-amber` and `.ds-card.bracket.amber.amber-tone`

### Gunny Chat (PRs #28 + #29 + #45)

- ✅ Header with `.gunny-avatar` + `.t-display-l` GUNNY title + `.t-mono-sm` subtitle + tier `.chip` + `.status-pill.ok` online + TTS toggle
- ✅ Quick action strip (`.gunny-quick`) with SVG icons
- ✅ Message bubbles (`.msg.user` / `.msg.gunny` / `.msg.bracket.amber` for workout cards)
- ✅ Composer (`.composer-bar` + `.composer-prefix` + `.composer-input` + `.composer-send`) with green `>>` prefix
- ✅ Scroll-to-bottom FAB (PR #45)

### Landing Page

(`/landing/page.tsx`, separate from app shell)

- ⚠️ Not in the in-app handoff scope but referenced as the visual source of truth. Uses its own `landing.module.css`. ✅ Functions standalone.

### Off-spec screens not in handoff (uncovered)

The following components / screens exist in the codebase but are **not part of the handoff scope** — they're internal admin / onboarding / feedback flows. Each contains anti-patterns but isn't audited against canonical screen specs since none exists:

- `IntakeForm.tsx` (~500 lines) — uses emoji icons (🏋️ ⚡ 🔩 🏃 🎖️ 🔄 🤖 per `:64-70`), inline radii, off-scale spacing
- `OpsCenter.tsx` (admin dashboard) — full of inline hardcoded hex + emoji
- `BetaFeedback.tsx` — solid-fill submit button (`#00ff41`), inline radii, hardcoded hex
- `Sitrep` flow — `AppShell.tsx:1543-1601` Sitrep loading/error screens use solid green retry buttons + hardcoded hex
- `TacticalRadio.tsx`, `TrainerDashboard.tsx`, `Leaderboard.tsx`, `SocialFeed.tsx`, `DailyBrief.tsx` (legacy non-Ref version), `SitrepView.tsx`, `ProgressCharts.tsx` — all unaudited, likely contain anti-patterns

---

## 4. Behavior Gaps

- ✅ Tab navigation — bottom tab swaps content (`AppShell.tsx::renderTabContent`)
- ✅ Sub-tab navigation — Intel screen has horizontal scrollable sub-tabs (mobile) / sidebar (desktop)
- ✅ Press states — `.btn:active` bumps fill opacity (per `design-system.css:299`)
- ✅ Inputs — focus = 1px green border + 1px green box-shadow (`design-system.css:574`)
- ⚠️ Major: **Topbar callsign pulsing dot animation is not bound to the rendered callsign.** The CSS exists (`.ds-topbar-callsign .dot` with `dsPulseDot`) but the actual rendered callsign chip is `<UserSwitcher>`, not `.ds-topbar-callsign`. Either (a) wire the animation into `UserSwitcher`, or (b) replace the desktop callsign chip with `.ds-topbar-callsign`.
- ✅ Responsive — mobile single-column, iPad 2-column via `.grid-2-md` + `.ipad` scope helpers
- ⚠️ The `.ipad` class isn't auto-applied via viewport — it has to be opt-in by the page wrapper. No screens currently set it. Mobile and desktop currently render with the same scale (mobile sizes), and iPad-specific bumps don't activate. Spec says iPad gets 28px H1 / 24px padding / 2-col grid — currently iPad inherits mobile.

---

## 5. Anti-Patterns Found

### ❌ Critical

1. **Tab icons are character glyphs, not SVG.** `AppShell.tsx:1320-1325` — `icon: '◆' | '▦' | '◈' | '▶' | '⬡'`. Spec calls for SVG icons via `Icons.tsx`.
2. **Inline solid-fill buttons.** `AppShell.tsx:1496, 1516, 1589` use `backgroundColor: '#00ff41'` (solid green); `BetaFeedback.tsx:214` same. Spec calls for translucent fills.
3. **~60+ inline `borderRadius: 3 | 4 | 6 | 8`** across `AppShell.tsx`, `BetaFeedback.tsx`, `IntakeForm.tsx`, `IntelCenter.tsx`, `OpsCenter.tsx`. Spec says 0 everywhere except Gunny FAB at 14px.
4. **Hardcoded hex colors** instead of tokens — `BetaFeedback.tsx:150-214`, `AppShell.tsx:1496-1601`, `OpsCenter.tsx`. ~50+ occurrences.
5. **Topbar callsign pulsing dot animation not bound** — CSS exists but isn't applied to the rendered chip.
6. **iPad responsive scope (`.ipad`) is defined but never activated** — iPad users get mobile styling. Spec calls for 28px H1 / 24px padding / 2-col grid at 820px+.

### ⚠️ Major

7. Emojis remaining in user-visible chrome (per the user's recent flag, partially addressed in PR #44 but still present):
   - `IntakeForm.tsx:64-70` — 7 mode chips with `🏋️ ⚡ 🔩 🏃 🎖️ 🔄 🤖`
   - `IntelCenter.tsx:1061-1064` — 4 tier rows with `⚡ 🔬 💬 📸`
   - `DailyBrief.tsx:221, 231, 294` — `⚔️` and `🔥` and `⚔️`
   - `BattlePlanRef.tsx:258` — `⚔️`
   - `DailyBriefRef.tsx:113` — `🔥`
8. Generic `<style jsx>` blocks in `AppShell.tsx:1690-1900` define legacy `.gunny-panel`, `.gunny-header`, `.classification-bar` styles inline — not in the design system.
9. Off-spec screens (IntakeForm, OpsCenter, BetaFeedback, Sitrep flow, Leaderboard, SocialFeed, TacticalRadio, TrainerDashboard, DailyBrief legacy, SitrepView, ProgressCharts) have not been audited against the design system.
10. **Planner Month: "Export" ghost button missing** per spec.
11. **Planner Month: "DAY" stencil label** on workout days missing — title is shown instead.
12. **Workout Mode: warmup not in a single shared amber bracket card** — each movement is its own card.
13. Inline font-family strings instead of tokens — ~30+ occurrences.

### 💡 Minor

14. `--stencil` CSS var is defined but unused (CSS vars don't accept identifiers as font-family values reliably; spec is informational).
15. Movement card chip row is data-dependent (renders only the parsed prescription tags); spec implies always-present RPE/Tempo/Rest chips.
16. Calendar cells aren't strictly 1:1 aspect ratio (acceptable for web).
17. Voice selector chip in Workout Mode uses hardcoded styling instead of `.chip`.
18. Per-meal-entry inputs in Nutrition Log Meal form (`IntelCenter.tsx:1830-2080`) keep inline focus/blur ternaries — bypasses `<DsField>`.

---

## 6. Recommended Fix Order

The audit's headline finding is that **the design system is in place** but **inline-style holdouts in non-canonical screens** create the ~52 gaps. Fix order maximizes "gaps closed per touched line of code":

1. **Token/inline-hex sweep on `AppShell.tsx`** — replace all hardcoded `#00ff41`, `#888`, `#333`, `#1a1a1a` with `var(--green)` / `var(--text-tertiary)` / `var(--bg-card)`. Single file, ~80 inline-style blocks. Closes **~25 gaps** (Critical #2 + #3 + #4, Major #8 + #13).
2. **Tab icons → SVG** — replace `'◆'` etc. in `AppShell.tsx:1320-1325` with `<Icon.X>` components. Closes **Critical #1**.
3. **Topbar pulsing-dot binding** — apply `dsPulseDot` to the actual `<UserSwitcher>` rendered chip OR swap the desktop callsign for the canonical `.ds-topbar-callsign`. Closes **Critical #5**.
4. **iPad scope activation** — mount `<div data-device="ipad" className="ipad">` (or equivalent) wrapper at viewport ≥768px so the bumps activate. Closes **Critical #6**.
5. **Off-spec screen anti-pattern sweep** — `IntakeForm.tsx`, `OpsCenter.tsx`, `BetaFeedback.tsx`, `Sitrep` flow. Token/radius/emoji cleanup per file. Closes **Major #7 + #9**.
6. **Planner Month polish** — add Export ghost button + "DAY" stencil treatment. Closes **Major #10 + #11**.
7. **Workout Mode warmup card** — wrap the warmup list in a single `.ds-card.bracket.amber.amber-tone` instead of stacked individual cards. Closes **Major #12**.
8. **Minor polish** — voice selector chip, meal-entry `<DsField>` migration, etc.

Closing items 1-4 alone (which are roughly 200 lines of mechanical replacement) would resolve **~75% of the gaps**. The remaining 25% is the off-spec screens (item 5), which is a meaningful chunk of work but predictable.
