
const t = (key: string) => {
  try {
    return browser.i18n.getMessage(key as any) || key;
  } catch {
    return key;
  }
};


const NUDGE_VARIANT_COUNT = 5;

type NudgeCategory = 'doomScroll' | 'rapidSwitch' | 'stagnantTab' | 'focusTabAway' | 'standard';

function getNudgeCategoryFromType(nudgeType?: NudgeData['nudgeType']): NudgeCategory {
  switch (nudgeType) {
    case 'doomscrolling':
      return 'doomScroll';
    case 'tab_switching':
      return 'rapidSwitch';
    case 'content_unrelated':
      return 'stagnantTab';
    case 'focus_tab_away':
      return 'focusTabAway';
    default:
      return 'standard';
  }
}

function getRandomNudgeMessage(nudgeType?: NudgeData['nudgeType']): { title: string; body: string } {
  const category = getNudgeCategoryFromType(nudgeType);
  const index = Math.floor(Math.random() * NUDGE_VARIANT_COUNT) + 1; // 1-5
  const title = t(`${category}NudgeTitle${index}`) || t('nudgeTitle');
  const body = t(`${category}NudgeBody${index}`) || t('refocus');
  return { title, body };
}


function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + '…';
}


function getDisplayName(title: string, url: string): string {
  // If title is reasonable, use truncated title
  if (title && title.length > 0 && title.length <= 60) {
    return truncateText(title, 40);
  }

  // If title is too long, try to get domain from URL
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.replace(/^www\./, '');
    return domain;
  } catch {
    return truncateText(title || 'your task', 40);
  }
}

export interface NudgeData {
  focusTitle: string;
  focusUrl: string;
  faviconUrl?: string;
  nudgeType?: 'tab_switching' | 'doomscrolling' | 'content_unrelated' | 'focus_tab_away' | 'standard';
  reason?: string;
}

export function generateNudgeHTML(data: NudgeData): string {
  const displayName = getDisplayName(data.focusTitle, data.focusUrl);
  const faviconHtml = data.faviconUrl
    ? `<img class="focus-favicon" src="${data.faviconUrl}" alt="" onerror="this.style.display='none'" />`
    : `<div class="focus-favicon-placeholder">📌</div>`;

  const nudgeMessage = getRandomNudgeMessage(data.nudgeType);

  return `
    <div class="overlay">
      <div class="header" style="justify-content: flex-end; border-bottom: none; padding-bottom: 0;">
        <button class="close-btn" id="close-nudge">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div class="puppy-container">
        <img class="puppy" src="${browser.runtime.getURL('/running_puppy.png')}" alt="Friendly puppy" />
      </div>
      <div class="puppy-speech-container">
        <div class="puppy-speech">${nudgeMessage.title}</div>
        ${data.reason ? `
          <div class="nudge-reason-container">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-help-circle"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
            <span class="nudge-tooltip">${data.reason}</span>
          </div>
        ` : ''}
      </div>
      <div class="puppy-subtitle">${nudgeMessage.body}</div>

      <div class="content" id="nudge-content">
        <div class="focus-reminder">
          ${faviconHtml}
          <span class="focus-name">${displayName}</span>
        </div>
      </div>

      <div class="footer">
        <button class="btn btn-secondary" id="research-btn">
          ${t('imResearching')}
        </button>
        <button class="btn btn-primary" id="return-btn">
          ${t('backToFocus')}
        </button>
      </div>
    </div>
  `;
}
