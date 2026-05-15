import type { Metadata, Viewport } from "next";
import "./globals.css";
// Design-system tokens + utility classes (.btn, .ds-card, .bracket,
// .t-eyebrow, .field, .chip, etc.) ported from the App Redesign handoff.
// Loaded after globals.css so its tokens take precedence on overlapping
// names (e.g. --green-bright, --amber). See src/styles/design-system.css
// for the canonical color/type/spacing scale.
import "@/styles/design-system.css";
import { LanguageProvider } from "@/lib/i18n";

// SEO + social-share metadata. Logged-out visitors at `/` see the marketing
// landing page, so this applies to public discovery (Google, Twitter, FB, etc).
// Authed users see AppShell where these tags don't matter — their flow is
// private. If we add tier-specific or campaign-specific landings later, give
// them their own layout with overriding metadata.
//
// i18n (Phase 5): Next.js metadata is server-rendered, so the client
// `useLanguage` hook is not available here. Strategy:
//   - Primary tags stay English (matches the `<html lang="en">` default
//     until the client toggle flips it). Spanish-speaking searchers
//     using Google still match because Google indexes the rendered DOM
//     after the client hydrates.
//   - `alternates.languages` advertises the Spanish version via hreflang
//     so search engines that respect the tag can serve the right listing
//     (rendered ES strings live in src/lib/i18n.tsx under `seo.*`).
//   - Spanish copy is keyword-aware ("entrenador personal IA", "rutinas
//     de gimnasio IA") so it stays searchable, not literal.
//
// Known gap: a true server-side ES landing would need either a /es/ route
// segment (Next.js i18n routing) or middleware-level locale detection. We
// don't have either yet — the ES title/description below are baked in
// here as static fallbacks for the hreflang tag, not served from a
// separate route. That's tracked as a follow-up ("Spanish-locale route
// segment for SEO parity").
const SITE_URL = 'https://gunnyai.fit';
const TITLE_EN = 'GUNS UP — Military-precision fitness. AI-powered training.';
const DESCRIPTION_EN =
  'Your personal AI operator (Gunny) knows every rep, every meal, every PR, every injury. ' +
  'Built on Claude. USMC discipline + 16 expert sources. Start at $2/mo.';
const TITLE_ES = 'GUNS UP — Fitness con precisión militar. Entrenador personal IA.';
const DESCRIPTION_ES =
  'Tu operador IA personal (Gunny) conoce cada repetición, cada comida, cada PR, cada lesión. ' +
  'Rutinas de gimnasio IA construidas sobre Claude. Disciplina USMC + 16 fuentes expertas. Desde $2/mes.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE_EN,
    template: '%s · GUNS UP',
  },
  description: DESCRIPTION_EN,
  manifest: '/manifest.json',
  applicationName: 'GUNS UP',
  keywords: [
    'AI personal trainer',
    'AI fitness coach',
    'Claude AI fitness',
    'tactical workout app',
    'Gunny AI',
    'AI workout planner',
    'macro tracking AI',
    'crossfit AI',
    'bodybuilding AI',
    'military fitness',
    // Spanish-keyword surface area for ES searchers
    'entrenador personal IA',
    'rutinas de gimnasio IA',
    'app de fitness con IA',
    'macros con IA',
    'fitness militar',
  ],
  authors: [{ name: 'GUNS UP FITNESS' }],
  alternates: {
    canonical: SITE_URL,
    languages: {
      'en-US': SITE_URL,
      'es-US': SITE_URL,
    },
  },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'GUNS UP',
    title: TITLE_EN,
    description: DESCRIPTION_EN,
    locale: 'en_US',
    alternateLocale: ['es_US'],
    images: [
      {
        url: '/logo-glow.png',
        width: 749,
        height: 666,
        alt: 'GUNS UP — Gunny AI',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE_EN,
    description: DESCRIPTION_EN,
    images: ['/logo-glow.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'GUNS UP',
  },
  // Other tools (e.g. social cards, RSS preview generators) sometimes pick
  // up `other.title-es` as a hint; harmless for browsers that don't.
  other: {
    'title:es': TITLE_ES,
    'description:es': DESCRIPTION_ES,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#030303",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@300;400;500;600;700&family=Orbitron:wght@400;500;600;700;800;900&family=Share+Tech+Mono:wght@400&display=swap"
          rel="stylesheet"
        />
        <link rel="apple-touch-icon" href="/logo-glow.png" />
      </head>
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
