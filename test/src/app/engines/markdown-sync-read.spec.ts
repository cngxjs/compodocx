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
        const relative = path.relative(process.cwd(), absolute);
        expect(path.isAbsolute(relative)).toBe(false);
        expect(MarkdownEngine.getTraditionalMarkdownSyncWithRaw(relative).raw).toBe(
            '# Absolute page\n'
        );
        expect(MarkdownEngine.getTraditionalMarkdownSync(relative)).toContain('Absolute page');
    });
});
