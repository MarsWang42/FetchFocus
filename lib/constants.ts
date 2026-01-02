import type { Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
    aiEnabled: false,
};

export const NUDGE_COOLDOWN = 30000; // 30 seconds between nudges
export const TAB_SWITCH_THRESHOLD = 10; // 10 unique tabs
export const TAB_SWITCH_WINDOW = 60000; // 1 minute window

export const STORAGE_KEYS = {
    TODOS: 'mindful_nudge_todos',
    SETTINGS: 'mindful_nudge_settings',
    LAST_NUDGE: 'mindful_nudge_last_nudge',
    CURRENT_FOCUS: 'mindful_nudge_current_focus',
    KEYWORD_HISTORY: 'mindful_nudge_keyword_history',
    RECENT_URLS: 'mindful_nudge_recent_urls',
    CHECKED_URLS: 'mindful_nudge_checked_urls',
    BLACKLIST: 'mindful_nudge_blacklist',
    WHITELIST: 'mindful_nudge_whitelist',
    COMPLETED_TASKS: 'mindful_nudge_completed_tasks',
    BYPASSED_TABS: 'mindful_nudge_bypassed_tabs', // Tabs that bypassed blacklist warning
} as const;
