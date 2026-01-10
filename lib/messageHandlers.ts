import { browser } from 'wxt/browser';
import { storage } from '@/lib/storage';
import type { FocusSession, AIDownloadState } from '@/lib/types';
import { setIconState } from './iconManager';
import { getTabSummary } from './aiService';

// Module-level state for AI download
let aiDownloadState: AIDownloadState = {
    isDownloading: false,
    progress: 0,
};

// AbortController for cancelling downloads
let downloadAbortController: AbortController | null = null;

/**
 * Context passed to message handlers
 */
export interface MessageContext {
    senderTabId?: number;
    tabTimes: Map<number, { startTime: number }>;
    sendMessageToContentScript: (tabId: number, message: any) => Promise<boolean>;
}

/**
 * Message payload types
 */
export interface BackgroundMessage {
    type: string;
    scrollThresholdMet?: boolean;
    todoId?: string;
    tabId?: number;
    windowId?: number;
    pageTitle?: string;
    pageUrl?: string;
    faviconUrl?: string;
    focusDescription?: string;
    focusKeywords?: string[];
}

// Handler response types
type MessageResponse = Record<string, any>;

/**
 * Handle CHECK_SHOULD_NUDGE message
 */
export async function handleCheckShouldNudge(
    message: BackgroundMessage,
    ctx: MessageContext
): Promise<MessageResponse> {
    const lastNudge = await storage.getLastNudge();
    const now = Date.now();
    const NUDGE_COOLDOWN = 60000;

    // Respect cooldown
    if (now - lastNudge < NUDGE_COOLDOWN) {
        return { shouldNudge: false, reason: 'cooldown' };
    }

    const tabId = ctx.senderTabId;
    if (tabId) {
        // Ensure tab is tracked
        if (!ctx.tabTimes.has(tabId)) {
            ctx.tabTimes.set(tabId, { startTime: now - 60000 });
        }

        const tabData = ctx.tabTimes.get(tabId)!;
        const timeOnSite = now - tabData.startTime;

        if (message.scrollThresholdMet && timeOnSite > 5000) {
            await storage.setLastNudge(now);
            const todos = await storage.getTodos();
            console.debug('[FetchFocus] Triggering nudge for doomscroll');
            return { shouldNudge: true, todos };
        } else {
            return { shouldNudge: false, reason: 'time_on_site', timeOnSite };
        }
    }

    return { shouldNudge: false, reason: 'no_tab' };
}

/**
 * Handle NUDGE_DISMISSED message
 */
export async function handleNudgeDismissed(): Promise<MessageResponse> {
    await storage.setLastNudge(Date.now());
    return { success: true };
}

/**
 * Handle GET_TODOS message
 */
export async function handleGetTodos(): Promise<MessageResponse> {
    const todos = await storage.getTodos();
    return { todos };
}

/**
 * Handle TOGGLE_TODO message
 */
export async function handleToggleTodo(message: BackgroundMessage): Promise<MessageResponse> {
    const todos = await storage.getTodos();
    const updatedTodos = todos.map((t) =>
        t.id === message.todoId ? { ...t, completed: !t.completed } : t
    );
    await storage.setTodos(updatedTodos);
    await storage.setLastNudge(Date.now());
    return { todos: updatedTodos };
}

/**
 * Handle START_FOCUS message
 */
export async function handleStartFocus(
    message: BackgroundMessage,
    ctx: MessageContext,
    callbacks: {
        clearCheckedUrls: () => void;
        resetLastFocusTabVisitTime: () => void;
    }
): Promise<MessageResponse> {
    const { tabId, windowId, pageTitle, pageUrl, faviconUrl, focusDescription, focusKeywords } =
        message;

    // Clear checked URLs for new session
    await storage.clearCheckedUrls();
    callbacks.clearCheckedUrls();
    callbacks.resetLastFocusTabVisitTime();

    // Save focus session IMMEDIATELY so UI updates right away
    const currentFocus: FocusSession = {
        originTabId: tabId,
        originWindowId: windowId,
        pageTitle,
        pageUrl,
        faviconUrl,
        description: focusDescription,
        keywords: focusKeywords,
        contentSummary: undefined,
        startTime: Date.now(),
    };

    await storage.setCurrentFocus(currentFocus);

    // Save keywords to history
    if (focusKeywords && focusKeywords.length > 0) {
        storage.addKeywords(focusKeywords).catch((e) => {
            console.error('[FetchFocus] Failed to save keywords to history:', e);
        });
    }

    await storage.clearRecentURLs();

    console.debug('[FetchFocus] Started:', currentFocus);

    // Set icon to focused state
    await setIconState('focused');

    // Check all open tabs against blacklist
    try {
        const allTabs = await browser.tabs.query({});
        for (const tab of allTabs) {
            if (!tab.id || !tab.url || tab.id === tabId) continue;

            const isBlacklisted = await storage.isBlacklisted(tab.url);
            if (isBlacklisted) {
                console.debug('[FetchFocus] Sending blacklist warning to tab:', tab.id, tab.url);
                ctx.sendMessageToContentScript(tab.id, { type: 'SHOW_BLACKLIST_WARNING' });
            }
        }
    } catch (e) {
        console.error('[FetchFocus] Failed to check tabs for blacklist:', e);
    }

    // Fetch content summary asynchronously
    if (tabId) {
        const settings = await storage.getSettings();
        if (settings.aiEnabled) {
            getTabSummary(tabId)
                .then(async (contentSummary) => {
                    if (contentSummary) {
                        const latestFocus = await storage.getCurrentFocus();
                        if (latestFocus && latestFocus.originTabId === tabId) {
                            await storage.setCurrentFocus({ ...latestFocus, contentSummary });
                            console.debug('[FetchFocus] Updated with content summary');
                        }
                    }
                })
                .catch((e) => {
                    console.error('[FetchFocus] Failed to get initial content:', e);
                });
        }
    }

    return { success: true, currentFocus };
}

/**
 * Handle END_FOCUS message
 */
export async function handleEndFocus(): Promise<MessageResponse> {
    await storage.setCurrentFocus(null);
    console.debug('[FetchFocus] Ended');

    await setIconState('idle');
    return { success: true };
}

/**
 * Handle GET_CURRENT_FOCUS message
 */
export async function handleGetCurrentFocus(): Promise<MessageResponse> {
    const currentFocus = await storage.getCurrentFocus();
    return { currentFocus };
}

/**
 * Handle RETURN_TO_FOCUS message
 */
export async function handleReturnToFocus(): Promise<MessageResponse> {
    const currentFocus = await storage.getCurrentFocus();
    if (currentFocus && currentFocus.originTabId && currentFocus.originWindowId) {
        try {
            await browser.tabs.update(currentFocus.originTabId, { active: true });
            await browser.windows.update(currentFocus.originWindowId, { focused: true });
            return { success: true };
        } catch (e) {
            console.error('[FetchFocus] Failed to return to origin tab:', e);
            await storage.setCurrentFocus(null);
            return { error: 'origin_tab_closed' };
        }
    }
    return { error: 'no_focus_session' };
}

/**
 * Handle RETURN_TO_FOCUS_AND_CLOSE message
 */
export async function handleReturnToFocusAndClose(
    ctx: MessageContext
): Promise<MessageResponse> {
    const currentFocus = await storage.getCurrentFocus();
    if (currentFocus) {
        try {
            if (currentFocus.originTabId && currentFocus.originWindowId) {
                await browser.tabs.update(currentFocus.originTabId, { active: true });
                await browser.windows.update(currentFocus.originWindowId, { focused: true });
            }

            if (ctx.senderTabId && ctx.senderTabId !== currentFocus.originTabId) {
                await browser.tabs.remove(ctx.senderTabId);
            }

            return { success: true };
        } catch (e) {
            console.error('[FetchFocus] Failed to return to origin tab:', e);
            await storage.setCurrentFocus(null);
            return { error: 'origin_tab_closed' };
        }
    }
    return { error: 'no_focus_session' };
}

/**
 * Handle CLOSE_CURRENT_TAB message
 */
export async function handleCloseCurrentTab(ctx: MessageContext): Promise<MessageResponse> {
    if (ctx.senderTabId) {
        try {
            await browser.tabs.remove(ctx.senderTabId);
            return { success: true };
        } catch (e) {
            console.error('[FetchFocus] Failed to close tab:', e);
            return { error: 'failed_to_close' };
        }
    }
    return { error: 'no_sender_tab' };
}

/**
 * Handle ADD_TO_RESEARCH message
 */
export async function handleAddToResearch(
    message: BackgroundMessage,
    ctx: MessageContext
): Promise<MessageResponse> {
    const currentFocus = await storage.getCurrentFocus();
    if (!currentFocus) {
        return { error: 'no_focus_session' };
    }

    const { pageUrl, pageTitle } = message;
    if (!pageUrl) {
        return { error: 'missing_page_url' };
    }

    let summary: string | undefined;
    if (ctx.senderTabId) {
        try {
            summary = await getTabSummary(ctx.senderTabId);
        } catch (e) {
            console.error('[FetchFocus] Failed to get research page summary:', e);
        }
    }

    const researchPages = currentFocus.researchPages || [];
    const newPage = {
        url: pageUrl,
        title: pageTitle || 'Untitled',
        summary,
        timestamp: Date.now(),
    };
    researchPages.push(newPage);

    const updatedFocus = { ...currentFocus, researchPages };
    await storage.setCurrentFocus(updatedFocus);
    await storage.setLastNudge(Date.now());

    console.debug('[FetchFocus] Added to research:', newPage);
    return { success: true, researchPages };
}

/**
 * Handle CHECK_BLACKLIST message
 */
export async function handleCheckBlacklist(
    message: BackgroundMessage,
    ctx: MessageContext
): Promise<MessageResponse> {
    const url = message.pageUrl;
    if (!url) return { isBlacklisted: false };

    // Only block if in a focus session
    const currentFocus = await storage.getCurrentFocus();
    if (!currentFocus) {
        return { isBlacklisted: false, reason: 'no_focus' };
    }

    // Check if already bypassed for this tab
    if (ctx.senderTabId) {
        const isBypassed = await storage.isTabBypassed(ctx.senderTabId, url);
        if (isBypassed) {
            return { isBlacklisted: false, reason: 'bypassed' };
        }
    }

    // Check if URL is whitelisted
    const isWhitelisted = await storage.isWhitelisted(url);
    if (isWhitelisted) {
        return { isBlacklisted: false, reason: 'whitelisted' };
    }

    // Check if URL is blacklisted
    const isBlacklisted = await storage.isBlacklisted(url);
    return { isBlacklisted };
}

/**
 * Handle BYPASS_BLACKLIST message
 */
export async function handleBypassBlacklist(
    message: BackgroundMessage,
    ctx: MessageContext
): Promise<MessageResponse> {
    const url = message.pageUrl;
    if (ctx.senderTabId && url) {
        await storage.addBypassedTab(ctx.senderTabId, url);
        return { success: true };
    }
    return { error: 'missing_data' };
}

/**
 * Handle COMPLETE_FOCUS message
 */
export async function handleCompleteFocus(): Promise<MessageResponse> {
    const currentFocus = await storage.getCurrentFocus();
    if (currentFocus) {
        const focusDuration = Date.now() - currentFocus.startTime;
        const taskName = currentFocus.description || currentFocus.pageTitle || 'Focus Session';

        await storage.recordCompletedTask(taskName, focusDuration);
        console.debug('[FetchFocus] Recorded completed task:', taskName);
    }

    await storage.setCurrentFocus(null);
    await setIconState('idle');
    return { success: true };
}

// Helper functions for AI availability status checks
const isModelAvailable = (status: string) => status === 'available' || status === 'ready';
const isModelDownloadable = (status: string) => status === 'downloadable' || status === 'after-download';
const isModelDownloading = (status: string) => status === 'downloading';


/**
 * Runs model downloads/monitoring asynchronously and enables AI when complete
 * Downloads models in parallel for faster completion
 */
async function runModelDownloads(needsLm: boolean, needsSum: boolean): Promise<void> {
    try {
        const LanguageModel = (globalThis as any).LanguageModel;
        const Summarizer = (globalThis as any).Summarizer;

        // Track progress for each model separately for parallel downloads
        const progressMap = {
            lm: 0,
            sum: 0,
        };
        const totalTasks = (needsLm ? 1 : 0) + (needsSum ? 1 : 0);

        // Determine which model(s) we're downloading
        const currentModel: 'language-model' | 'summarizer' | 'both' =
            needsLm && needsSum ? 'both' : needsLm ? 'language-model' : 'summarizer';
        aiDownloadState = { isDownloading: true, progress: 0, currentModel };

        const updateTotalProgress = () => {
            const lmProgress = needsLm ? progressMap.lm : 0;
            const sumProgress = needsSum ? progressMap.sum : 0;
            aiDownloadState.progress = (lmProgress + sumProgress) / totalTasks;
        };

        const downloadPromises: Promise<void>[] = [];

        if (needsLm) {
            downloadPromises.push(
                LanguageModel.create({
                    signal: downloadAbortController?.signal,
                    monitor(m: any) {
                        m.addEventListener('downloadprogress', (e: any) => {
                            progressMap.lm = (e.loaded / e.total) * 100;
                            updateTotalProgress();
                        });
                    }
                }).then(() => {
                    progressMap.lm = 100;
                    updateTotalProgress();
                })
            );
        }

        if (needsSum) {
            downloadPromises.push(
                Summarizer.create({
                    signal: downloadAbortController?.signal,
                    monitor(m: any) {
                        m.addEventListener('downloadprogress', (e: any) => {
                            progressMap.sum = (e.loaded / e.total) * 100;
                            updateTotalProgress();
                        });
                    }
                }).then(() => {
                    progressMap.sum = 100;
                    updateTotalProgress();
                })
            );
        }

        // Download all models in parallel
        await Promise.all(downloadPromises);

        aiDownloadState = { isDownloading: false, progress: 100 };
        downloadAbortController = null;
        const settings = await storage.getSettings();
        await storage.setSettings({ ...settings, aiEnabled: true });
        console.debug('[FetchFocus] AI models download completed');
    } catch (error: any) {
        if (error?.name === 'AbortError') {
            console.debug('[FetchFocus] AI download cancelled by user');
            aiDownloadState = { isDownloading: false, progress: 0 };
        } else {
            console.error('[FetchFocus] Error during AI download', error);
            aiDownloadState = { isDownloading: false, progress: 0, error: 'Failed to download AI models' };
        }
        downloadAbortController = null;
    }
}

/**
 * Handle ENABLE_AI message - download models in background
 */
export async function handleEnableAI(): Promise<MessageResponse> {
    // If already downloading, just return current state
    if (aiDownloadState.isDownloading) {
        return { success: true, ...aiDownloadState };
    }

    try {
        aiDownloadState = { isDownloading: false, progress: 0, error: undefined };

        // Check availability using globalThis (available in service worker context)
        const LanguageModel = (globalThis as any).LanguageModel;
        const Summarizer = (globalThis as any).Summarizer;

        const [lmAvailability, sumAvailability] = await Promise.all([
            LanguageModel?.availability?.() ?? 'unavailable',
            Summarizer?.availability?.() ?? 'unavailable',
        ]);

        const lmAvailable = isModelAvailable(lmAvailability);
        const sumAvailable = isModelAvailable(sumAvailability);

        // Both models are already available
        if (lmAvailable && sumAvailable) {
            const settings = await storage.getSettings();
            await storage.setSettings({ ...settings, aiEnabled: true });
            return { success: true, isDownloading: false, progress: 100 };
        }

        // Check if models need downloading or are already downloading
        const lmNeedsDownload = isModelDownloading(lmAvailability) || isModelDownloadable(lmAvailability);
        const sumNeedsDownload = isModelDownloading(sumAvailability) || isModelDownloadable(sumAvailability);

        if (lmNeedsDownload || sumNeedsDownload) {
            const currentModel: 'language-model' | 'summarizer' | 'both' =
                lmNeedsDownload && sumNeedsDownload ? 'both' : lmNeedsDownload ? 'language-model' : 'summarizer';
            aiDownloadState = { isDownloading: true, progress: 0, currentModel };
            downloadAbortController = new AbortController();
            runModelDownloads(lmNeedsDownload, sumNeedsDownload);
            return { success: true, ...aiDownloadState };
        }

        // Models are unavailable
        return {
            success: false,
            error: 'AI models unavailable. Please enable the required Chrome flags.',
        };
    } catch (error) {
        console.error('[FetchFocus] Error checking/enabling AI', error);
        aiDownloadState = { isDownloading: false, progress: 0, error: 'An error occurred' };
        return { success: false, ...aiDownloadState };
    }
}

/**
 * Handle GET_AI_DOWNLOAD_STATUS message
 */
export async function handleGetAIDownloadStatus(): Promise<MessageResponse> {
    return { ...aiDownloadState };
}

/**
 * Handle CANCEL_AI_DOWNLOAD message
 */
export async function handleCancelAIDownload(): Promise<MessageResponse> {
    if (downloadAbortController) {
        downloadAbortController.abort();
        downloadAbortController = null;
        aiDownloadState = { isDownloading: false, progress: 0 };
        console.debug('[FetchFocus] AI download cancelled');
        return { success: true, cancelled: true };
    }
    return { success: false, error: 'No download in progress' };
}

/**
 * Route messages to appropriate handlers
 */
export async function routeMessage(
    message: BackgroundMessage,
    ctx: MessageContext,
    callbacks: {
        clearCheckedUrls: () => void;
        resetLastFocusTabVisitTime: () => void;
    }
): Promise<MessageResponse> {
    switch (message.type) {
        case 'CHECK_SHOULD_NUDGE':
            return handleCheckShouldNudge(message, ctx);
        case 'NUDGE_DISMISSED':
            return handleNudgeDismissed();
        case 'GET_TODOS':
            return handleGetTodos();
        case 'TOGGLE_TODO':
            return handleToggleTodo(message);
        case 'START_FOCUS':
            return handleStartFocus(message, ctx, callbacks);
        case 'END_FOCUS':
            return handleEndFocus();
        case 'GET_CURRENT_FOCUS':
            return handleGetCurrentFocus();
        case 'RETURN_TO_FOCUS':
            return handleReturnToFocus();
        case 'RETURN_TO_FOCUS_AND_CLOSE':
            return handleReturnToFocusAndClose(ctx);
        case 'CLOSE_CURRENT_TAB':
            return handleCloseCurrentTab(ctx);
        case 'ADD_TO_RESEARCH':
            return handleAddToResearch(message, ctx);
        case 'CHECK_BLACKLIST':
            return handleCheckBlacklist(message, ctx);
        case 'BYPASS_BLACKLIST':
            return handleBypassBlacklist(message, ctx);
        case 'COMPLETE_FOCUS':
            return handleCompleteFocus();
        case 'ENABLE_AI':
            return handleEnableAI();
        case 'GET_AI_DOWNLOAD_STATUS':
            return handleGetAIDownloadStatus();
        case 'CANCEL_AI_DOWNLOAD':
            return handleCancelAIDownload();
        default:
            return { error: 'unknown_message_type' };
    }
}
