import { browser } from 'wxt/browser';
import { storage } from '@/lib/storage';
import { NUDGE_COOLDOWN, TAB_SWITCH_THRESHOLD as URL_SWITCH_THRESHOLD, TAB_SWITCH_WINDOW as URL_SWITCH_WINDOW } from '@/lib/constants';
import type { URLVisit } from '@/lib/types';
import { getBaseUrl, getAIResponseLanguage, ICON_PATHS } from '@/lib/backgroundUtils';
import { setIconState } from '@/lib/iconManager';
import { getTabSummary, getBatchTabSummaries, checkContentSimilarity, analyzeTabSwitchingDrift } from '@/lib/aiService';
import { routeMessage, type BackgroundMessage, type MessageContext } from '@/lib/messageHandlers';

// Track tab start times
const tabTimes: Map<number, { startTime: number }> = new Map();

// Focus tracking
let currentActiveTabId: number | null = null;
let periodicCheckInterval: ReturnType<typeof setInterval> | null = null;
let lastFocusTabVisitTime: number = 0;
const FOCUS_TAB_AWAY_TIMEOUT = 10 * 60 * 1000; // 10 minutes

// Helper to send messages to content scripts, injecting if needed
async function sendMessageToContentScript(tabId: number, message: any): Promise<boolean> {
  try {
    await browser.tabs.sendMessage(tabId, message);
    return true;
  } catch (e) {
    console.debug('[FetchFocus] Content script not responding, attempting to inject...');
    try {
      await browser.scripting.executeScript({
        target: { tabId },
        files: ['/content-scripts/content.js'],
      });
      await new Promise(resolve => setTimeout(resolve, 100));
      await browser.tabs.sendMessage(tabId, message);
      return true;
    } catch (injectError) {
      console.error('[FetchFocus] Failed to inject content script:', injectError);
      return false;
    }
  }
}

const PERIODIC_CHECK_INTERVAL = 10000;
let lastCheckedUrl: string | null = null;

export default defineBackground(() => {
  console.debug('[FetchFocus] Background script started');

  // Startup cleanup
  storage.getCurrentFocus().then(async (currentFocus) => {
    if (currentFocus) {
      console.debug('[FetchFocus] Cleaning up stale focus session on startup');
      await storage.setCurrentFocus(null);
    }
    await storage.clearCheckedUrls();
    await setIconState('idle');
  });

  // On install
  browser.runtime.onInstalled.addListener(async (details) => {
    console.debug('[FetchFocus] Extension installed/updated:', details.reason);

    // Attempt to enable AI mode if available
    try {
      if (typeof LanguageModel !== 'undefined') {
        const availability = await LanguageModel.availability();
        if (availability === 'available') {
          const settings = await storage.getSettings();
          if (!settings.aiEnabled) {
            console.debug('[FetchFocus] AI available, auto-enabling');
            await storage.setSettings({ ...settings, aiEnabled: true });
          }
        }
      }
    } catch (e) {
      console.debug('[FetchFocus] Could not auto-enable AI:', e);
    }

    // Inject content script into all existing tabs
    try {
      const allTabs = await browser.tabs.query({});
      for (const tab of allTabs) {
        if (!tab.id || !tab.url) continue;
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
          continue;
        }
        try {
          await browser.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['/content-scripts/content.js'],
          });
          console.debug('[FetchFocus] Injected content script into tab:', tab.id);
        } catch (e) {
          console.debug('[FetchFocus] Could not inject into tab:', tab.id, e);
        }
      }
    } catch (e) {
      console.error('[FetchFocus] Failed to inject content scripts on install:', e);
    }
  });

  browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
      try {
        tabTimes.set(tabId, { startTime: Date.now() });
        const results = await browser.scripting.executeScript({
          target: { tabId },
          func: () => {
            const content = document.body?.innerText || '';
            return content.slice(0, 4000);
          },
        });
        const rawContent = results[0]?.result || '';

        await storage.addURLVisit({
          tabId: tabId,
          url: tab.url,
          title: tab.title || '',
          timestamp: Date.now(),
          content: rawContent,
        });
        console.debug('[FetchFocus] Tracked URL visit:', tab.url);

        checkURLSwitchingDrift();
      } catch (e) {
        // Ignore invalid URLs
      }
    }
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    tabTimes.delete(tabId);
  });

  browser.tabs.onActivated.addListener(async (activeInfo) => {
    currentActiveTabId = activeInfo.tabId;
    lastCheckedUrl = null;

    try {
      const tab = await browser.tabs.get(activeInfo.tabId);
      if (tab.url && tab.id) {
        await storage.addURLVisit({
          tabId: tab.id,
          url: tab.url,
          title: tab.title || '',
          timestamp: Date.now()
        });
        console.debug('[FetchFocus] Tracked tab visit:', tab.url);

        checkURLSwitchingDrift();
      }
    } catch (e) {
      // Tab might not exist
    }
  });

  startPeriodicFocusCheck();

  // Handle messages from content scripts
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const ctx: MessageContext = {
      senderTabId: sender.tab?.id,
      tabTimes,
      sendMessageToContentScript,
    };
    const callbacks = {
      clearCheckedUrls: () => { lastCheckedUrl = null; },
      resetLastFocusTabVisitTime: () => { lastFocusTabVisitTime = Date.now(); },
    };
    routeMessage(message as BackgroundMessage, ctx, callbacks).then(sendResponse);
    return true;
  });
});

function startPeriodicFocusCheck() {
  if (periodicCheckInterval) return;

  periodicCheckInterval = setInterval(async () => {
    const currentFocus = await storage.getCurrentFocus();
    if (!currentFocus || currentActiveTabId === null) return;

    // Skip if on origin tab
    if (currentFocus.originTabId && currentActiveTabId === currentFocus.originTabId) {
      lastFocusTabVisitTime = Date.now();
      return;
    }

    // Check if user has been away from focus tab for too long
    const now = Date.now();
    if (currentFocus.originTabId && lastFocusTabVisitTime > 0) {
      const timeAway = now - lastFocusTabVisitTime;
      if (timeAway >= FOCUS_TAB_AWAY_TIMEOUT) {
        const lastNudge = await storage.getLastNudge();
        if (now - lastNudge >= NUDGE_COOLDOWN) {
          console.debug('[FetchFocus] User away from focus tab for 10+ minutes, sending nudge');
          const sent = await sendMessageToContentScript(currentActiveTabId, {
            type: 'SHOW_FOCUS_NUDGE',
            focusTitle: currentFocus.pageTitle || currentFocus.description || 'Focus Session',
            focusUrl: currentFocus.pageUrl || '',
            faviconUrl: currentFocus.faviconUrl,
            originTabId: currentFocus.originTabId,
            nudgeType: 'focus_tab_away',
            reason: browser.i18n.getMessage('focusTabAwayReason' as any)
          });
          if (sent) {
            await storage.setLastNudge(now);
            lastFocusTabVisitTime = now;
          }
          return;
        }
      }
    }

    // Get current tab URL
    try {
      const tab = await browser.tabs.get(currentActiveTabId);
      if (!tab.url) return;

      const currentBaseUrl = getBaseUrl(tab.url);
      const checkedUrls = await storage.getCheckedUrls();
      if (checkedUrls.includes(currentBaseUrl)) {
        return;
      }

      if (lastCheckedUrl === currentBaseUrl) {
        console.debug('[FetchFocus] Periodic check triggered (same URL for 10s)');
        await storage.addCheckedUrl(currentBaseUrl);
        await triggerFocusContextCheck();
      }

      lastCheckedUrl = currentBaseUrl;
    } catch (e) {
      // Tab may have been closed
    }
  }, PERIODIC_CHECK_INTERVAL);
}

async function triggerFocusContextCheck() {
  const currentFocus = await storage.getCurrentFocus();
  if (!currentFocus || currentActiveTabId === null) return;

  console.debug('[FetchFocus] Triggering context check');

  const currentTab = await browser.tabs.get(currentActiveTabId);
  if (!currentTab) return;

  const settings = await storage.getSettings();
  let isDrifted = false;
  let reason = '';

  if (settings.aiEnabled) {
    try {
      const startTime = performance.now();
      const currentContent = await getTabSummary(currentActiveTabId);
      const locale = browser.i18n.getUILanguage();
      const result = await checkContentSimilarity(
        currentFocus,
        currentTab.title || '',
        currentContent,
        currentTab.url || '',
        locale
      );
      const endTime = performance.now();
      console.log(`[FetchFocus] Context check took ${(endTime - startTime).toFixed(2)}ms (getTabSummary + checkContentSimilarity)`);
      isDrifted = result.isDrifted;
      reason = result.reason || '';
    } catch (e) {
      console.error('[FetchFocus] AI check failed, defaulting to not nudge:', e);
    }
  }

  if (isDrifted) {
    console.debug('[FetchFocus] Sending nudge to tab:', currentActiveTabId);
    const sent = await sendMessageToContentScript(currentActiveTabId, {
      type: 'SHOW_FOCUS_NUDGE',
      focusTitle: currentFocus.pageTitle || currentFocus.description || 'Focus Session',
      focusUrl: currentFocus.pageUrl || '',
      faviconUrl: currentFocus.faviconUrl,
      originTabId: currentFocus.originTabId,
      nudgeType: 'content_unrelated',
      reason: reason
    });
    if (sent) {
      console.debug('[FetchFocus] Nudge message sent successfully');
    }
  }
}

let isCheckingDrift = false;
let lastDriftCheckTime = 0;
const DRIFT_CHECK_THROTTLE = 20000;

async function checkURLSwitchingDrift() {
  if (isCheckingDrift) return;
  const now = Date.now();

  if (now - lastDriftCheckTime < DRIFT_CHECK_THROTTLE) return;
  const settings = await storage.getSettings();
  if (!settings.aiEnabled) return;
  const currentFocus = await storage.getCurrentFocus();
  if (!currentFocus) return;

  const lastNudge = await storage.getLastNudge();
  if (now - lastNudge < NUDGE_COOLDOWN) {
    return;
  }

  const recentURLs = await storage.getRecentURLs();
  const lastMinuteURLs = recentURLs.filter(t => now - t.timestamp < URL_SWITCH_WINDOW);
  const uniqueUrls = new Set<URLVisit>();
  let focusBaseUrl = '';
  if (currentFocus.pageUrl) {
    focusBaseUrl = getBaseUrl(currentFocus.pageUrl);
  }
  const validVisits = lastMinuteURLs.filter(t => {
    if (!t.url) return false;
    const baseUrl = getBaseUrl(t.url);
    if (!!focusBaseUrl && baseUrl === focusBaseUrl) return false;
    uniqueUrls.add(t);
    return true;
  });

  console.debug(`[Focus] Tab switching check: ${uniqueUrls.size} unique URLs in last minute`);

  if (uniqueUrls.size < URL_SWITCH_THRESHOLD) {
    return;
  }

  try {
    isCheckingDrift = true;
    console.debug('[FetchFocus] Rapid URL switching detected, analyzing content...');

    const summary = await getBatchTabSummaries(validVisits);
    console.debug('[FetchFocus] Tab switching check summary:', summary);

    const locale = browser.i18n.getUILanguage();
    const { isDrifted, reason: driftReason } = await analyzeTabSwitchingDrift(currentFocus, summary, locale);

    if (isDrifted) {
      console.debug('[FetchFocus] Sending tab-switching nudge');

      if (currentActiveTabId) {
        const sent = await sendMessageToContentScript(currentActiveTabId, {
          type: 'SHOW_FOCUS_NUDGE',
          focusTitle: currentFocus.pageTitle,
          focusUrl: currentFocus.pageUrl,
          faviconUrl: currentFocus.faviconUrl,
          nudgeType: 'tab_switching',
          reason: driftReason
        });

        if (sent) {
          await storage.setLastNudge(Date.now());
        }
      }
    }
  } finally {
    isCheckingDrift = false;
    lastDriftCheckTime = Date.now();
  }
}
