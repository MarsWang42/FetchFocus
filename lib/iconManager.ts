import { browser } from 'wxt/browser';
import { ICON_PATHS, type IconState } from './backgroundUtils';

/**
 * Set the browser action icon to the specified state
 */
export async function setIconState(state: IconState): Promise<void> {
    try {
        await browser.action.setIcon({
            path: ICON_PATHS[state],
        });
    } catch (e) {
        console.error(`[FetchFocus] Failed to set ${state} icon:`, e);
    }
}
