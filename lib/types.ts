export interface Todo {
    id: string;
    text: string;
    completed: boolean;
    keywords?: string[]; // Keywords used with this todo during focus sessions
}

export interface Settings {
    aiEnabled: boolean;
}

export interface ResearchPage {
    url: string;
    title: string;
    summary?: string;
    timestamp: number;
}

export interface URLVisit {
    tabId: number;
    url: string;
    title: string;
    timestamp: number;
    content?: string;
}

export interface FocusSession {
    originTabId?: number;
    originWindowId?: number;
    pageTitle?: string;
    pageUrl?: string;
    faviconUrl?: string; // Favicon URL for display in nudges
    description?: string; // User provided focus description
    keywords?: string[]; // User provided focus keywords
    contentSummary?: string; // AI-generated summary for comparison
    researchPages?: ResearchPage[]; // Whitelisted pages marked as research
    startTime: number;
}

export interface KeywordEntry {
    keyword: string;
    count: number;
    lastUsed: number;
}

export interface StorageData {
    todos: Todo[];
    settings: Settings;
    lastNudge: number;
    recentURLs?: URLVisit[];
}

export interface ScrollState {
    lastPosition: number;
    lastTime: number;
    velocitySum: number;
    sampleCount: number;
    highVelocityStart: number | null;
}

export interface ContentAnalysis {
    category: 'educational' | 'engagement-bait' | 'neutral';
    confidence: number;
}

// Chrome Built-in AI types are provided by @types/dom-chromium-ai

export interface BlacklistEntry {
    pattern: string; // URL pattern or domain (e.g., "twitter.com", "*.reddit.com")
    addedAt: number;
}

export interface WhitelistEntry {
    pattern: string; // URL pattern or domain
    addedAt: number;
}

export interface CompletedTask {
    id: string;
    taskName: string;
    completedAt: number; // timestamp
    focusDurationMs?: number; // how long the focus session lasted
}
