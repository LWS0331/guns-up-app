'use client';

// /terms — standalone wrapper around the existing TermsOfService modal
// component so the landing-page footer link has somewhere to land.

import { useRouter } from 'next/navigation';
import { TermsOfService } from '@/components/LegalPages';

export default function TermsRoute() {
  const router = useRouter();
  return <TermsOfService onClose={() => router.push('/')} />;
}
