/**
 * Video URL utilities for Guns Up workout mode.
 * Converts YouTube watch / shorts / search URLs into embeddable iframe URLs.
 */

export type VideoSource =
  | { kind: 'youtube'; embedUrl: string; videoId: string }
  | { kind: 'search'; embedUrl: null; searchQuery: string; originalUrl: string }
  | { kind: 'unknown'; embedUrl: null; originalUrl: string };

/**
 * Extract YouTube video ID from common URL formats.
 * Returns null if the URL is not a direct YouTube video.
 */
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  try {
    // Handle youtu.be short links
    const shortMatch = url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
    if (shortMatch) return shortMatch[1];

    // Handle /shorts/ID
    const shortsMatch = url.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/);
    if (shortsMatch) return shortsMatch[1];

    // Handle /embed/ID
    const embedMatch = url.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/);
    if (embedMatch) return embedMatch[1];

    // Handle watch?v=ID
    const watchMatch = url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
    if (watchMatch) return watchMatch[1];
  } catch {
    return null;
  }
  return null;
}

/**
 * Detect YouTube search URL (e.g. /results?search_query=...).
 * These CANNOT be embedded — we have to handle them differently in the modal.
 */
export function extractSearchQuery(url: string): string | null {
  if (!url) return null;
  const m = url.match(/[?&]search_query=([^&]+)/);
  if (m) {
    try {
      return decodeURIComponent(m[1].replace(/\+/g, ' '));
    } catch {
      return m[1];
    }
  }
  return null;
}

/**
 * Convert any URL-ish input into an embeddable video source descriptor.
 * Use with VideoModal.
 */
export function convertToEmbedUrl(url: string): VideoSource {
  if (!url) return { kind: 'unknown', embedUrl: null, originalUrl: url };

  const videoId = extractYouTubeId(url);
  if (videoId) {
    return {
      kind: 'youtube',
      videoId,
      // playsinline=1 + modestbranding + rel=0 for cleaner embed on iOS
      embedUrl: `https://www.youtube.com/embed/${videoId}?playsinline=1&modestbranding=1&rel=0&autoplay=1`,
    };
  }

  const searchQuery = extractSearchQuery(url);
  if (searchQuery) {
    return {
      kind: 'search',
      embedUrl: null,
      searchQuery,
      originalUrl: url,
    };
  }

  return { kind: 'unknown', embedUrl: null, originalUrl: url };
}

/**
 * Build a deterministic YouTube search URL from an exercise name.
 * Used when an exercise doesn't have a curated video ID.
 */
export function buildSearchUrl(exerciseName: string): string {
  const q = encodeURIComponent(`${exerciseName} proper form`);
  return `https://www.youtube.com/results?search_query=${q}`;
}
