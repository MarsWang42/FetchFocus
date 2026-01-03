import { browser } from 'wxt/browser';
import type { Todo, Settings, FocusSession, KeywordEntry, URLVisit, BlacklistEntry, WhitelistEntry, CompletedTask } from './types';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from './constants';


export const storage = {
    async getTodos(): Promise<Todo[]> {
        const result = await browser.storage.local.get(STORAGE_KEYS.TODOS);
        return (result[STORAGE_KEYS.TODOS] as Todo[]) || [];
    },

    async setTodos(todos: Todo[]): Promise<void> {
        await browser.storage.local.set({ [STORAGE_KEYS.TODOS]: todos });
    },

    async getSettings(): Promise<Settings> {
        const result = await browser.storage.local.get(STORAGE_KEYS.SETTINGS);
        return (result[STORAGE_KEYS.SETTINGS] as Settings) || DEFAULT_SETTINGS;
    },

    async setSettings(settings: Settings): Promise<void> {
        await browser.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
    },

    async getLastNudge(): Promise<number> {
        const result = await browser.storage.local.get(STORAGE_KEYS.LAST_NUDGE);
        return (result[STORAGE_KEYS.LAST_NUDGE] as number) || 0;
    },

    async setLastNudge(timestamp: number): Promise<void> {
        await browser.storage.local.set({ [STORAGE_KEYS.LAST_NUDGE]: timestamp });
    },


    onTodosChange(callback: (todos: Todo[]) => void): () => void {
        const listener = (
            changes: { [key: string]: chrome.storage.StorageChange },
            areaName: string
        ) => {
            if (areaName === 'local' && STORAGE_KEYS.TODOS in changes) {
                callback((changes[STORAGE_KEYS.TODOS].newValue as Todo[]) || []);
            }
        };
        browser.storage.onChanged.addListener(listener);
        return () => browser.storage.onChanged.removeListener(listener);
    },

    onSettingsChange(callback: (settings: Settings) => void): () => void {
        const listener = (
            changes: { [key: string]: chrome.storage.StorageChange },
            areaName: string
        ) => {
            if (areaName === 'local' && STORAGE_KEYS.SETTINGS in changes) {
                callback((changes[STORAGE_KEYS.SETTINGS].newValue as Settings) || DEFAULT_SETTINGS);
            }
        };
        browser.storage.onChanged.addListener(listener);
        return () => browser.storage.onChanged.removeListener(listener);
    },

    async getCurrentFocus(): Promise<FocusSession | null> {
        const result = await browser.storage.local.get(STORAGE_KEYS.CURRENT_FOCUS);
        const currentFocus = result[STORAGE_KEYS.CURRENT_FOCUS];
        return currentFocus ? (currentFocus as FocusSession) : null;
    },

    async setCurrentFocus(currentFocus: FocusSession | null): Promise<void> {
        if (currentFocus === null) {
            await browser.storage.local.remove(STORAGE_KEYS.CURRENT_FOCUS);
        } else {
            await browser.storage.local.set({ [STORAGE_KEYS.CURRENT_FOCUS]: currentFocus });
        }
    },

    onCurrentFocusChange(callback: (currentFocus: FocusSession | null) => void): () => void {
        const listener = (
            changes: { [key: string]: chrome.storage.StorageChange },
            areaName: string
        ) => {
            if (areaName === 'local' && STORAGE_KEYS.CURRENT_FOCUS in changes) {
                callback((changes[STORAGE_KEYS.CURRENT_FOCUS].newValue as FocusSession) || null);
            }
        };
        browser.storage.onChanged.addListener(listener);
        return () => browser.storage.onChanged.removeListener(listener);
    },


    async getKeywordHistory(): Promise<KeywordEntry[]> {
        const result = await browser.storage.local.get(STORAGE_KEYS.KEYWORD_HISTORY);
        return (result[STORAGE_KEYS.KEYWORD_HISTORY] as KeywordEntry[]) || [];
    },

    async addKeywords(keywords: string[]): Promise<void> {
        const history = await this.getKeywordHistory();
        const now = Date.now();

        for (const keyword of keywords) {
            const normalized = keyword.toLowerCase().trim();
            if (!normalized) continue;

            const existing = history.find(h => h.keyword.toLowerCase() === normalized);
            if (existing) {
                existing.count += 1;
                existing.lastUsed = now;
            } else {
                history.push({ keyword, count: 1, lastUsed: now });
            }
        }

        // Sort by count (descending), keep top 50
        history.sort((a, b) => b.count - a.count);
        const trimmed = history.slice(0, 50);

        await browser.storage.local.set({ [STORAGE_KEYS.KEYWORD_HISTORY]: trimmed });
    },

    async getKeywordSuggestions(query: string, limit = 5): Promise<string[]> {
        const history = await this.getKeywordHistory();
        const normalized = query.toLowerCase().trim();

        if (!normalized) {
            // Return top keywords by count
            return history.slice(0, limit).map(h => h.keyword);
        }

        // Filter keywords that match the query
        return history
            .filter(h => h.keyword.toLowerCase().includes(normalized))
            .slice(0, limit)
            .map(h => h.keyword);
    },


    async getRecentURLs(): Promise<URLVisit[]> {
        const result = await browser.storage.local.get(STORAGE_KEYS.RECENT_URLS);
        return (result[STORAGE_KEYS.RECENT_URLS] as URLVisit[]) || [];
    },

    async addURLVisit(visit: URLVisit): Promise<void> {
        const urls = await this.getRecentURLs();

        // Add new visit
        urls.push(visit);

        // Keep only last 50 visits to avoid unbounded growth
        // We really only need the last minute or so, 50 is plenty
        if (urls.length > 50) {
            urls.splice(0, urls.length - 50);
        }

        await browser.storage.local.set({ [STORAGE_KEYS.RECENT_URLS]: urls });
    },

    async clearRecentURLs(): Promise<void> {
        await browser.storage.local.remove(STORAGE_KEYS.RECENT_URLS);
    },


    async getCheckedUrls(): Promise<string[]> {
        const result = await browser.storage.local.get(STORAGE_KEYS.CHECKED_URLS);
        return (result[STORAGE_KEYS.CHECKED_URLS] as string[]) || [];
    },

    async addCheckedUrl(url: string): Promise<void> {
        const urls = await this.getCheckedUrls();
        if (!urls.includes(url)) {
            urls.push(url);
            // Limit to avoid infinite growth
            if (urls.length > 200) {
                urls.shift();
            }
            await browser.storage.local.set({ [STORAGE_KEYS.CHECKED_URLS]: urls });
        }
    },

    async clearCheckedUrls(): Promise<void> {
        await browser.storage.local.remove(STORAGE_KEYS.CHECKED_URLS);
    },


    // Blacklist
    async getBlacklist(): Promise<BlacklistEntry[]> {
        const result = await browser.storage.local.get(STORAGE_KEYS.BLACKLIST);
        return (result[STORAGE_KEYS.BLACKLIST] as BlacklistEntry[]) || [];
    },

    async addToBlacklist(pattern: string): Promise<void> {
        const list = await this.getBlacklist();
        if (!list.some(e => e.pattern === pattern)) {
            list.push({ pattern, addedAt: Date.now() });
            await browser.storage.local.set({ [STORAGE_KEYS.BLACKLIST]: list });
        }
    },

    async removeFromBlacklist(pattern: string): Promise<void> {
        const list = await this.getBlacklist();
        const filtered = list.filter(e => e.pattern !== pattern);
        await browser.storage.local.set({ [STORAGE_KEYS.BLACKLIST]: filtered });
    },

    async isBlacklisted(url: string): Promise<boolean> {
        const list = await this.getBlacklist();
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;
            return list.some(entry => {
                const pattern = entry.pattern.toLowerCase();
                const host = hostname.toLowerCase();
                // Exact domain match or wildcard
                if (pattern.startsWith('*.')) {
                    const suffix = pattern.slice(2);
                    return host.endsWith(suffix) || host === suffix;
                }
                return host === pattern || host.endsWith('.' + pattern);
            });
        } catch {
            return false;
        }
    },


    // Whitelist
    async getWhitelist(): Promise<WhitelistEntry[]> {
        const result = await browser.storage.local.get(STORAGE_KEYS.WHITELIST);
        return (result[STORAGE_KEYS.WHITELIST] as WhitelistEntry[]) || [];
    },

    async addToWhitelist(pattern: string): Promise<void> {
        const list = await this.getWhitelist();
        if (!list.some(e => e.pattern === pattern)) {
            list.push({ pattern, addedAt: Date.now() });
            await browser.storage.local.set({ [STORAGE_KEYS.WHITELIST]: list });
        }
    },

    async removeFromWhitelist(pattern: string): Promise<void> {
        const list = await this.getWhitelist();
        const filtered = list.filter(e => e.pattern !== pattern);
        await browser.storage.local.set({ [STORAGE_KEYS.WHITELIST]: filtered });
    },

    async isWhitelisted(url: string): Promise<boolean> {
        const list = await this.getWhitelist();
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;
            return list.some(entry => {
                const pattern = entry.pattern.toLowerCase();
                const host = hostname.toLowerCase();
                if (pattern.startsWith('*.')) {
                    const suffix = pattern.slice(2);
                    return host.endsWith(suffix) || host === suffix;
                }
                return host === pattern || host.endsWith('.' + pattern);
            });
        } catch {
            return false;
        }
    },


    // Completed Tasks
    async getCompletedTasks(): Promise<CompletedTask[]> {
        const result = await browser.storage.local.get(STORAGE_KEYS.COMPLETED_TASKS);
        return (result[STORAGE_KEYS.COMPLETED_TASKS] as CompletedTask[]) || [];
    },

    async recordCompletedTask(taskName: string, focusDurationMs?: number): Promise<void> {
        const tasks = await this.getCompletedTasks();
        tasks.push({
            id: crypto.randomUUID(),
            taskName,
            completedAt: Date.now(),
            focusDurationMs,
        });
        // Keep last 365 days of tasks (roughly)
        if (tasks.length > 1000) {
            tasks.splice(0, tasks.length - 1000);
        }
        await browser.storage.local.set({ [STORAGE_KEYS.COMPLETED_TASKS]: tasks });
    },

    async getCompletedTasksInRange(startDate: Date, endDate: Date): Promise<CompletedTask[]> {
        const tasks = await this.getCompletedTasks();
        const start = startDate.getTime();
        const end = endDate.getTime();
        return tasks.filter(t => t.completedAt >= start && t.completedAt <= end);
    },


    // Bypassed Tabs (for blacklist warning - don't show again in same tab)
    async getBypassedTabs(): Promise<{ tabId: number; url: string }[]> {
        const result = await browser.storage.local.get(STORAGE_KEYS.BYPASSED_TABS);
        return (result[STORAGE_KEYS.BYPASSED_TABS] as { tabId: number; url: string }[]) || [];
    },

    async addBypassedTab(tabId: number, url: string): Promise<void> {
        const list = await this.getBypassedTabs();
        if (!list.some(e => e.tabId === tabId && e.url === url)) {
            list.push({ tabId, url });
            // Limit size
            if (list.length > 100) {
                list.shift();
            }
            await browser.storage.local.set({ [STORAGE_KEYS.BYPASSED_TABS]: list });
        }
    },

    async isTabBypassed(tabId: number, url: string): Promise<boolean> {
        const list = await this.getBypassedTabs();
        return list.some(e => e.tabId === tabId && e.url === url);
    },

    async removeBypassedTab(tabId: number): Promise<void> {
        const list = await this.getBypassedTabs();
        const filtered = list.filter(e => e.tabId !== tabId);
        await browser.storage.local.set({ [STORAGE_KEYS.BYPASSED_TABS]: filtered });
    },
};
