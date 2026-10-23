import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import MarkdownEngine from '../../../../src/app/engines/markdown.engine';

describe('MarkdownEngine sync readers', () => {
    let dir: string;
    let absolute: string;

    beforeAll(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-markdown-'));
        absolute = path.join(dir, 'page.md');
        fs.writeFileSync(absolute, '# Absolute page\n');
    });

    afterAll(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('reads an absolute path as given', () => {
        const { html, raw } = MarkdownEngine.getTraditionalMarkdownSyncWithRaw(absolute);
        expect(raw).toBe('# Absolute page\n');
        expect(html).toContain('Absolute page');
        expect(MarkdownEngine.getTraditionalMarkdownSync(absolute)).toBe(html);
    });

    it('reads a cwd-relative path from the cwd', () => {
        // A fixture below the repo: the temp folder can be on another drive (Windows).
        const relative = path.join(
            'test',
            'fixtures',
            'additional-identity',
            'en',
            'errors',
            'index.md'
        );
        const expected = fs.readFileSync(path.join(process.cwd(), relative), 'utf8');
        expect(MarkdownEngine.getTraditionalMarkdownSyncWithRaw(relative).raw).toBe(expected);
        expect(MarkdownEngine.getTraditionalMarkdownSync(relative)).toContain(
            'This page lists the error codes (en).'
        );
    });
});
