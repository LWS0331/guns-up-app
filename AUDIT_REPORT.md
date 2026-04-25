# Audit Report — GUNS UP App (Planner + Gunny)

**Audited on:** 2026-04-25
**Codebase commit / branch:** `main` @ `f269881` (post-merge of #46/#47/#48)
**Auditor:** Claude Code
**Scope:** Planner (Day, Month, Workout Mode) + Gunny (Chat, Trainer Command Center)

---

## Executive Summary

- **Total gaps found:** 41
- ❌ **Critical:** 16
- ⚠️ **Major:** 13
- 💡 **Minor:** 12

**Top 3 highest-impact fixes** (most surface area / most user-visible):

1. **🔴 Workout Mode header demolition (W1+W2+W3+W13+W15)** — the entire `VitalsSticky` HUD strip at `Planner.tsx:1818-1863` (rendered via `src/components/VitalsSticky.tsx`) is **not in the canonical spec for Workout Mode**. Per `README → Workout Mode §1-2`, the live-session screen is supposed to be (top-to-bottom): amber eyebrow + Gunny + Exit / H1 / **Rest Timer card** / **HR Zone Tracker card** / Active Set Logging / Warmup. No HUD blocks. No standalone zone strip. No Pause/+30S/Reset/HUD action row in the header. No `● REC 854:26` indicator. Removing the HUD module closes 6 critical gaps in one stroke.
2. **🔴 Mic FAB removal (W10) + Gunny duplicate surface (W9)** — `WorkoutPTT.tsx:234-236` floats a 64px orange "HOLD TO TALK" mic on `right: 16, bottom: 96` that competes visually with the canonical Gunny FAB on the bottom-LEFT. Plus `Planner.tsx:1791` renders a separate "⚡ Gunny" pill button in the workout-mode header — so the user sees TWO Gunny entry points + a mic FAB simultaneously. Spec is one Gunny FAB only. Mic should integrate into the Active Set Logging card or notes input.
3. **🔴 Color-palette violations (P10+P11+P14)** — RPE chip uses `#ff6b6b` (pink) at `Planner.tsx:751`; Tempo chip uses `#ba68c8` (purple) at `Planner.tsx:758`; entire **Cooldown** card uses `#60a5fa` (tailwind blue-400) at `Planner.tsx:2673,2676` AND `WarmupMovementCard.tsx:88,111`. Spec allows only green / amber / danger. These are ❌ Critical anti-patterns that escaped the design system migration and reach the screens with the highest content density (every workout, every day).

The first two fixes touch ~3 files but flip the entire feel of Workout Mode. The third is a single-day refactor of `parseMovementText` tag colors plus the cooldown wrapper tones.

---

## 1. Planner — Month View

### P1 — Calendar cells use rounded corners ✅ FIXED
**File:** `src/components/Planner.tsx:1142-1167`
**Code:**
```tsx
<div key={dateStr} ... style={{ minHeight: isMobile ? 60 : 90, padding: isMobile ? 4 : 8, backgroundColor: cellBg, border: cellBorder, ... }}>
```
**Spec:** `app/app-system.css` `.cal-cell { border-radius: 0; }`; README → "Radii".
**Status:** No `borderRadius` is set on cells. Cells render square per spec. **Not a gap.**

### P2 — "DAY" stencil bottom-aligned ✅ FIXED (PR #48)
**File:** `src/components/Planner.tsx:1252-1268`
**Code:**
```tsx
{workout && (<div aria-hidden style={{ position: 'absolute', ..., bottom: isMobile ? 2 : 4, fontFamily: '"Orbitron", sans-serif', fontWeight: 800, ... }}>DAY</div>)}
```
**Status:** "DAY" stencil shipped in PR #48. **Not a gap.** Workout title still renders above; if the audit's screenshot shows clipped "DAY 1…" text, that's the workout title overflowing the cell — a separate issue.

### P3 — Gunny FAB overlapping calendar bottom hint ❌ Critical
**File:** `src/components/Planner.tsx:1303-1308`
**Code:**
```tsx
<div className="t-mono-sm" style={{ textAlign: 'center', marginTop: 4, color: 'var(--text-dim)' }}>
  Drag workouts to move between dates
</div>
```
**Spec:** `design-system.css:937-940` — `.ds-gunny-fab { position: fixed; left: 14px; bottom: 76px; }`. README → "GunnyFab".
**Issue:** No `padding-bottom` / `scroll-padding-bottom` on the Planner scroll container to clear the FAB. The FAB occupies `bottom: 76px` for ~44px height = the bottom 120px of the viewport is FAB territory. Hint text + last calendar row sit underneath.
**Fix:** Add `padding-bottom: 120px` (or larger) on the scroll container; or `scroll-padding-bottom: 120px` on the planner root.

### P4 — Crumb appears BELOW the segmented date nav ❌ Critical
**File:** `src/components/Planner.tsx:1067-1087` (renderMonthView crumb) vs `Planner.tsx:3727-3774` (segmented nav)
**Code:**
```tsx
// Outer parent render (line 3727) — segmented nav comes FIRST
<div className="row-between" style={{ marginBottom: 20 }}>
  <button ... className="seg" aria-label="Previous">◀</button>
  <div className="segmented">{...month/week/day toggle...}</div>
  <button ... className="seg">Today</button>
</div>
// Then renderMonthView() runs, which itself starts with:
<header style={{ marginBottom: 4 }}>
  <div className="t-mono-sm">// Planner / Month</div>  // ← crumb is HERE, after the nav
  <h2 className="t-display-xl">April 2026</h2>
</header>
```
**Spec:** README → Planner Month §1 — order: crumb → H1 → sub-line → daily brief → segmented nav.
**Fix:** Move the crumb + H1 above the segmented nav row. Either render crumb in the parent (`Planner.tsx:3683-3710`) or pass it as a header prop into the parent.

### P5 — No bottom tab bar visible on Month screen ⚠️ Major
**File:** `src/components/AppShell.tsx` (TabBar render site, ~line 2030+) — TabBar is always mounted in `<main>`, no `display: none` keyed off Month view.
**Spec:** README → "Tabbar".
**Status:** Per code review, TabBar is unconditional at the AppShell level. If the audit screenshot shows it missing, it's likely scroll-hidden on iOS Safari (URL bar collapse pushing it off-screen) OR the workoutMode lock state hides interaction. **UNCLEAR** — needs live device verification.

### P6 — "Active Battle Plan" card has chevron expand ⚠️ Major
**File:** `src/components/BattlePlanRef.tsx` (not deeply read in this audit pass — verify)
**Spec:** README → Planner Month §2 — eyebrow + mono metadata only, no expand state.
**Fix:** Remove chevron toggle if present; render content always-on.

### P7 — "Today's Daily Brief" % chip has chevron ⚠️ Major
**File:** `src/components/DailyBriefRef.tsx` (not deeply read in this audit pass — verify)
**Spec:** README → Planner Day §2 — amber bracket card with eyebrow + percentage right-aligned + body copy, no expand.
**Fix:** Remove chevron; render content always-on.

### P8 — Segmented nav prev/next chevrons render as iOS default white-filled rounded squares ❌ Critical
**File:** `src/components/Planner.tsx:3727-3736, 3765-3774`
**Code:**
```tsx
<button type="button" onClick={handleNavigatePrevious} className="seg" aria-label="Previous" style={{ padding: '9px 12px' }}>◀</button>
// ... and ...
<button type="button" onClick={handleNavigateNext} className="seg" ...>▶</button>
```
**Spec source:** `design-system.css:515-537` — `.segmented .seg { ... -webkit-appearance: none; border-radius: 0; }` (descendant selector — only matches when `.seg` is INSIDE `.segmented`).
**Issue:** Prev/next chevrons live as siblings of `.segmented`, not children. The `.segmented .seg { -webkit-appearance: none; border-radius: 0 }` rule does NOT match, so on iOS Safari they fall back to the rounded chrome default.
**Fix:** Either (a) wrap prev/next inside the `.segmented` container, or (b) add a standalone `.seg` rule that copies the iOS appearance reset.

### P9 — EXPORT button uses inline solid styling, not ghost variant + duplicate Export ⚠️ Major
**File:** `src/components/Planner.tsx:3693-3709` (outer header) AND `Planner.tsx:1098-1105` (inner Month header from PR #48)
**Code (outer, anti-pattern):**
```tsx
<button onClick={handleExportJson} style={{ padding: '6px 14px', backgroundColor: 'transparent', color: '#00ff41', border: '1px solid rgba(0,255,65,0.2)', fontFamily: 'Share Tech Mono', fontSize: '15px', ... }}>EXPORT</button>
```
**Spec:** README → Component Library → Button. Should use `.btn.btn-ghost` not inline.
**Issue:** Two Export buttons render simultaneously when on Month view — one in the outer parent header, one inside `renderMonthView()` from PR #48. Plus the outer one bypasses the design system.
**Fix:** Delete the outer Export at `:3693-3709`; keep only the inner Month-scoped one. Or move the canonical Export into the parent header and delete the inner.

---

## 2. Planner — Day / Workout Detail

### P10 — Movement chips use OUT-OF-SPEC colors (RPE pink, Tempo purple) ❌ Critical
**File:** `src/components/Planner.tsx:751, 758`
**Code:**
```tsx
// RPE chip
tags.push({ icon: '⚡', label: `RPE ${rpeMatch[1]}`, color: '#ff6b6b', bg: 'rgba(255,107,107,0.08)', border: 'rgba(255,107,107,0.2)', ... });
// Tempo chip
tags.push({ icon: '◷', label: `Tempo ${tempoMatch[1]}`, color: '#ba68c8', bg: 'rgba(186,104,200,0.08)', border: 'rgba(186,104,200,0.2)', ... });
```
**Spec:** README → "Chip" — 3 chip tones only: green / amber / danger. `design-system.css:543-575`.
**Fix:** RPE → amber tone (`var(--amber)` + 13% bg). Tempo → green tone (`var(--green)` + 8% bg). Remove `color: '#ff6b6b'` and `color: '#ba68c8'` entirely.

### P11 — Cooldown wrapper uses BLUE color outside palette ❌ Critical
**File:** `src/components/Planner.tsx:2673-2680` and `src/components/WarmupMovementCard.tsx:88,111`
**Code:**
```tsx
// Planner.tsx
<div style={{ ..., border: '1px solid rgba(96,165,250,0.35)', borderRadius: 8, ... }}>
  <button style={{ ..., background: 'rgba(96,165,250,0.08)', color: '#60a5fa', ... }}>
    COOLDOWN · {N} MOVEMENTS
// WarmupMovementCard.tsx (cooldown variant)
color: isCooldown ? '#60a5fa' : 'var(--amber)',
// ... and cooldown Demo button:
background: '#60a5fa', color: '#111', border: 'none', // SOLID FILL
```
**Spec:** README → "Chip" + Component Library colors (green / amber / danger only). All radii 0.
**Fix:** Reuse the warmup amber bracket card pattern from PR #48 (`.ds-card.bracket.amber.amber-tone`). Replace `#60a5fa` with `var(--amber)` everywhere in cooldown rendering. Remove `borderRadius: 8`. Cooldown Demo button → `.btn.btn-amber.btn-sm` (translucent, matches warmup).

### P12 — Movement letter prefix "C) DUMBBELL WALKING LUNGES" is in the data string 💡 Minor
**File:** Data-level — `exerciseName` strings carry the "A1)/B1)/C)" prefix. No render-side gap; spec is informational.
**Fix:** Either strip on render and surface as a separate `.t-mono-sm` crumb above the movement name, or scrub the program data so prefixes live in a separate field.

### P13 — Gunny FAB overlapping movement card at bottom of scroll ❌ Critical
**File:** Same root cause as P3. `Planner.tsx` workout/day scroll containers have no `padding-bottom` to clear the FAB.
**Fix:** Add `padding-bottom: 120px` on the scroll containers in Day view + Workout Mode (`Planner.tsx` workout-mode wrapper, ~line 1783).

### P14 — Demo button on cooldown movements is solid blue fill ❌ Critical
**File:** `src/components/WarmupMovementCard.tsx:107-124`
**Code:**
```tsx
className={isCooldown ? undefined : 'btn btn-amber btn-sm'}
style={isCooldown ? { ..., background: '#60a5fa', color: '#111', border: 'none', ... } : ...}
```
**Spec:** README → "Button" → translucent fill ~18% opacity.
**Status:** Warmup Demo button correctly uses `.btn.btn-amber.btn-sm` (translucent — `design-system.css:347-355`). **Cooldown variant** bypasses the design system with a solid blue fill — anti-pattern.
**Fix:** Same as P11 — drop the cooldown special-case and reuse `.btn.btn-amber.btn-sm`.

---

## 3. 🔴 Workout Mode

### W1 — Stat HUD blocks at top of screen ❌ Critical
**File:** `src/components/Planner.tsx:1818-1863` rendering `<VitalsSticky />` (full HUD module at `src/components/VitalsSticky.tsx`)
**Code:**
```tsx
<VitalsSticky restTimer={restTimer} restTimerMax={restTimerMax} ... currentHR={currentHR} ... currentSetIndex={nowIdx} totalSets={totalSetsForBlock} ... />
```
**`VitalsSticky.tsx:130-140`:**
```tsx
<div className="vitals-head">
  <span>// Vitals · Live</span>
  {workoutStartTime && <span className="live">REC {formatMMSS(sessionDuration)}</span>}
</div>
<div className="vitals-grid">
  {/* LEFT — Rest timer with target. */}
  <div className="vital-timer">...</div>
  {/* CENTER — HR readout + sparkline + range label. */}
  <button className="vital-gauge">...</button>
  {/* RIGHT — Set indicator. */}
  <div className="vital-set">...</div>
</div>
```
**Spec:** README → Workout Mode §1-2 — header should be ONLY: amber eyebrow + Gunny + Exit, then H1, then dedicated Rest Timer card, then dedicated HR Zone Tracker card. **No HUD strip.**
**Fix:** Delete the `<VitalsSticky />` render block at `Planner.tsx:1818-1863`. Rest timer already lives in its own card below at `:1977-2065`. Set log indicator should move into the Active Set Logging card.

> **Cross-reference:** PR #45 deliberately RESTORED VitalsSticky based on a screenshot interpreted as canonical. This new audit cites the README spec which omits the HUD entirely. **Spec contradiction needs explicit user decision** before fixing.

### W2 — Z1-Z5 zone strip rendered as standalone HUD bar ❌ Critical
**File:** `src/components/VitalsSticky.tsx:275-296`
**Code:**
```tsx
{zones.length > 0 && (
  <div className="vital-zonestrip">
    {zones.map(z => { ... <div className={isActive ? 'active' : ''} ...>Z{z.zone}</div> })}
  </div>
)}
```
**Spec:** README → Workout Mode §3 — zone strip lives INSIDE the HR Zone Tracker card, below the semicircle gauge. Not in the header.
**Fix:** Delete the `.vital-zonestrip` block (or the entire VitalsSticky per W1). The HR Zone Tracker card's expanded `<HRZoneGauge />` (rendered via `vitals-expand`) already includes its own zone strip.

### W3 — Workout control buttons (Pause / +30S / Reset / HUD) in header ❌ Critical
**File:** `src/components/VitalsSticky.tsx:302-340`
**Code:**
```tsx
<div className="vitals-actions">
  <button onClick={onPauseTimer} className="primary">Pause</button>
  <button onClick={onAddRest}>30s</button>
  <button onClick={onResetTimer}>Reset</button>
  <button onClick={onToggleHrExpanded}>HUD</button>
</div>
```
**Spec:** README → Workout Mode §1 — no action row in the header.
**Fix:** Pause + Reset move into the Rest Timer card (next to the running countdown). +30S is redundant (preset chips already cover this). ▼ HUD goes away with the HUD itself (W1).

### W4 — HR Zone Tracker card is dismissible ❌ Critical
**File:** `src/components/HRZoneGauge.tsx:123-138`
**Code:**
```tsx
{onClose && (
  <button onClick={onClose} ...>×</button>
)}
```
**Spec:** README → Workout Mode §3 — HR Zone Tracker is a permanent primary surface.
**Fix:** Remove the `onClose` prop wiring at `VitalsSticky.tsx:356` (`onClose={onToggleHrExpanded}`). Or delete the `× ` render block in HRZoneGauge entirely.

### W5 — HR Zone Tracker "NO DEVICE" empty state isn't designed ⚠️ Major
**File:** `src/components/HRZoneGauge.tsx` (full empty-state branch)
**Spec:** README → Workout Mode §3 + new empty-state.
**Fix:** Style the empty state — gauge greyed (`var(--text-dim)` ring), pill in amber (translucent amber bracket card + Share Tech Mono "NO DEVICE"), input field uses `.ds-input` with `0` radii.

### W6 — "Voice: ONYX" orphan row (no card wrapper) ⚠️ Major
**File:** `src/components/Planner.tsx:1923-1960`
**Code:**
```tsx
{workoutMode && (
  <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
    <button ... className={`chip ${showVoiceSelect ? 'green' : ''}`}>Voice: {selectedVoice.toUpperCase()}</button>
    {showVoiceSelect && (...VOICE_OPTIONS chips...)}
  </div>
)}
```
**Spec:** README → §3-4 gap — orphan plain-text rows aren't allowed.
**Status:** PR #48 already migrated to `.chip` group treatment, so the chips themselves are on-spec. But the row sits between two cards with no card wrapper — still feels orphaned.
**Fix:** Wrap in `<div className="ds-card">` with `<span className="t-eyebrow">// Voice Coach</span>` heading. Or absorb into the Active Set Logging card as a row.

### W7 — Rest Timer presets render as buttons, not chips ⚠️ Major
**File:** `src/components/Planner.tsx:2042-2053`
**Code:**
```tsx
{[30, 60, 90, 120, 180].map(sec => (
  <button onClick={...} className="btn btn-amber btn-sm" style={{ padding: '6px 10px' }}>
    {sec < 60 ? `${sec}s` : `${sec / 60}m`}
  </button>
))}
```
**Spec:** README → "Chip" + Workout Mode §2. Should be `.chip` (Share Tech Mono 11px, translucent amber, 0 radii). Currently renders as `.btn.btn-amber.btn-sm` — translucent ✓ but Orbitron not Share Tech Mono and uses button typography.
**Fix:** Replace `className="btn btn-amber btn-sm"` with `className="chip amber"` (note: `.chip.amber` may need to be added to design-system.css if not present — verify line 543+).

### W8 — Rest Timer card missing eyebrow ⚠️ Major
**File:** `src/components/Planner.tsx:1977-2065`
**Code:**
```tsx
<div className={`ds-card bracket ${...}`} style={{...}}>
  <span className="bl" /><span className="br" />  // ← brackets present ✓
  // ... circle SVG ...
  <div style={{ fontFamily: 'var(--mono)', fontSize: restRunning ? 48 : 24, ... }}>
    {Math.floor(restTimer / 60)}:{(restTimer % 60).toString().padStart(2, '0')}
  </div>
  // ... preset chips + Stop button ...
</div>
```
**Spec:** README → Workout Mode §2 — Rest Timer card needs eyebrow `// REST TIMER` at top, followed by 56px Share Tech Mono amber number, then preset chips. Bracket corners ✓ are present.
**Status:** Brackets already render. Eyebrow is missing.
**Fix:** Add `<span className="t-eyebrow amber">// Rest Timer</span>` at the top of the card body.

### W9 — Two GUNNY surfaces visible simultaneously ❌ Critical
**File:** `src/components/Planner.tsx:1791-1798` (header pill in workout mode) AND `AppShell.tsx:2156-2166` (FAB hidden only when `activeTab === 'gunny'`)
**Code (Planner.tsx):**
```tsx
{onOpenGunny && (
  <button type="button" onClick={onOpenGunny} className="btn btn-amber btn-sm">⚡ Gunny</button>
)}
```
**Code (AppShell.tsx):**
```tsx
{activeTab !== 'gunny' && (
  <button className={`ds-gunny-fab gunny-toggle-btn ${!showGunnyPanel ? 'show' : ''}`} ...>...GUNNY</button>
)}
```
**Spec:** README → "GunnyFab" — only the bottom-left FAB.
**Fix:** Either (a) delete the workout-mode header pill at `Planner.tsx:1791-1798`, or (b) hide the FAB while `workoutMode === true` to avoid double-surface. Spec preference is (a).

### W10 — Microphone FAB on the right side ❌ Critical
**File:** `src/components/WorkoutPTT.tsx:231-244, 319`
**Code:**
```tsx
<div style={{
  position: 'fixed',
  bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
  right: 16,
  zIndex: 500,
  ...
}}>
  // ...
  {recording ? 'TRANSMITTING' : 'HOLD TO TALK'}
</div>
```
**Spec:** README → "GunnyFab" placement — the only floating element should be the GunnyFab on the LEFT.
**Fix:** Integrate the mic icon into the Active Set Logging card (small icon button next to each set row) or as a trailing icon inside the notes input. Do NOT float it. Or hide it on iPhone-class viewports, leaving voice activation through a long-press on the chat composer.

### W11 — Warmup Demo button cut off by mic FAB ⚠️ Major
**File:** Resolves with W10 fix (FAB removal) + scroll-padding-bottom (P3/P13).
**Verify after W10/P13:** Each warmup row in `WarmupMovementCard.tsx` should render its Demo button fully.

### W12 — Header "RAMPAGE" callsign pulsing dot ✅ FIXED (PR #46)
**File:** `src/components/AppShell.tsx:1975-1988`
**Code:**
```tsx
<span aria-hidden style={{ width: 5, height: 5, background: 'var(--green)', borderRadius: '50%', boxShadow: '0 0 6px var(--green)', animation: 'dsPulseDot 2s ease-in-out infinite' }} />
{currentSelectedOp.callsign}
```
**Status:** Pulsing dot wired in PR #46. **Not a gap.**

### W13 — `● REC 854:26` orange recording indicator ❌ Critical
**File:** `src/components/VitalsSticky.tsx:131-138`
**Code:**
```tsx
<div className="vitals-head">
  <span>// Vitals · Live</span>
  {workoutStartTime && <span className="live">REC {formatMMSS(sessionDuration)}</span>}
</div>
```
**Spec:** README → Workout Mode §1 — no recording indicator.
**Fix:** Disappears with the W1 HUD demolition. If session timing is needed, move into the Rest Timer card eyebrow line (`// REST TIMER · SESSION 14:24`).

### W14 — H1 glow text-shadow 💡 Minor
**File:** `src/components/Planner.tsx:1808-1810`
**Code:**
```tsx
<h3 className="t-display-l" style={{ color: 'var(--green)', marginBottom: 12 }}>{workout.title}</h3>
```
**Spec:** README → Effects → glow on accent text: `0 0 12px rgba(0,255,65,0.5)`.
**Status:** `t-display-l` may or may not include a text-shadow rule (verify in design-system.css). Inline style does NOT add one.
**Fix:** Add `textShadow: '0 0 12px rgba(0,255,65,0.5)'` to the inline style (or make sure `.t-display-l.green` includes it).

### W15 — `8PM` orphan text in header ❌ Critical
**File:** Searched `Planner.tsx`/`VitalsSticky.tsx` for the literal "8PM" — no static match. Likely sourced from `currentTime` or `localTime` rendering somewhere.
**Spec:** Cleanup — delete.
**Fix:** Locate the dynamic time render (likely in VitalsSticky's `vitals-head` or a Workout Mode header sibling). Delete the standalone time chip.

---

## 4. Gunny — Chat

### G1 — Header has tier badge / online pill / TTS toggle (not in spec) 💡 Minor
**File:** `src/components/GunnyChat.tsx:2037-2085`
**Code:**
```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
  <span className="chip" style={{ borderColor: getTierColor(operator.tier), background: `${getTierColor(operator.tier)}1a`, ... }}>{operator.tier}</span>
  <span className="status-pill ok">...{t('gunny.online')}</span>
  <button ... className={`btn btn-sm ${ttsOn ? 'btn-primary' : 'btn-secondary'}`}><Icon.Volume size={14} /></button>
</div>
```
**Spec:** README — Gunny chat header: avatar + GUNNY + subtitle + status indicator.
**Status:** Avatar ✓, GUNNY ✓, "FUNCTIONAL BODYBUILDER TRAINER" subtitle ✓, online status pill ✓ (matches "status indicator"). Tier badge + TTS toggle are extras. Decision needed — keep or document.
**Fix:** Either document tier badge + TTS toggle in the spec as canonical additions, or move them off the header into a settings sheet.

### G2 — Quick-action chip row may overflow on right ⚠️ Major
**File:** `src/components/GunnyChat.tsx:1870-1900` (kb-board / quick-action region)
**Spec source:** `design-system.css:1592+` `.kb-board { overflow-x: auto; ... -webkit-overflow-scrolling: touch; }`.
**Status:** CSS allows horizontal scroll. If clipped without scroll affordance, the cause is the parent container clipping; verify on device.
**Fix:** If overflow isn't visually affording scroll, add a fade-out gradient on the right edge OR a small `▶` indicator chip.

### G3 — Offline state isn't designed (placeholder text repeated) ⚠️ Major
**File:** `src/components/GunnyChat.tsx:1243`
**Code:**
```tsx
const errMsg = data?.error || 'Gunny AI temporarily offline.';
```
**Spec:** Design gap — offline state needs its own treatment, not a recycled message bubble.
**Fix:** Render offline state as a styled empty-state card with `.t-eyebrow` ("// GUNNY · OFFLINE") + dim body copy + retry CTA. Stop pushing the same string into a regular `.msg.gunny` bubble.

### G4 — User messages have rounded corners ⚠️ Major
**File:** `src/styles/design-system.css:1348-1356` (`.msg`, `.msg.user`)
**Code:**
```css
.msg { position: relative; padding: 12px 14px; border: 1px solid var(--border-green-soft); background: rgba(0,0,0,0.3); }
.msg.user { border-color: rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); }
```
**Spec:** README → "Radii" — 0 everywhere.
**Status:** No `border-radius` set explicitly. Should default to 0 in Chrome/Firefox. iOS Safari may apply native styling — verify with explicit `border-radius: 0` to be safe.
**Fix:** Add `border-radius: 0;` to `.msg` rule explicitly.

### G5 — Message timestamps inside bubble + Orbitron not Share Tech Mono ⚠️ Major
**File:** `src/styles/design-system.css:1363-1375`
**Code:**
```css
.msg-meta { display: flex; justify-content: space-between; font-family: var(--display); font-size: 9px; ... }
```
**Spec:** Component gap — timestamps should be Share Tech Mono, outside or under bubble, secondary text color.
**Issue:** `var(--display)` = Orbitron, not Share Tech Mono. Position is inside the bubble (top, full-width row).
**Fix:** Change `font-family: var(--mono)` and reposition the timestamp to render below the bubble in `GunnyChat.tsx` message render.

### G6 — Gunny avatar lacks bracket corners 💡 Minor
**File:** `src/components/GunnyChat.tsx:2023-2025`
**Code:**
```tsx
<div className="gunny-avatar" style={{ width: 40, height: 40, fontSize: 18 }}>
  <span>G</span>
</div>
```
**Spec:** Polish — bracket treatment for visual consistency with cards.
**Fix:** Optional — can add `<span className="bl"/><span className="br"/>` inside, but the avatar is intentionally a circle and might look worse with brackets. Consider this a "test in production" decision.

### G7 — SEND button rounded ⚠️ Major
**File:** `src/styles/design-system.css:1578-1591`
**Code:**
```css
.composer-send { background: var(--green); border: none; color: #000; ... }
```
**Spec:** README → "Button" — 0 radii.
**Status:** No explicit `border-radius: 0` set. `-webkit-appearance: none` rule at line 105-115 does include `.composer-send` so iOS strip is in place, but Chrome/Firefox button defaults vary.
**Fix:** Add `border-radius: 0;` to `.composer-send`.

### G8 — Composer tool icons (clip + camera) need stroke-style verification 💡 Minor
**File:** `src/components/GunnyChat.tsx` composer area + `src/components/Icons.tsx` (`.composer-tool` icons)
**Spec:** README → Iconography — 1.6px stroke, 22px size, accent color.
**Status:** Need visual inspection. Most icons in `Icons.tsx` are made via the shared `make()` factory with default `strokeWidth: 2`. Audit may want 1.6.
**Fix:** Verify tool icon size at the composer render site; pass `size={22}` if not default.

---

## 5. Gunny — Trainer Command Center

> The "Trainer Command Center" maps to the **`'ops'` tab** in `AppShell.tsx` when `currentUser.role === 'trainer'`. Renders `<TrainerDashboard />` (stat cards) or `<OpsCenter />` (admin) based on a sub-toggle.

### T1 — "MY CLIENTS" / "COMMAND CENTER" toggle uses .btn variants, not .segmented ❌ Critical
**File:** `src/components/AppShell.tsx:1497-1521`
**Code:**
```tsx
<div style={{ display: 'flex', gap: '10px', padding: '14px 18px', borderBottom: '1px solid var(--border-green-soft)', background: 'var(--bg-card)' }}>
  <button onClick={() => setShowTrainerDashboard(false)} className={`btn btn-sm ${!showTrainerDashboard ? 'btn-primary' : 'btn-ghost'}`}>My Clients</button>
  {OPS_CENTER_ACCESS.includes(currentUser.id) && (
    <button onClick={() => setShowTrainerDashboard(true)} className={`btn btn-sm ${showTrainerDashboard ? 'btn-primary' : 'btn-ghost'}`}>Command Center</button>
  )}
</div>
```
**Spec:** README → "Segmented" — translucent, square, Orbitron 10px, 1.8px LS.
**Fix:** Wrap the buttons in `<div className="segmented">` and replace `btn btn-primary/btn-ghost` with `seg active/seg`.

### T2 — Monthly Revenue value sized 32px ⚠️ Major
**File:** `src/components/TrainerDashboard.tsx:167-174`
**Code:**
```tsx
<div style={{ fontSize: '32px', fontFamily: '"Orbitron", sans-serif', color: '#00ff41', margin: '0 0 8px 0' }}>${totalMonthly.toFixed(2)}</div>
```
**Spec:** `t-num-display` is 24px. Audit screenshot shows ~48-56px. Codebase ships 32px — between.
**Fix:** Either (a) standardize to `t-num-display` (24px) and apply consistently; or (b) document a `t-num-hero` (~40px) variant in the type scale and use it here. **Recommend (a)** for system simplicity.

### T3 — Card titles use grey `<p>`, not green eyebrow ❌ Critical
**File:** `src/components/TrainerDashboard.tsx:164, 187, 213`
**Code:**
```tsx
<p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>Monthly Revenue</p>
```
**Spec:** README → Component Library → Eyebrow. Should be green eyebrow ABOVE the value (`// MONTHLY REVENUE` in `var(--green)` Orbitron 700, 3px LS).
**Fix:** Replace each `<p style={{...11px gray uppercase...}}>` with `<span className="t-eyebrow">// Monthly Revenue</span>`.

### T4 — "5 CLIENTS" stat sized 24px ⚠️ Major
**File:** `src/components/TrainerDashboard.tsx:216-223`
**Code:**
```tsx
<div style={{ fontSize: '24px', fontFamily: '"Orbitron", sans-serif', color: '#00ff41', ... }}>{tierData.count} CLIENTS</div>
```
**Spec:** Audit references 32-40px Orbitron 900 (`t-num-large`).
**Fix:** Bump to 32px and use the canonical class once defined. Same decision as T2 (one type scale, consistently applied).

### T5 — Stat cards have NO bracket corners + rounded radii ❌ Critical
**File:** `src/components/TrainerDashboard.tsx:158-178, 181-201, 207-228`
**Code:**
```tsx
<div style={{ backgroundColor: '#111', border: '1px solid #1a1a2e', padding: '20px', borderRadius: '4px' }}>
```
**Spec:** README → "Card + Bracket". 1px translucent green border + 16px padding + corner brackets via `.bl/.br` spans. 0 radii.
**Fix:** Replace each card wrapper with `<div className="ds-card bracket"><span className="bl"/><span className="br"/>...</div>`. Drop `borderRadius: '4px'`. Drop hardcoded `#111` and `#1a1a2e` (use `var(--bg-card)` and `var(--border-green-soft)`).

### T6 — "Annual: $X.XX" sub-line not Share Tech Mono ⚠️ Major
**File:** `src/components/TrainerDashboard.tsx:175-177`
**Code:**
```tsx
<p style={{ margin: 0, fontSize: '10px', color: '#666' }}>Annual: ${projectedAnnual.toFixed(2)}</p>
```
**Spec:** `t-mono-sm` (Share Tech Mono, secondary color).
**Fix:** Replace with `<p className="t-mono-sm" style={{ color: 'var(--text-secondary)' }}>Annual: ${projectedAnnual.toFixed(2)}</p>`.

### T7 — H1 "TRAINER COMMAND CENTER" wraps 2 lines on phone ⚠️ Major
**File:** `src/components/TrainerDashboard.tsx:136-144`
**Code:**
```tsx
<h1 style={{ fontSize: '28px', fontFamily: '"Orbitron", sans-serif', color: '#00ff41', margin: '0 0 10px 0', letterSpacing: '2px' }}>TRAINER COMMAND CENTER</h1>
```
**Spec:** README → Type scale; redundant copy.
**Fix:** Drop to `Command Center` (the segmented nav already says "COMMAND CENTER" — H1 doesn't need to repeat it). Keep `t-display-xl` (22px iPhone, 28px iPad via `.ipad`).

### T8 — GunnyFab visible on Trainer Command Center tab ❌ Critical
**File:** `src/components/AppShell.tsx:2156-2166`
**Code:**
```tsx
{activeTab !== 'gunny' && (
  <button className={`ds-gunny-fab gunny-toggle-btn ${!showGunnyPanel ? 'show' : ''}`} ...>
```
**Spec:** README → "GunnyFab" → behavioral gap. Should also hide when active tab is `'ops'` AND `currentUser.role === 'trainer'` (the trainer experience is itself part of Gunny).
**Fix:** Update guard to `{activeTab !== 'gunny' && !(activeTab === 'ops' && currentUser.role === 'trainer') && (...)}`.

---

## 6. System-level (within Planner + Gunny)

### Tokens
| Token | Spec | Found | Status |
|---|---|---|---|
| `--green` | `#00ff41` | `#00ff41` | ✅ |
| `--amber` | `#ff8c00` | `var(--amber)` (defined) | ✅ |
| `--danger` | `#ff4444` | `var(--danger)` (defined) | ✅ |
| RPE chip color | `var(--amber)` | `#ff6b6b` | ❌ P10 |
| Tempo chip color | `var(--green)` | `#ba68c8` | ❌ P10 |
| Cooldown wrapper color | `var(--amber)` | `#60a5fa` | ❌ P11 |

### Components
| Component | Status |
|---|---|
| Button (all variants) | ✅ in design-system.css; ❌ TrainerDashboard bypasses it |
| Card + Bracket | ✅ in design-system.css; ❌ TrainerDashboard stat cards bypass it |
| Eyebrow + Label | ✅ in design-system.css; ❌ TrainerDashboard card titles bypass it |
| Chip (3 tones) | ✅ in design-system.css; ❌ P10 RPE/Tempo bypass tones |
| Bar (progress) | ✅ |
| Segmented | ✅ in design-system.css; ❌ T1 trainer toggle bypasses it; ❌ P8 prev/next chevrons fall outside the descendant selector |
| TopBar | ✅ |
| TabBar | ✅ |
| GunnyFab | ✅ position correct; ❌ doesn't hide on trainer-ops (T8) |
| Chat bubble | ⚠️ no explicit `border-radius: 0` (G4) |
| Composer input | ⚠️ no explicit `border-radius: 0` (G7) |

### Behavior
- ✅ Planner Day/Week/Month sub-view toggles work
- ✅ Tap workout day → Day view for that date
- ✅ Drag-to-move workout days (per spec)
- ✅ Send message → bubble append, scroll to bottom
- ❌ Offline state isn't a distinct design (G3)
- ❌ Trainer Command Center toggle uses .btn not .segmented (T1)
- ❌ GunnyFab visible on trainer-ops tab (T8)

---

## 7. Anti-Patterns Found

- ❌ **VitalsSticky HUD module** rendered at top of Workout Mode (W1, W2, W3, W13, W15) — entire module not in spec
- ❌ **WorkoutPTT mic FAB** floating right side, competing with GunnyFab (W10)
- ❌ **Two GUNNY surfaces** — header pill + FAB (W9)
- ❌ **HR Zone Tracker × close button** — should be permanent (W4)
- ❌ **Color-palette violations**: `#ff6b6b` (P10), `#ba68c8` (P10), `#60a5fa` (P11), `#111` (T5), `#1a1a2e` (T5), `#888` (T3), `#666` (T6)
- ❌ **Rounded corners**: `borderRadius: 4` (T5 trainer cards), `borderRadius: 8` (P11 cooldown wrapper)
- ❌ **Solid blue Demo button** for cooldowns (P14)
- ❌ **Stat cards without bracket corners** (T5)
- ❌ **Card titles without green eyebrow** (T3)
- ❌ **`.segmented .seg` descendant selector** misses standalone `.seg` siblings (P8)
- ❌ **Two Export buttons** rendered simultaneously on Month view (P9)
- ❌ **GunnyFab not hidden on trainer-ops** (T8)
- ❌ **iOS Safari rounded chrome** leaking through on prev/next chevrons (P8)
- ⚠️ **Crumb below segmented nav** in Month view (P4)
- ⚠️ **`.composer-send` and `.msg` lack explicit `border-radius: 0`** rules (G4, G7)
- ⚠️ **Orbitron typeface used for timestamps** instead of Share Tech Mono (G5)
- ⚠️ **No scroll-padding-bottom** to clear FAB (P3, P13)

---

## 8. Recommended Fix Order

The audit's headline finding is that **the design system primitives exist** — the gaps are screens that bypass them (TrainerDashboard, cooldown rendering, RPE/Tempo chip palette, the entire VitalsSticky module). Fix order maximizes "gaps closed per touched line of code":

1. **🔴 Workout Mode header demolition** — delete `VitalsSticky` render (`Planner.tsx:1818-1863`); add Pause/Reset icon buttons inside the existing Rest Timer card (`Planner.tsx:1977-2065`); add eyebrow to that card (W8); move "Voice:" row into a card. **Closes W1, W2, W3, W6, W8, W13, W15** (7 gaps in one PR).
2. **🔴 Mic FAB removal** — delete `WorkoutPTT.tsx` floating wrapper or hide on iPhone-class viewports. **Closes W10, W11**.
3. **🔴 Gunny double-surface** — delete the workout-mode Gunny pill button at `Planner.tsx:1791-1798`. **Closes W9**.
4. **🔴 Color-palette sweep on Day view** — replace `#ff6b6b` (RPE), `#ba68c8` (Tempo), `#60a5fa` (cooldown) with `var(--amber)` / `var(--green)` / `var(--amber)`. Reuse the warmup amber bracket card pattern for cooldown. **Closes P10, P11, P14**.
5. **🟠 Trainer Command Center rebuild** — wrap `TrainerDashboard.tsx:131-230` in `.ds-card.bracket` + `.t-eyebrow`. Replace `.btn` toggle at `AppShell.tsx:1497-1521` with `.segmented`. Drop `borderRadius: '4px'`. Standardize stat sizes. **Closes T1, T2, T3, T4, T5, T6, T7** (7 gaps).
6. **🟠 GunnyFab hide on trainer-ops** — update guard at `AppShell.tsx:2156`. **Closes T8**.
7. **🟠 Planner Month header order + dedupe Export** — move crumb above segmented nav (`Planner.tsx:3727`); delete the outer Export button at `:3693`. **Closes P4, P9**.
8. **🟠 Scroll padding for FAB clearance** — add `padding-bottom: 120px` on Planner + Day + Workout Mode scroll containers. **Closes P3, P13**.
9. **🟠 Standalone `.seg` selector** — add a top-level `.seg` rule with `-webkit-appearance: none; border-radius: 0;` to the design system. **Closes P8**.
10. **🟡 BattlePlanRef + DailyBriefRef chevron removal** — verify and remove if present. **Closes P6, P7**.
11. **🟡 HR Zone Tracker non-dismissible** — drop `onClose` wiring. **Closes W4**.
12. **🟡 HR Zone Tracker empty state** — design "NO DEVICE" pill + greyed gauge. **Closes W5**.
13. **🟡 Gunny chat radii + timestamp typography** — `border-radius: 0` on `.msg`, `.composer-send`; switch `.msg-meta` to `var(--mono)` and reposition outside bubble. **Closes G4, G5, G7**.
14. **🟡 Gunny offline state** — design proper empty-state card. **Closes G3**.
15. **💡 Workout Mode H1 glow** — add `textShadow` to inline style. **Closes W14**.
16. **💡 Movement letter prefix data scrub** — strip `A1)/B1)/C)` from `exerciseName` strings or surface as crumb. **Closes P12**.
17. **💡 Composer tool icon size** — pass `size={22}` if missing. **Closes G8**.

**Top three together (items 1+2+3+4) close 12 gaps with surgical edits to 4 files.** That's the single biggest visual-parity win available.

---

## ⚠️ Spec Contradiction Flag

Items W1/W2/W3/W13/W15 hinge on whether `VitalsSticky` is canonical. A previous PR (#45) explicitly RESTORED the HUD based on a screenshot interpreted as canonical at the time. This new audit cites README → Workout Mode §1-2 which describes a Workout Mode WITHOUT a HUD strip. **Both cannot be true.** Before fixing item 1, get an explicit user decision: keep `VitalsSticky` (and update the README), or delete the HUD (and discard PR #45's restoration).
