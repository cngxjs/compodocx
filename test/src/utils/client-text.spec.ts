import i18next from 'i18next';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import I18nEngine from '../../../src/app/engines/i18n.engine';
import { clientTextAttribute, clientTexts } from '../../../src/templates/helpers/client-text';
import { pageLanguage } from '../../../src/templates/helpers/i18n';
import { CLIENT_TEXT, fillText, parseClientText } from '../../../src/utils/client-text';

describe('fillText', () => {
    it('fills known placeholders and keeps unknown ones', () => {
        expect(fillText('Show all {count} lines', { count: 42 })).toBe('Show all 42 lines');
        expect(fillText('{a} and {b}', { a: 'x' })).toBe('x and {b}');
    });
});

describe('parseClientText', () => {
    it('falls back to the English defaults', () => {
        expect(parseClientText(undefined)).toBe(CLIENT_TEXT);
        expect(parseClientText('not json')).toBe(CLIENT_TEXT);
        expect(parseClientText('null')).toBe(CLIENT_TEXT);
    });

    it('takes given strings and keeps defaults for missing or empty keys', () => {
        const texts = parseClientText(
            JSON.stringify({ 'show-less': 'Weniger anzeigen', 'search-start': '', x: 'y' })
        );
        expect(texts['show-less']).toBe('Weniger anzeigen');
        expect(texts['search-start']).toBe(CLIENT_TEXT['search-start']);
        expect(Object.keys(texts)).toEqual(Object.keys(CLIENT_TEXT));
    });
});

describe('clientTexts', () => {
    // Re-running `I18nEngine.init` keeps the first language; switch i18next itself.
    const use = (language: string) => i18next.changeLanguage(language);

    beforeAll(() => {
        I18nEngine.init('en-US');
    });

    afterAll(async () => {
        await use('en-US');
    });

    it('matches the English defaults in en-US', async () => {
        await use('en-US');
        expect(clientTexts()).toEqual(CLIENT_TEXT);
        expect(pageLanguage()).toBe('en-US');
    });

    it('translates every key and keeps the placeholders for the client', async () => {
        await use('de-DE');
        const texts = parseClientText(clientTextAttribute());
        expect(texts['show-all-lines']).toBe('Alle {count} Zeilen anzeigen');
        expect(fillText(texts['versions-showing'], { shown: 3, total: 9 })).toBe(
            '3 von 9 Versionen'
        );
        expect(texts['facet-kind']).not.toBe('Kind');
        expect(pageLanguage()).toBe('de-DE');
    });

    it('uses the fallback language for an unsupported one', async () => {
        await use('xx-XX');
        expect(pageLanguage()).toBe('en-US');
    });
});
