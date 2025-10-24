'use client';

import { useSearchParams } from 'next/navigation';

/**
 * Extracts query string from URL for preserving across navigation
 * Used inside Suspense boundary to handle useSearchParams
 */
export function QueryPreserver() {
  const searchParams = useSearchParams();
  
  try {
    const inIframe = typeof window !== 'undefined' && window.self !== window.top;
    const hasParams = searchParams && Array.from(searchParams.keys()).length > 0;
    if (inIframe && hasParams) {
      const qs = searchParams.toString();
      return qs ? `?${qs}` : '';
    }
  } catch {
    // ignore cross-origin checks
  }
  
  return '';
}
