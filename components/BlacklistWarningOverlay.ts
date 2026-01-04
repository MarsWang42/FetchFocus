import { browser } from 'wxt/browser';

const t = (key: string) => browser.i18n.getMessage(key as any) || key;

export function showBlacklistWarning(
  onProceed: () => void,
  onGoBack: () => void
): void {
  // Prevent duplicate warnings
  if (document.getElementById('fetch-focus-blacklist-overlay')) {
    console.debug('[FetchFocus] Blacklist warning already visible, skipping');
    return;
  }

  // Get domain and favicon for display
  const domain = window.location.hostname;
  const favicon = document.querySelector<HTMLLinkElement>('link[rel*="icon"]')?.href
    || `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

  const overlay = document.createElement('div');
  overlay.id = 'fetch-focus-blacklist-overlay';

  const styles = `
    .ff-blacklist-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(4px);
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Inter', system-ui, sans-serif;
    }
    .ff-blacklist-container {
      background: white;
      border-radius: 20px;
      padding: 32px 40px;
      max-width: 400px;
      width: 90%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
      border: 1px solid #e2e8f0;
      animation: ff-slide-up 0.3s ease-out;
    }
    @keyframes ff-slide-up {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes ff-bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-6px); }
    }
    .ff-blacklist-avatar {
      width: 80px;
      height: 80px;
      object-fit: contain;
      margin-bottom: 16px;
      animation: ff-bounce 1s ease-in-out infinite;
    }
    .ff-blacklist-title {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 8px;
    }
    .ff-blacklist-message {
      margin: 0;
      font-size: 15px;
      color: #475569;
      line-height: 1.5;
      margin-bottom: 12px;
    }
    .ff-blacklist-domain {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: #dc2626;
      background: #fee2e2;
      padding: 8px 16px;
      border-radius: 8px;
      margin-bottom: 12px;
      word-break: break-all;
    }
    .ff-blacklist-favicon {
      width: 20px;
      height: 20px;
      border-radius: 4px;
      flex-shrink: 0;
    }
    .ff-blacklist-subtext {
      margin: 0;
      font-size: 13px;
      color: #94a3b8;
      margin-bottom: 20px;
    }
    .ff-blacklist-buttons {
      display: flex;
      gap: 12px;
      justify-content: center;
    }
    .ff-btn-goback {
      flex: 1;
      padding: 12px 20px;
      font-size: 14px;
      font-weight: 600;
      color: white;
      background: #ef4444;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .ff-btn-goback:hover {
      background: #dc2626;
    }
    .ff-btn-proceed {
      flex: 1;
      padding: 12px 20px;
      font-size: 14px;
      font-weight: 600;
      color: #78716c;
      background: white;
      border: 1px solid #d6d3d1;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .ff-btn-proceed:hover {
      background: #fafaf9;
      border-color: #a8a29e;
    }
  `;

  const html = `
    <div class="ff-blacklist-overlay">
      <div class="ff-blacklist-container">
        <img src="${browser.runtime.getURL('/running_puppy.png')}" alt="FetchFocus" class="ff-blacklist-avatar" />
        <h2 class="ff-blacklist-title">${t('blacklistWarningTitle')}</h2>
        <p class="ff-blacklist-message">${t('blacklistWarningMessage')}</p>
        <div class="ff-blacklist-domain">
          <img src="${favicon}" alt="" class="ff-blacklist-favicon" onerror="this.style.display='none'" />
          <span>${domain}</span>
        </div>
        <p class="ff-blacklist-subtext">${t('blacklistWarningSubtext')}</p>
        <div class="ff-blacklist-buttons">
          <button class="ff-btn-goback" id="ff-goback">${t('backToFocus')}</button>
          <button class="ff-btn-proceed" id="ff-proceed">${t('proceedAnyway')}</button>
        </div>
      </div>
    </div>
  `;

  const shadow = overlay.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `<style>${styles}</style>${html}`;

  document.body.appendChild(overlay);

  // Event handlers
  const goBackBtn = shadow.querySelector('#ff-goback');
  const proceedBtn = shadow.querySelector('#ff-proceed');

  goBackBtn?.addEventListener('click', () => {
    overlay.remove();
    onGoBack();
  });

  proceedBtn?.addEventListener('click', () => {
    overlay.remove();
    onProceed();
  });
}
