'use client';

/**
 * PersonaPicker
 * ────────────────────────────────────────────────────────────────────
 * Coach selection screen. Renders all four GUNS UP personas as cards
 * with full voice previews and sample dialogue. Persists selection
 * to the operator profile via the supplied onSelectPersona callback.
 *
 * USAGE:
 *
 *   import PersonaPicker from '@/components/PersonaPicker';
 *
 *   <PersonaPicker
 *     currentPersonaId={operator.personaId ?? 'gunny'}
 *     operatorAge={operator.profile?.age}
 *     onSelectPersona={(id) => {
 *       updateOperator({ ...operator, personaId: id });
 *     }}
 *   />
 *
 * INTEGRATION POINTS:
 *  - Used standalone as a settings screen ("Change your coach")
 *  - Used as an extra step in ClientOnboarding (step 1.5, after trainer
 *    selection) — pass `mode="onboarding"` to suppress the back nav
 *  - Hot-swappable: persona changes apply on next chat message; no
 *    re-onboarding required
 *
 * SAFETY:
 *  - If operatorAge is provided and < 18, only Coach is selectable.
 *    Other cards render disabled with a "Adults only — your coach is
 *    Coach" note. This mirrors the boundaries hardcoded into each
 *    persona's system prompt (server-side enforcement is the source of
 *    truth; this is just UX).
 *  - The recommendation banner reads recommendPersona() output and
 *    flags it visually but does not auto-select — the user always
 *    confirms.
 */

import React, { useMemo, useState } from 'react';
import {
  PERSONA_ORDER,
  PERSONAS,
  type PersonaId,
  type Persona,
  recommendPersona,
} from '@/lib/personas';

// ════════════════════════════════════════════════════════════════════
// THEME — matches existing GUNS UP design language
// (black-base, neon-green primary, Orbitron / Share Tech Mono / Chakra Petch)
// ════════════════════════════════════════════════════════════════════
const THEME = {
  bgBase: '#030303',
  bgSurface: '#080808',
  bgCard: '#0a0a0a',
  bgElevated: '#0e0e0e',
  borderDim: '#1a1a2e',
  borderSubtle: 'rgba(255,255,255,0.04)',
  textPrimary: '#e0e0e0',
  textSecondary: '#a0a0a0',
  textTertiary: '#707070',
  textDim: '#4a4a4a',
  green: '#00ff41',
  amber: '#FF8C00',
  danger: '#ff4444',
  fontDisplay: '"Orbitron", sans-serif',
  fontMono: '"Share Tech Mono", monospace',
  fontBody: '"Chakra Petch", sans-serif',
};

// ════════════════════════════════════════════════════════════════════
// PROPS
// ════════════════════════════════════════════════════════════════════
export interface PersonaPickerProps {
  /** Currently selected persona — used to mark the active card */
  currentPersonaId: PersonaId;
  /** Operator's age — drives under-18 safety routing */
  operatorAge?: number;
  /** Operator's gender — feeds the recommendation engine (optional) */
  operatorGender?: 'male' | 'female' | 'other';
  /** Operator's fitness level — feeds the recommendation engine */
  operatorFitnessLevel?: 'beginner' | 'intermediate' | 'advanced' | 'elite';
  /** Callback when a persona is confirmed */
  onSelectPersona: (id: PersonaId) => void;
  /** Render mode — full screen vs. embedded in onboarding flow */
  mode?: 'standalone' | 'onboarding';
  /** Callback for the back nav (standalone mode only) */
  onBack?: () => void;
}

// ════════════════════════════════════════════════════════════════════
// COMPONENT
// ════════════════════════════════════════════════════════════════════
const PersonaPicker: React.FC<PersonaPickerProps> = ({
  currentPersonaId,
  operatorAge,
  operatorGender,
  operatorFitnessLevel,
  onSelectPersona,
  mode = 'standalone',
  onBack,
}) => {
  // Selected card on screen (not yet confirmed)
  const [previewId, setPreviewId] = useState<PersonaId>(currentPersonaId);
  const previewPersona = PERSONAS[previewId];

  // Auto-recommendation (just for highlighting, never auto-select)
  const recommendedId = useMemo(
    () =>
      recommendPersona({
        age: operatorAge,
        gender: operatorGender,
        fitnessLevel: operatorFitnessLevel,
      }),
    [operatorAge, operatorGender, operatorFitnessLevel]
  );

  // Under-18 lockdown — only Coach selectable
  const isMinor = operatorAge !== undefined && operatorAge < 18;

  const isCardLocked = (id: PersonaId): boolean => {
    if (isMinor && id !== 'coach') return true;
    return false;
  };

  const handleConfirm = () => {
    if (isCardLocked(previewId)) return;
    onSelectPersona(previewId);
  };

  return (
    <div
      style={{
        minHeight: mode === 'standalone' ? '100vh' : 'auto',
        background: THEME.bgBase,
        color: THEME.textPrimary,
        fontFamily: THEME.fontBody,
        padding: '24px 16px 48px',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* ═══ HEADER ═══ */}
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 8,
            }}
          >
            <span
              style={{
                width: 18,
                height: 1,
                background: THEME.green,
                boxShadow: `0 0 6px ${THEME.green}`,
              }}
            />
            <span
              style={{
                fontFamily: THEME.fontDisplay,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '3.5px',
                textTransform: 'uppercase',
                color: THEME.green,
              }}
            >
              // SELECT YOUR COACH
            </span>
          </div>
          <h1
            style={{
              fontFamily: THEME.fontDisplay,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: 2,
              color: THEME.textPrimary,
              margin: '0 0 8px',
            }}
          >
            Pick your <span style={{ color: THEME.green, fontStyle: 'italic' }}>operator</span>.
          </h1>
          <p
            style={{
              fontFamily: THEME.fontBody,
              fontSize: 14,
              color: THEME.textSecondary,
              margin: 0,
              maxWidth: 720,
              lineHeight: 1.55,
            }}
          >
            Four AI coaches. Same Claude Opus engine. Different voices, different registers, same standard.
            You can change your coach anytime — your training data carries over.
          </p>

          {/* Minor lockdown banner */}
          {isMinor && (
            <div
              style={{
                marginTop: 16,
                padding: '10px 14px',
                background: 'rgba(59, 130, 246, 0.06)',
                border: `1px solid ${PERSONAS.coach.accentColor}40`,
                borderLeft: `3px solid ${PERSONAS.coach.accentColor}`,
                fontFamily: THEME.fontMono,
                fontSize: 12,
                color: THEME.textPrimary,
                letterSpacing: '0.5px',
              }}
            >
              <span style={{ color: PERSONAS.coach.accentColor, fontWeight: 700 }}>
                AGE-LOCKED:
              </span>{' '}
              Operators under 18 train with COACH. Adult coaches unlock at 18+.
            </div>
          )}
        </div>

        {/* ═══ PERSONA CARD GRID ═══ */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
            marginBottom: 24,
          }}
        >
          {PERSONA_ORDER.map((id) => {
            const persona = PERSONAS[id];
            const isPreview = previewId === id;
            const isActive = currentPersonaId === id;
            const isRecommended = recommendedId === id && !isActive;
            const locked = isCardLocked(id);

            return (
              <PersonaCard
                key={id}
                persona={persona}
                isPreview={isPreview}
                isActive={isActive}
                isRecommended={isRecommended}
                locked={locked}
                onClick={() => !locked && setPreviewId(id)}
              />
            );
          })}
        </div>

        {/* ═══ DETAIL PANEL — preview of selected card ═══ */}
        <PersonaDetail persona={previewPersona} locked={isCardLocked(previewId)} />

        {/* ═══ ACTION BAR ═══ */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            marginTop: 24,
            paddingTop: 16,
            borderTop: `1px solid ${THEME.borderSubtle}`,
          }}
        >
          {mode === 'standalone' && onBack ? (
            <button
              onClick={onBack}
              style={{
                padding: '10px 20px',
                background: 'transparent',
                border: `1px solid ${THEME.borderDim}`,
                color: THEME.textSecondary,
                fontFamily: THEME.fontDisplay,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: 'uppercase',
                cursor: 'pointer',
                borderRadius: 3,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = THEME.green;
                e.currentTarget.style.color = THEME.green;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = THEME.borderDim;
                e.currentTarget.style.color = THEME.textSecondary;
              }}
            >
              ← BACK
            </button>
          ) : (
            <span />
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {currentPersonaId === previewId && (
              <span
                style={{
                  fontFamily: THEME.fontMono,
                  fontSize: 11,
                  color: THEME.textTertiary,
                  letterSpacing: 1,
                }}
              >
                CURRENT COACH
              </span>
            )}

            <button
              onClick={handleConfirm}
              disabled={isCardLocked(previewId) || currentPersonaId === previewId}
              style={{
                padding: '12px 28px',
                background:
                  isCardLocked(previewId) || currentPersonaId === previewId
                    ? '#1a1a1a'
                    : previewPersona.accentColor,
                color:
                  isCardLocked(previewId) || currentPersonaId === previewId
                    ? '#444'
                    : '#000',
                border: 'none',
                borderRadius: 3,
                fontFamily: THEME.fontDisplay,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                cursor:
                  isCardLocked(previewId) || currentPersonaId === previewId
                    ? 'not-allowed'
                    : 'pointer',
                transition: 'all 0.2s',
                boxShadow:
                  isCardLocked(previewId) || currentPersonaId === previewId
                    ? 'none'
                    : `0 0 18px ${previewPersona.accentColor}40`,
              }}
              onMouseEnter={(e) => {
                if (!isCardLocked(previewId) && currentPersonaId !== previewId) {
                  e.currentTarget.style.boxShadow = `0 0 24px ${previewPersona.accentColor}80`;
                }
              }}
              onMouseLeave={(e) => {
                if (!isCardLocked(previewId) && currentPersonaId !== previewId) {
                  e.currentTarget.style.boxShadow = `0 0 18px ${previewPersona.accentColor}40`;
                }
              }}
            >
              {currentPersonaId === previewId
                ? 'ALREADY YOUR COACH'
                : `DEPLOY ${previewPersona.callsign}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════
// PERSONA CARD — compact selection card in the grid
// ════════════════════════════════════════════════════════════════════
interface PersonaCardProps {
  persona: Persona;
  isPreview: boolean;
  isActive: boolean;
  isRecommended: boolean;
  locked: boolean;
  onClick: () => void;
}

const PersonaCard: React.FC<PersonaCardProps> = ({
  persona,
  isPreview,
  isActive,
  isRecommended,
  locked,
  onClick,
}) => {
  const [hover, setHover] = useState(false);

  // Border priority: preview > active > hover > rest
  const borderColor = locked
    ? THEME.borderDim
    : isPreview
    ? persona.accentColor
    : isActive
    ? `${persona.accentColor}80`
    : hover
    ? `${persona.accentColor}80`
    : THEME.borderDim;

  const borderWidth = isPreview ? 2 : 1;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => !locked && setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        padding: 16,
        background: THEME.bgCard,
        border: `${borderWidth}px solid ${borderColor}`,
        borderRadius: 4,
        cursor: locked ? 'not-allowed' : 'pointer',
        opacity: locked ? 0.4 : 1,
        transition: 'all 0.2s',
        boxShadow: isPreview ? `0 0 18px ${persona.accentColor}33` : 'none',
        minHeight: 200,
      }}
    >
      {/* Bracket corners — matches landing page aesthetic */}
      <span
        style={{
          position: 'absolute',
          top: -1,
          left: -1,
          width: 10,
          height: 10,
          borderTop: `2px solid ${persona.accentColor}`,
          borderLeft: `2px solid ${persona.accentColor}`,
          opacity: isPreview || isActive ? 1 : 0.3,
        }}
      />
      <span
        style={{
          position: 'absolute',
          bottom: -1,
          right: -1,
          width: 10,
          height: 10,
          borderBottom: `2px solid ${persona.accentColor}`,
          borderRight: `2px solid ${persona.accentColor}`,
          opacity: isPreview || isActive ? 1 : 0.3,
        }}
      />

      {/* Status pill — top right */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          alignItems: 'flex-end',
        }}
      >
        {isActive && (
          <span
            style={{
              padding: '2px 6px',
              background: `${persona.accentColor}22`,
              border: `1px solid ${persona.accentColor}50`,
              color: persona.accentColor,
              fontFamily: THEME.fontMono,
              fontSize: 9,
              letterSpacing: 1,
              borderRadius: 2,
            }}
          >
            ACTIVE
          </span>
        )}
        {isRecommended && !isActive && (
          <span
            style={{
              padding: '2px 6px',
              background: 'rgba(255, 184, 0, 0.1)',
              border: '1px solid rgba(255, 184, 0, 0.4)',
              color: '#ffb800',
              fontFamily: THEME.fontMono,
              fontSize: 9,
              letterSpacing: 1,
              borderRadius: 2,
            }}
          >
            RECOMMENDED
          </span>
        )}
        {locked && (
          <span
            style={{
              padding: '2px 6px',
              background: 'rgba(255,68,68,0.08)',
              border: '1px solid rgba(255,68,68,0.3)',
              color: THEME.danger,
              fontFamily: THEME.fontMono,
              fontSize: 9,
              letterSpacing: 1,
              borderRadius: 2,
            }}
          >
            LOCKED
          </span>
        )}
      </div>

      {/* Callsign */}
      <div
        style={{
          fontFamily: THEME.fontDisplay,
          fontSize: 18,
          fontWeight: 700,
          color: persona.accentColor,
          letterSpacing: 2,
          marginBottom: 4,
          marginTop: 8,
        }}
      >
        {persona.callsign}
      </div>

      {/* Rank tagline */}
      <div
        style={{
          fontFamily: THEME.fontMono,
          fontSize: 10,
          color: THEME.textTertiary,
          letterSpacing: 0.5,
          marginBottom: 10,
        }}
      >
        // {persona.rankTagline}
      </div>

      {/* Positioning line */}
      <div
        style={{
          fontFamily: THEME.fontBody,
          fontSize: 13,
          color: THEME.textPrimary,
          fontStyle: 'italic',
          marginBottom: 10,
          lineHeight: 1.4,
        }}
      >
        {persona.positioningLine}
      </div>

      {/* Short bio */}
      <p
        style={{
          fontFamily: THEME.fontBody,
          fontSize: 12,
          color: THEME.textSecondary,
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        {persona.shortBio}
      </p>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════
// PERSONA DETAIL — expanded preview of currently selected card
// ════════════════════════════════════════════════════════════════════
interface PersonaDetailProps {
  persona: Persona;
  locked: boolean;
}

const PersonaDetail: React.FC<PersonaDetailProps> = ({ persona, locked }) => {
  const [activeTab, setActiveTab] = useState<'voice' | 'first' | 'tired' | 'pr'>(
    'voice'
  );

  const samples: Record<typeof activeTab, { label: string; text: string }> = {
    voice: { label: 'VOICE PREVIEW', text: persona.voicePreview },
    first: { label: 'FIRST SESSION', text: persona.sampleDialogue.firstSession },
    tired: { label: '"I AM TIRED"', text: persona.sampleDialogue.userTired },
    pr: { label: 'YOU HIT A PR', text: persona.sampleDialogue.userPRs },
  };

  return (
    <div
      style={{
        background: THEME.bgSurface,
        border: `1px solid ${persona.accentColor}40`,
        borderLeft: `3px solid ${persona.accentColor}`,
        borderRadius: 4,
        padding: 20,
        opacity: locked ? 0.5 : 1,
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: THEME.fontMono,
              fontSize: 11,
              color: THEME.textTertiary,
              letterSpacing: 1,
              marginBottom: 4,
            }}
          >
            // PERSONA DOSSIER
          </div>
          <h2
            style={{
              fontFamily: THEME.fontDisplay,
              fontSize: 22,
              fontWeight: 700,
              color: persona.accentColor,
              letterSpacing: 2,
              margin: 0,
            }}
          >
            {persona.callsign}{' '}
            <span
              style={{
                fontSize: 12,
                color: THEME.textSecondary,
                letterSpacing: 1.5,
                fontWeight: 500,
              }}
            >
              · {persona.rankTagline}
            </span>
          </h2>
        </div>

        {/* Profanity meter */}
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontFamily: THEME.fontMono,
              fontSize: 9,
              color: THEME.textTertiary,
              letterSpacing: 1,
              marginBottom: 4,
            }}>
            PROFANITY LEVEL
          </div>
          <ProfanityMeter level={persona.profanityLevel} accent={persona.accentColor} />
        </div>
      </div>

      {/* Backstory */}
      <div style={{ marginBottom: 18 }}>
        <div
          style={{
            fontFamily: THEME.fontDisplay,
            fontSize: 11,
            color: persona.accentColor,
            letterSpacing: 2,
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          BACKGROUND
        </div>
        <p
          style={{
            fontFamily: THEME.fontBody,
            fontSize: 13,
            color: THEME.textPrimary,
            lineHeight: 1.65,
            margin: 0,
          }}
        >
          {persona.longBackstory}
        </p>
      </div>

      {/* Audience */}
      <div style={{ marginBottom: 18 }}>
        <div
          style={{
            fontFamily: THEME.fontDisplay,
            fontSize: 11,
            color: persona.accentColor,
            letterSpacing: 2,
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          BUILT FOR
        </div>
        <p
          style={{
            fontFamily: THEME.fontBody,
            fontSize: 13,
            color: THEME.textSecondary,
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {persona.targetUser}
        </p>
      </div>

      {/* Catchphrases */}
      <div style={{ marginBottom: 18 }}>
        <div
          style={{
            fontFamily: THEME.fontDisplay,
            fontSize: 11,
            color: persona.accentColor,
            letterSpacing: 2,
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          SIGNATURE LINES
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {persona.catchphrases.slice(0, 6).map((line, i) => (
            <span
              key={i}
              style={{
                padding: '6px 10px',
                background: THEME.bgCard,
                border: `1px solid ${persona.accentColor}30`,
                fontFamily: THEME.fontMono,
                fontSize: 11,
                color: THEME.textPrimary,
                letterSpacing: 0.3,
                borderRadius: 2,
              }}
            >
              "{line}"
            </span>
          ))}
        </div>
      </div>

      {/* Dialogue tabs */}
      <div>
        <div
          style={{
            fontFamily: THEME.fontDisplay,
            fontSize: 11,
            color: persona.accentColor,
            letterSpacing: 2,
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          HOW {persona.callsign} TALKS
        </div>
        <div
          style={{
            display: 'flex',
            gap: 4,
            marginBottom: 10,
            flexWrap: 'wrap',
          }}
        >
          {(Object.keys(samples) as Array<keyof typeof samples>).map((key) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                style={{
                  padding: '6px 12px',
                  background: isActive ? `${persona.accentColor}15` : 'transparent',
                  border: `1px solid ${
                    isActive ? persona.accentColor : THEME.borderDim
                  }`,
                  color: isActive ? persona.accentColor : THEME.textSecondary,
                  fontFamily: THEME.fontDisplay,
                  fontSize: 9,
                  letterSpacing: 1,
                  fontWeight: 700,
                  cursor: 'pointer',
                  borderRadius: 2,
                  transition: 'all 0.15s',
                }}
              >
                {samples[key].label}
              </button>
            );
          })}
        </div>
        <div
          style={{
            padding: 14,
            background: THEME.bgCard,
            border: `1px solid ${THEME.borderDim}`,
            borderLeft: `3px solid ${persona.accentColor}`,
            borderRadius: 2,
            fontFamily: THEME.fontMono,
            fontSize: 13,
            color: THEME.textPrimary,
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
            minHeight: 80,
          }}
        >
          {samples[activeTab].text}
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════
// PROFANITY METER — visual profanity register indicator
// ════════════════════════════════════════════════════════════════════
const ProfanityMeter: React.FC<{
  level: 'none' | 'mild' | 'surgical' | 'heavy';
  accent: string;
}> = ({ level, accent }) => {
  const filled =
    level === 'none' ? 0 : level === 'mild' ? 1 : level === 'surgical' ? 2 : 3;
  const labels = {
    none: 'CLEAN',
    mild: 'MILD',
    surgical: 'SURGICAL',
    heavy: 'HEAVY',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ display: 'flex', gap: 2 }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 18,
              height: 4,
              background: i < filled ? accent : THEME.borderDim,
              borderRadius: 1,
              transition: 'all 0.2s',
            }}
          />
        ))}
      </div>
      <span
        style={{
          fontFamily: THEME.fontMono,
          fontSize: 10,
          color: THEME.textPrimary,
          letterSpacing: 1,
        }}
      >
        {labels[level]}
      </span>
    </div>
  );
};

export default PersonaPicker;
