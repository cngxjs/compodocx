import { beforeAll, describe, expect, it } from 'vitest';
import {
    highlightCode,
    initHighlighter,
    resolveLanguage
} from '../../../../src/app/engines/syntax-highlight.engine';

/** github-light keyword colour. */
const KEYWORD_COLOUR = 'color:#D73A49';

describe('resolveLanguage', () => {
    it('keeps TypeScript for blocks without a language', () => {
        expect(resolveLanguage(undefined)).toBe('typescript');
        expect(resolveLanguage('none')).toBe('typescript');
    });

    it('maps aliases to the loaded language', () => {
        expect(resolveLanguage('sh')).toBe('bash');
        expect(resolveLanguage('yml')).toBe('yaml');
        expect(resolveLanguage('TS')).toBe('typescript');
        expect(resolveLanguage('angular')).toBe('angular-html');
        expect(resolveLanguage('ng-ts')).toBe('angular-ts');
    });

    it('falls back to plain text for a language that is not loaded', () => {
        expect(resolveLanguage('cobol')).toBe('text');
    });
});

describe('highlightCode language fallback', () => {
    beforeAll(async () => {
        await initHighlighter();
    });

    it('does not colour an unknown language as TypeScript', () => {
        const html = highlightCode('const a = 1;', { lang: 'cobol' });
        expect(html).not.toContain(KEYWORD_COLOUR);
    });

    it('colours Angular control flow and pipes that HTML leaves plain', () => {
        const code = '@if (a) { <b>{{ z | upper }}</b> }';
        expect(highlightCode(code, { lang: 'angular-html' })).not.toBe(
            highlightCode(code, { lang: 'html' })
        );
    });

    it('colours binding values as Angular expressions, not as strings', () => {
        const stringColour = 'color:#032F62';
        for (const [binding, value] of [
            ['[value]="user.name"', 'user.name'],
            ['(click)="save()"', 'save'],
            ['[(ngModel)]="query"', 'query'],
            ['*ngIf="row.ok"', 'row.ok']
        ]) {
            const html = highlightCode(`<input ${binding} />`, { lang: 'angular-html' });
            const valueSpan = new RegExp(
                `<span style="([^"]*)">${value.replace('.', '\\.')}<`
            ).exec(html);
            expect(valueSpan, binding).not.toBeNull();
            expect(valueSpan?.[1], binding).not.toContain(stringColour);
        }
    });

    it('colours bindings inside an inline component template', () => {
        const code = '@Component({\n  template: `<b (click)="go(a)"></b>`,\n})\nclass X {}';
        const html = highlightCode(code, { lang: 'angular-ts' });
        expect(html).toMatch(/<span style="[^"]*">go<\/span>/);
    });

    it('colours host binding values as Angular expressions', () => {
        const code =
            "@Component({\n  host: { '[class.empty]': 'items().length === 0' },\n})\nclass X {}";
        const html = highlightCode(code, { lang: 'angular-ts' });
        expect(html).toMatch(/<span style="[^"]*">items<\/span>/);
        expect(html).not.toContain("'items().length === 0'");
    });

    it('colours an aliased language', () => {
        expect(highlightCode('const a = 1;', { lang: 'ts' })).toContain(KEYWORD_COLOUR);
    });
});
