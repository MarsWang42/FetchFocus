import { describe, it, expect } from 'vitest';
import {
    getBaseUrl,
    areTitlesRelated,
    isInResearchPages,
    getAIResponseLanguage,
    ICON_PATHS,
} from '../backgroundUtils';
import type { ResearchPage } from '../types';

describe('getBaseUrl', () => {
    it('extracts origin and pathname from a URL', () => {
        expect(getBaseUrl('https://example.com/path/to/page')).toBe(
            'https://example.com/path/to/page'
        );
    });

    it('removes query parameters', () => {
        expect(getBaseUrl('https://example.com/page?foo=bar&baz=qux')).toBe(
            'https://example.com/page'
        );
    });

    it('removes hash fragments', () => {
        expect(getBaseUrl('https://example.com/page#section')).toBe(
            'https://example.com/page'
        );
    });

    it('handles URLs with both query and hash', () => {
        expect(getBaseUrl('https://example.com/page?q=1#top')).toBe(
            'https://example.com/page'
        );
    });

    it('returns original string for invalid URLs', () => {
        expect(getBaseUrl('not-a-url')).toBe('not-a-url');
    });

    it('handles URLs with ports', () => {
        expect(getBaseUrl('http://localhost:3000/api/test')).toBe(
            'http://localhost:3000/api/test'
        );
    });

    it('handles root paths', () => {
        expect(getBaseUrl('https://example.com/')).toBe('https://example.com/');
    });
});

describe('areTitlesRelated', () => {
    it('returns true for titles with overlapping words', () => {
        expect(
            areTitlesRelated(
                'Introduction to JavaScript Programming',
                'JavaScript Programming Guide'
            )
        ).toBe(true);
    });

    it('returns false for completely unrelated titles', () => {
        expect(
            areTitlesRelated('Cooking Recipes for Beginners', 'JavaScript Tutorial')
        ).toBe(false);
    });

    it('ignores short words (<=3 chars)', () => {
        expect(areTitlesRelated('The Art of War', 'The Art of Code')).toBe(false);
    });

    it('is case insensitive', () => {
        expect(
            areTitlesRelated('JAVASCRIPT BASICS', 'javascript fundamentals basics')
        ).toBe(true);
    });

    it('handles special characters', () => {
        expect(
            areTitlesRelated(
                'React.js - Component Patterns',
                'React Component Design Patterns'
            )
        ).toBe(true);
    });

    it('returns false when only one word overlaps', () => {
        expect(areTitlesRelated('Python Tutorial', 'Python Cooking')).toBe(false);
    });

    it('handles empty strings', () => {
        expect(areTitlesRelated('', '')).toBe(false);
        expect(areTitlesRelated('Some Title', '')).toBe(false);
    });
});

describe('isInResearchPages', () => {
    const researchPages: ResearchPage[] = [
        { url: 'https://docs.example.com/api', title: 'API Docs', timestamp: Date.now() },
        { url: 'https://github.com/project/repo', title: 'GitHub Repo', timestamp: Date.now() },
    ];

    it('returns true for matching URL', () => {
        expect(isInResearchPages('https://docs.example.com/api', researchPages)).toBe(
            true
        );
    });

    it('returns true ignoring query params', () => {
        expect(
            isInResearchPages('https://docs.example.com/api?version=2', researchPages)
        ).toBe(true);
    });

    it('returns false for non-matching URL', () => {
        expect(
            isInResearchPages('https://twitter.com/home', researchPages)
        ).toBe(false);
    });

    it('returns false for empty research pages', () => {
        expect(isInResearchPages('https://example.com', [])).toBe(false);
    });

    it('returns false for undefined research pages', () => {
        expect(isInResearchPages('https://example.com', undefined)).toBe(false);
    });

    it('returns false for different paths on same domain', () => {
        expect(
            isInResearchPages('https://docs.example.com/other', researchPages)
        ).toBe(false);
    });
});

describe('getAIResponseLanguage', () => {
    it('returns Chinese for zh locale', () => {
        expect(getAIResponseLanguage('zh')).toBe('Chinese (简体中文)');
    });

    it('returns Chinese for zh-CN locale', () => {
        expect(getAIResponseLanguage('zh-CN')).toBe('Chinese (简体中文)');
    });

    it('returns Chinese for zh-TW locale', () => {
        expect(getAIResponseLanguage('zh-TW')).toBe('Chinese (简体中文)');
    });

    it('returns English for en locale', () => {
        expect(getAIResponseLanguage('en')).toBe('English');
    });

    it('returns English for en-US locale', () => {
        expect(getAIResponseLanguage('en-US')).toBe('English');
    });

    it('returns English for other locales', () => {
        expect(getAIResponseLanguage('ja')).toBe('English');
        expect(getAIResponseLanguage('fr')).toBe('English');
    });
});

describe('ICON_PATHS', () => {
    it('has idle state paths', () => {
        expect(ICON_PATHS.idle).toEqual({
            16: 'icon/idle-16.png',
            32: 'icon/idle-32.png',
            48: 'icon/idle-48.png',
            128: 'icon/idle-128.png',
        });
    });

    it('has focused state paths', () => {
        expect(ICON_PATHS.focused).toEqual({
            16: 'icon/focused-16.png',
            32: 'icon/focused-32.png',
            48: 'icon/focused-48.png',
            128: 'icon/focused-128.png',
        });
    });
});
