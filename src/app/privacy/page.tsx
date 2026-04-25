'use client';

// /privacy — standalone wrapper around the existing PrivacyPolicy modal
// component so the landing-page footer link has somewhere to land.
// onClose routes back to the landing.

import { useRouter } from 'next/navigation';
import { PrivacyPolicy } from '@/components/LegalPages';

export default function PrivacyRoute() {
  const router = useRouter();
  return <PrivacyPolicy onClose={() => router.push('/')} />;
}
