import { browser } from 'wxt/browser';
import { storage } from '@/lib/storage';
import type { FocusSession, URLVisit } from '@/lib/types';
import { getBaseUrl, isInResearchPages, areTitlesRelated, getAIResponseLanguage } from './backgroundUtils';

/**
 * Get summarized content from a tab using Summarizer API
 */
export async function getTabSummary(tabId: number): Promise<string> {
    try {
        // First get the raw text content
        const results = await browser.scripting.executeScript({
            target: { tabId },
            func: () => {
                // Get main content, excluding scripts, styles, etc.
                const content = document.body?.innerText || '';
                // Get a reasonable chunk for summarization
                return content.slice(0, 4000);
            },
        });
        const rawContent = results[0]?.result || '';

        if (!rawContent) return '';

        // Check if Summarizer API is available
        if (typeof Summarizer === 'undefined') {
            console.debug('[FetchFocus] Summarizer API not available, using raw content');
            return rawContent.slice(0, 500);
        }

        const availability = await Summarizer.availability();
        if (availability !== 'available') {
            console.debug(`[Focus] Summarizer not ready (${availability}), using raw content`);
            return rawContent.slice(0, 500);
        }

        // Create summarizer and get summary
        const summarizer = await Summarizer.create({
            type: 'tldr',
            format: 'plain-text',
            length: 'short',
        });

        const summary = await summarizer.summarize(rawContent);
        summarizer.destroy();

        console.debug('[FetchFocus] Page summarized:', summary.slice(0, 200));
        return summary;
    } catch (e) {
        console.error('[FetchFocus] Failed to get tab summary:', e);
        return '';
    }
}

/**
 * Get summaries for multiple tabs efficiently (single Summarizer instance)
 */
export async function getBatchTabSummaries(urlVisits: URLVisit[]): Promise<string> {
    let allContents = '';
    urlVisits.forEach((visit) => {
        allContents += 'Title: ' + visit.title + '\n';
        if (visit.content) {
            allContents += visit.content + '\n';
        }
        allContents += '\n';
    });

    let summarizer;
    try {
        if (typeof Summarizer !== 'undefined') {
            const availability = await Summarizer.availability();
            if (availability === 'available') {
                summarizer = await Summarizer.create({
                    type: 'tldr',
                    format: 'plain-text',
                    length: 'short',
                });
            }
        }
    } catch (e) {
        console.error('[FetchFocus] Failed to create batch summarizer:', e);
    }

    let summary = '';
    if (summarizer) {
        try {
            summary = await summarizer.summarize(allContents);
        } catch (e) {
            console.error('[FetchFocus] Failed to summarize batch:', e);
        }
    }

    if (summarizer) {
        summarizer.destroy();
    }

    return summary;
}

/**
 * Use AI to check content similarity for drift detection
 */
export async function checkContentSimilarity(
    currentFocus: FocusSession,
    currentTitle: string,
    currentContent: string,
    currentUrl: string,
    locale: string
): Promise<{ isDrifted: boolean; reason?: string }> {
    const { pageTitle: focusTitle, contentSummary: focusContent, researchPages } = currentFocus;

    // Skip nudge if this URL is in the research whitelist
    if (isInResearchPages(currentUrl, researchPages)) {
        console.debug('[FetchFocus] URL is in research whitelist, skipping nudge');
        return { isDrifted: false, reason: 'Research page' };
    }

    // Check if AI is available
    const settings = await storage.getSettings();
    if (!settings.aiEnabled) {
        console.debug('[FetchFocus] AI not available, defaulting to title comparison');
        if (!focusTitle) return { isDrifted: false, reason: 'No focus title' };

        const isDrifted = !areTitlesRelated(focusTitle, currentTitle);
        return { isDrifted, reason: isDrifted ? 'Title unrelated' : 'Title related' };
    }

    console.debug('[FetchFocus] Checking similarity:', {
        focusTitle,
        focusContent,
        currentTitle,
        currentContent,
        description: currentFocus.description,
        keywords: currentFocus.keywords,
        researchPages,
    });

    try {
        const responseLanguage = getAIResponseLanguage(locale);
        const session = await LanguageModel.create({
            initialPrompts: [
                {
                    role: 'system',
                    content: `You analyze if a user has drifted from their focused work. CRITICAL: Keywords are the PRIMARY criteria - if the page contains any focus keyword (case-insensitive), it is FOCUSED. The user has defined a specific goal and keywords. The "Focus Session" origin page is just context for where they started, not the primary criteria. If the current page is unrelated to their stated goal AND keywords (e.g. social media, entertainment, completely off-topic), mark it as DRIFTED. Context gathering and related research is FOCUSED. Respond with FOCUSED or DRIFTED followed by a brief reason. IMPORTANT: Your REASON must be written in ${responseLanguage}.`,
                },
            ],
        });

        // Build research pages context
        let researchContext = '';
        if (researchPages && researchPages.length > 0) {
            const pageDescriptions = researchPages
                .map((p) => `- "${p.title}"${p.summary ? `: ${p.summary}` : ''}`)
                .join('\n');
            researchContext = `\n\nUser has marked these pages as research-related:\n${pageDescriptions}\nIf current page is similar to any research page, consider it FOCUSED.`;
        }

        // Build keywords context
        let keywordsContext = '';
        if (currentFocus.keywords && currentFocus.keywords.length > 0) {
            keywordsContext = `\nFocus keywords: ${currentFocus.keywords.join(', ')}`;
        }

        let focusContext = '';
        if (focusTitle) focusContext += `Focus Session started on: "${focusTitle}"\n`;
        if (currentFocus.description) focusContext += `User goal: "${currentFocus.description}"\n`;
        if (keywordsContext) focusContext += `${keywordsContext}\n`;
        if (focusContent) focusContext += `Focus content: "${focusContent}"\n`;
        if (researchContext) focusContext += `${researchContext}\n`;

        const prompt = `${focusContext}

Current page: "${currentTitle}"
${currentContent ? `Current content: "${currentContent}"` : ''}

Determine if the user has drifted based on their GOAL and KEYWORDS.

CRITICAL RULES:
1. KEYWORDS ARE AUTHORITATIVE: If the current page title or content contains ANY of the focus keywords (case-insensitive match), it is FOCUSED. No exceptions.
2. The Focus Session origin tab is only context - prioritize the user's description and keywords over the origin tab content.
3. Be lenient - research, learning, and exploration related to the keywords or goal is FOCUSED.

- FOCUSED: Content contains focus keywords, is related to the user's stated goal, or could reasonably support the focused work.
- DRIFTED: Content is clearly unrelated to ALL keywords AND the goal, such as entertainment, social media, or completely off-topic content.

Answer in this format:
VERDICT: FOCUSED or DRIFTED
REASON: Brief explanation why`;

        const response = await session.prompt(prompt);
        session.destroy();

        const isDrifted = response.toUpperCase().includes('DRIFTED');
        const reasonMatch = response.match(/REASON:\s*(.+)/i);
        const reason = reasonMatch
            ? reasonMatch[1].trim()
            : response.replace(/DRIFTED:?/i, '').replace(/FOCUSED:?/i, '').trim();
        console.debug(`[Focus] AI verdict: ${isDrifted ? 'DRIFTED' : 'FOCUSED'} - Reason: ${reason}`);

        return { isDrifted, reason };
    } catch (e) {
        console.error('[FetchFocus] AI similarity check failed:', e);
        if (!focusTitle) return { isDrifted: false, reason: 'AI check failed, no title to compare' };
        const isDrifted = !areTitlesRelated(focusTitle, currentTitle);
        return { isDrifted, reason: 'AI check failed, fallback to title comparison' };
    }
}

/**
 * Analyze tab switching pattern for drift using AI
 */
export async function analyzeTabSwitchingDrift(
    currentFocus: FocusSession,
    summary: string,
    locale: string
): Promise<{ isDrifted: boolean; reason: string }> {
    try {
        const availability = await LanguageModel.availability();
        if (availability !== 'available') {
            return { isDrifted: false, reason: 'AI not available' };
        }

        const responseLanguage = getAIResponseLanguage(locale);
        const session = await LanguageModel.create({
            initialPrompts: [
                {
                    role: 'system',
                    content: `You analyze if a user has drifted from their focused work. Be LENIENT - if the current page is on a related topic, similar domain, or could reasonably support the focused work, consider it FOCUSED. Only mark as DRIFTED if the content is clearly unrelated entertainment, social media, or completely off-topic. Respond with FOCUSED or DRIFTED followed by a brief reason. IMPORTANT: Your REASON must be written in ${responseLanguage}.`,
                },
            ],
        });

        const prompt = `Focus Goal: "${currentFocus.pageTitle}"
${currentFocus.description ? `Description: "${currentFocus.description}"` : ''}

Recent browsing activity (past minute):
${summary}

Determine if the user has drifted. Be LENIENT:
- FOCUSED: Same topic, related subject matter, research, documentation, tools that support the work, or anything that could reasonably help with the focus goal
- DRIFTED: Clearly unrelated content like social media feeds, entertainment, gaming, news unrelated to work, shopping, etc.

When in doubt, choose FOCUSED. Answer in this format:
VERDICT: FOCUSED or DRIFTED
REASON: Brief explanation why`;

        const response = await session.prompt(prompt);
        session.destroy();

        const isDrifted = response.toUpperCase().includes('DRIFTED');
        const reasonMatch = response.match(/REASON:\s*(.+)/i);
        const reason = reasonMatch ? reasonMatch[1].trim() : response.replace(/DRIFTED:?/i, '').trim();
        console.debug(`[FetchFocus] AI verdict: ${isDrifted ? 'DRIFTED' : 'FOCUSED'} - Reason: ${reason}`);

        return { isDrifted, reason };
    } catch (e) {
        console.error('[FetchFocus] AI tab check failed:', e);
        return { isDrifted: false, reason: 'AI check failed' };
    }
}
