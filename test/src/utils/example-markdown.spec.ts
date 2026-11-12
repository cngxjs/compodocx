import { describe, expect, it } from 'vitest';
import { exampleMarkdown } from '../../../src/utils/utils';

describe('exampleMarkdown', () => {
    it('keeps a fenced body as written', () => {
        const body = '```typescript\nconst a = 1;\n```';
        expect(exampleMarkdown(body)).toBe(body);
    });

    it('keeps text around a fence as markdown', () => {
        const body = 'Usage:\n\n```ts\nfoo();\n```';
        expect(exampleMarkdown(body)).toBe(body);
    });

    it('wraps a body without a fence in an html fence', () => {
        expect(exampleMarkdown('<todomvc>The example</todomvc>')).toBe(
            '```html\n<todomvc>The example</todomvc>\n```'
        );
    });

    it('trims the body before wrapping it', () => {
        expect(exampleMarkdown('\n  {{ car | firstUpper }}\n')).toBe(
            '```html\n{{ car | firstUpper }}\n```'
        );
    });

    it('turns a caption into a bold label before the code', () => {
        expect(exampleMarkdown('<caption>Usage of fakeMethod</caption>\nfakeMethod();')).toBe(
            '<b><i>Usage of fakeMethod</i></b>\n\n```html\nfakeMethod();\n```'
        );
    });

    it('keeps a caption in front of a fenced body', () => {
        expect(exampleMarkdown('<caption>Usage</caption>\n```ts\nfoo();\n```')).toBe(
            '<b><i>Usage</i></b>\n\n```ts\nfoo();\n```'
        );
    });

    it('turns one line directly before a fence into a caption', () => {
        expect(exampleMarkdown('Call caseA\n```ts\ncaseA(1);\n```')).toBe(
            '<b><i>Call caseA</i></b>\n\n```ts\ncaseA(1);\n```'
        );
    });

    it('keeps several lines before a fence as markdown', () => {
        const body = 'First line\nsecond line\n```ts\nfoo();\n```';
        expect(exampleMarkdown(body)).toBe(body);
    });

    it('keeps text before a fence as code when no fence follows', () => {
        expect(exampleMarkdown('Basic usage\ncaseC(3);')).toBe(
            '```html\nBasic usage\ncaseC(3);\n```'
        );
    });

    it('returns an empty string for an empty body', () => {
        expect(exampleMarkdown('   ')).toBe('');
    });
});
