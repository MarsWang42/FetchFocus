import { generateNudgeHTML, type NudgeData } from '@/components/NudgeOverlay';
import { nudgeStyles } from '@/components/NudgeStyles';
import { showBlacklistWarning } from '@/components/BlacklistWarningOverlay';

// Doom-scroll detection state
interface ScrollDetectionState {
  totalDownwardScroll: number;
  lastScrollY: number;
  sessionStartTime: number;
  pageHeightExpansions: number;
  lastPageHeight: number;
  distractionScore: number;
}

let state: ScrollDetectionState = {
  totalDownwardScroll: 0,
  lastScrollY: 0,
  sessionStartTime: Date.now(),
  pageHeightExpansions: 0,
  lastPageHeight: 0,
  distractionScore: 0,
};

let isNudgeVisible = false;
let nudgeElement: HTMLDivElement | null = null;
let rafId: number | null = null;
let mutationObserver: MutationObserver | null = null;
let isContextValid = true;

// Helper to safely send messages, detecting invalidated context
async function safeSendMessage(message: any): Promise<any> {
  if (!isContextValid) return null;
  try {
    return await browser.runtime.sendMessage(message);
  } catch (e: any) {
    if (e?.message?.includes('Extension context invalidated')) {
      console.debug('[FetchFocus] Extension context invalidated, stopping monitoring');
      isContextValid = false;
      stopMonitoring();
      return null;
    }
    throw e;
  }
}

// Thresholds
const CUMULATIVE_SCROLL_THRESHOLD = 5; // window.innerHeight * 5
const PAGE_EXPANSION_THRESHOLD = 3; // times page height increased
const MINDFULNESS_RATIO_THRESHOLD = 50; // pixels per second average

export default defineContentScript({
  matches: ['*://*/*'],
  runAt: 'document_idle',

  async main() {
    console.debug('[FetchFocus] Content script loaded');

    // Check if current page is blacklisted
    const blacklistCheck = await safeSendMessage({
      type: 'CHECK_BLACKLIST',
      pageUrl: window.location.href
    });

    if (blacklistCheck?.isBlacklisted) {
      console.debug('[FetchFocus] Page is blacklisted, showing warning');
      showBlacklistWarning(
        async () => {
          // Mark as bypassed for this tab
          await safeSendMessage({
            type: 'BYPASS_BLACKLIST',
            pageUrl: window.location.href,
          });

          // Now start normal monitoring
          state.lastScrollY = window.scrollY;
          state.lastPageHeight = document.body.scrollHeight;
          state.sessionStartTime = Date.now();

          const response = await safeSendMessage({ type: 'GET_CURRENT_FOCUS' });
          if (response?.currentFocus) {
            startMonitoring();
          }
        },
        async () => {
          const focusResponse = await safeSendMessage({ type: 'GET_CURRENT_FOCUS' });
          if (focusResponse?.currentFocus) {
            // Return to focus and close this tab
            await safeSendMessage({ type: 'RETURN_TO_FOCUS_AND_CLOSE' });
          } else {
            // No focus session, just close this tab via background
            await safeSendMessage({ type: 'CLOSE_CURRENT_TAB' });
          }
        }
      );
      return; // Don't start other monitoring until user decides
    }

    state.lastScrollY = window.scrollY;
    state.lastPageHeight = document.body.scrollHeight;
    state.sessionStartTime = Date.now();

    // Check if focus is active
    const response = await safeSendMessage({ type: 'GET_CURRENT_FOCUS' });
    if (response?.currentFocus) {
      console.debug('[FetchFocus] Active focus session detected, starting monitoring');
      startMonitoring();
    }


    browser.runtime.onMessage.addListener((message) => {
      if (message.type === 'SHOW_FOCUS_NUDGE') {
        showNudgeOverlay({
          focusTitle: message.focusTitle,
          focusUrl: message.focusUrl,
          faviconUrl: message.faviconUrl,
          nudgeType: message.nudgeType,
          reason: message.reason,
        });
      } else if (message.type === 'START_FOCUS') {
        console.debug('[FetchFocus] Focus session started, enabling monitoring');
        startMonitoring();
      } else if (message.type === 'END_FOCUS') {
        console.debug('[FetchFocus] Focus session ended, disabling monitoring');
        stopMonitoring();
      } else if (message.type === 'SHOW_BLACKLIST_WARNING') {
        // Show blacklist warning for tabs that were already open when focus started
        console.debug('[FetchFocus] Received blacklist warning for existing tab');
        showBlacklistWarning(
          async () => {
            // Mark as bypassed for this tab
            await safeSendMessage({
              type: 'BYPASS_BLACKLIST',
              pageUrl: window.location.href,
            });
          },
          async () => {
            const focusResponse = await safeSendMessage({ type: 'GET_CURRENT_FOCUS' });
            if (focusResponse?.currentFocus) {
              await safeSendMessage({ type: 'RETURN_TO_FOCUS_AND_CLOSE' });
            } else {
              await safeSendMessage({ type: 'CLOSE_CURRENT_TAB' });
            }
          }
        );
      }
    });
  },
});

function startMonitoring() {
  if (rafId !== null) return; // Already running

  console.debug('[FetchFocus] Starting monitoring');
  startScrollMonitoring();
  startPageExpansionMonitoring();
}

function stopMonitoring() {
  console.debug('[FetchFocus] Stopping monitoring');
  cleanup();
  rafId = null;
  mutationObserver = null;
}

function startScrollMonitoring() {
  let lastScrollY = window.scrollY;
  // Reset state when starting new monitoring session
  resetState();

  const checkScroll = () => {
    const currentScrollY = window.scrollY;
    const deltaY = currentScrollY - lastScrollY;


    if (deltaY > 0) {
      state.totalDownwardScroll += deltaY;
    }

    lastScrollY = currentScrollY;

    // Check doom-scroll conditions
    checkDoomScrollSignature();

    rafId = requestAnimationFrame(checkScroll);
  };

  rafId = requestAnimationFrame(checkScroll);

  // Cleanup on unload
  window.addEventListener('unload', cleanup);
}

function startPageExpansionMonitoring() {
  if (mutationObserver) mutationObserver.disconnect();

  // Monitor page height changes (infinite scroll detection)
  mutationObserver = new MutationObserver(() => {
    const currentHeight = document.body.scrollHeight;

    // Check if page significantly expanded (at least doubled)
    if (currentHeight > state.lastPageHeight * 2) {
      state.pageHeightExpansions++;
      state.lastPageHeight = currentHeight;

      console.debug(`[FetchFocus] Page expanded: ${state.pageHeightExpansions} times`);

      // Add to distraction score for each expansion
      if (state.pageHeightExpansions >= PAGE_EXPANSION_THRESHOLD) {
        state.distractionScore += 1;
      }
    }
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function checkDoomScrollSignature() {
  if (isNudgeVisible) return;

  const sessionDuration = (Date.now() - state.sessionStartTime) / 1000; // seconds
  const scrollThreshold = window.innerHeight * CUMULATIVE_SCROLL_THRESHOLD;

  // Calculate mindfulness ratio (lower = more mindless scrolling)
  const mindfulnessRatio = sessionDuration > 0
    ? state.totalDownwardScroll / sessionDuration
    : 0;

  // Build doom-scroll signature
  const cumulativeDistanceMet = state.totalDownwardScroll > scrollThreshold;
  const feedExpansionMet = state.pageHeightExpansions >= PAGE_EXPANSION_THRESHOLD;
  const mindlessScrollingMet = mindfulnessRatio > MINDFULNESS_RATIO_THRESHOLD;

  // Trigger conditions:
  // 1. Cumulative distance exceeded AND high scroll rate, OR
  // 2. Feed expanded multiple times AND significant scrolling
  if ((cumulativeDistanceMet && mindlessScrollingMet) ||
    (feedExpansionMet && state.totalDownwardScroll > scrollThreshold / 2)) {
    console.debug('[FetchFocus] Doom-scroll signature detected!');
    triggerNudge();
  }
}

function cleanup() {
  if (rafId) cancelAnimationFrame(rafId);
  if (mutationObserver) mutationObserver.disconnect();
}

function resetState() {
  state = {
    totalDownwardScroll: 0,
    lastScrollY: window.scrollY,
    sessionStartTime: Date.now(),
    pageHeightExpansions: 0,
    lastPageHeight: document.body.scrollHeight,
    distractionScore: 0,
  };
}

async function triggerNudge() {
  if (!isContextValid) return;

  // Check with background script
  const response = await safeSendMessage({
    type: 'CHECK_SHOULD_NUDGE',
    scrollThresholdMet: true,
  });
  console.debug('[FetchFocus] Nudge check response:', response);

  if (response?.shouldNudge) {
    // Get focus info from storage
    const focusResponse = await safeSendMessage({ type: 'GET_CURRENT_FOCUS' });
    const focus = focusResponse?.currentFocus;
    showNudgeOverlay({
      focusTitle: focus?.pageTitle || 'your task',
      focusUrl: focus?.pageUrl || '',
      faviconUrl: focus?.faviconUrl,
      nudgeType: 'doomscrolling',
      reason: browser.i18n.getMessage('doomscrollingReason' as any) || 'You seem to be doomscrolling.',
    });
  }
}

function showNudgeOverlay(data: NudgeData) {
  if (isNudgeVisible) return;
  isNudgeVisible = true;

  nudgeElement = document.createElement('div');
  nudgeElement.id = 'fetch-focus-overlay';

  const shadow = nudgeElement.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `<style>${nudgeStyles}</style>${generateNudgeHTML(data)}`;

  document.body.appendChild(nudgeElement);

  // Event listeners
  const overlay = shadow.querySelector('.overlay');
  const closeBtn = shadow.querySelector('#close-nudge');
  const returnBtn = shadow.querySelector('#return-btn');

  const closeOverlay = () => {
    overlay?.classList.add('closing');
    setTimeout(() => {
      nudgeElement?.remove();
      nudgeElement = null;
      isNudgeVisible = false;
      // Reset scroll state for a fresh start
      resetState();
    }, 300);

    safeSendMessage({ type: 'NUDGE_DISMISSED' });
  };

  closeBtn?.addEventListener('click', closeOverlay);


  returnBtn?.addEventListener('click', async () => {
    // Close overlay first for smooth transition
    overlay?.classList.add('closing');

    // Send message to return to focus and close this tab
    await safeSendMessage({ type: 'RETURN_TO_FOCUS_AND_CLOSE' });
  });

  // Mark current page as research (whitelist it)
  const researchBtn = shadow.querySelector('#research-btn');
  researchBtn?.addEventListener('click', async () => {
    // Close overlay
    overlay?.classList.add('closing');
    setTimeout(() => {
      nudgeElement?.remove();
      nudgeElement = null;
      isNudgeVisible = false;
      resetState();
    }, 300);

    // Send message to add this page to research whitelist
    await safeSendMessage({
      type: 'ADD_TO_RESEARCH',
      pageUrl: window.location.href,
      pageTitle: document.title,
    });
  });
}

// Blacklist warning overlay


