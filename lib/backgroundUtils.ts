import type { ResearchPage } from './types';

/**
 * Extract base URL (origin + pathname) from a full URL
 */
export function getBaseUrl(url: string): string {
    try {
        const parsed = new URL(url);
        return `${parsed.origin}${parsed.pathname}`;
    } catch {
        return url;
    }
}

/**
 * Query parameters that are significant for identifying content changes on specific sites.
 * These params will be preserved when comparing URLs for context detection.
 */
const SIGNIFICANT_QUERY_PARAMS: Record<string, string[]> = {
    'youtube.com': ['v', 'list'],
    'www.youtube.com': ['v', 'list'],
    'google.com': ['q'],
    'www.google.com': ['q'],
    'bing.com': ['q'],
    'www.bing.com': ['q'],
    'duckduckgo.com': ['q'],
    'amazon.com': ['dp', 'asin'],
    'www.amazon.com': ['dp', 'asin'],
};

/**
 * Extract a context-aware URL that preserves significant query parameters.
 * Unlike getBaseUrl, this keeps query params that identify different content
 * (e.g., YouTube's ?v= for different videos).
 */
export function getContextUrl(url: string): string {
    try {
        const parsed = new URL(url);
        const baseUrl = `${parsed.origin}${parsed.pathname}`;
        const significantParams = SIGNIFICANT_QUERY_PARAMS[parsed.hostname];

        if (significantParams) {
            const preserved = new URLSearchParams();
            for (const param of significantParams) {
                if (parsed.searchParams.has(param)) {
                    preserved.set(param, parsed.searchParams.get(param)!);
                }
            }
            if (preserved.toString()) {
                return `${baseUrl}?${preserved.toString()}`;
            }
        }
        return baseUrl;
    } catch {
        return url;
    }
}

/**
 * Check if two titles are related based on word overlap
 * Returns true if at least 2 significant words (>3 chars) overlap
 */
export function areTitlesRelated(title1: string, title2: string): boolean {
    const normalize = (s: string) =>
        s
            .toLowerCase()
            .replace(/[^a-z0-9]/g, ' ')
            .split(/\s+/)
            .filter(Boolean);
    const words1 = new Set(normalize(title1));
    const words2 = normalize(title2);

    // Check if any significant words overlap
    const overlap = words2.filter((w) => words1.has(w) && w.length > 3).length;
    return overlap >= 2;
}

/**
 * Check if a URL is in the research pages whitelist
 */
export function isInResearchPages(
    url: string,
    researchPages?: ResearchPage[]
): boolean {
    if (!researchPages || researchPages.length === 0) return false;
    try {
        const currentBaseUrl = getBaseUrl(url);
        return researchPages.some((page) => getBaseUrl(page.url) === currentBaseUrl);
    } catch {
        return false;
    }
}

/**
 * Get the language for AI responses based on browser locale
 * Returns 'Chinese (简体中文)' for zh locales, 'English' otherwise
 */
export function getAIResponseLanguage(locale: string): string {
    if (locale.startsWith('zh')) {
        return 'Chinese (简体中文)';
    }
    return 'English';
}

/**
 * Icon paths for different states
 */
export const ICON_PATHS = {
    idle: {
        16: 'icon/idle-16.png',
        32: 'icon/idle-32.png',
        48: 'icon/idle-48.png',
        128: 'icon/idle-128.png',
    },
    focused: {
        16: 'icon/focused-16.png',
        32: 'icon/focused-32.png',
        48: 'icon/focused-48.png',
        128: 'icon/focused-128.png',
    },
} as const;

export type IconState = keyof typeof ICON_PATHS;
