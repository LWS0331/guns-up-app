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
const SITE_URL = 'https://gunnyai.fit';
const TITLE = 'GUNS UP — Military-precision fitness. AI-powered training.';
const DESCRIPTION =
  'Your personal AI operator (Gunny) knows every rep, every meal, every PR, every injury. ' +
  'Built on Claude. USMC discipline + 16 expert sources. Start at $2/mo.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: '%s · GUNS UP',
  },
  description: DESCRIPTION,
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
  ],
  authors: [{ name: 'GUNS UP FITNESS' }],
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'GUNS UP',
    title: TITLE,
    description: DESCRIPTION,
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
    title: TITLE,
    description: DESCRIPTION,
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
