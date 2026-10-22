import { describe, expect, it } from 'vitest';
import type {
    ExportAdditionalPage,
    ExportData
} from '../../../src/app/interfaces/export-data.interface';
import { emitLlmMd } from '../../../src/llm-md';
import { demoteHeadings, emitAdditionalPages } from '../../../src/llm-md/additional-pages';

const page = (
    title: string,
    markdown: string,
    children?: ExportAdditionalPage[]
): ExportAdditionalPage => ({
    slug: title.toLowerCase(),
    title,
    file: `${title.toLowerCase()}.md`,
    markdown,
    ...(children ? { children } : {})
});

describe('llm-md/additional-pages - demoteHeadings', () => {
    it('moves the shallowest heading below ### and keeps the steps between levels', () => {
        expect(demoteHeadings('# Top\n\nText\n\n## Sub\n\n### Deep')).toBe(
            '#### Top\n\nText\n\n##### Sub\n\n###### Deep'
        );
    });

    it('starts from the shallowest level the page uses', () => {
        expect(demoteHeadings('## Only second\n\n### Third')).toBe(
            '#### Only second\n\n##### Third'
        );
    });

    it('never promotes headings that are already deep enough', () => {
        expect(demoteHeadings('#### Four\n\n##### Five')).toBe('#### Four\n\n##### Five');
    });

    it('clamps to six levels', () => {
        expect(demoteHeadings('# One\n\n###### Six')).toBe('#### One\n\n###### Six');
    });

    it('leaves fenced code blocks untouched', () => {
        const markdown = [
            '# Title',
            '',
            '```bash',
            '# a shell comment',
            '```',
            '',
            '~~~~',
            '## not a heading',
            '~~~',
            '## still in the fence',
            '~~~~'
        ].join('\n');
        expect(demoteHeadings(markdown).split('\n')).toEqual([
            '#### Title',
            '',
            '```bash',
            '# a shell comment',
            '```',
            '',
            '~~~~',
            '## not a heading',
            '~~~',
            '## still in the fence',
            '~~~~'
        ]);
    });

    it('converts setext headings after a blank line and keeps thematic breaks', () => {
        expect(demoteHeadings('Title\n=====\n\nPart\n---\n\nText\n\n---\n\nEnd')).toBe(
            '#### Title\n\n##### Part\n\nText\n\n---\n\nEnd'
        );
    });

    it('leaves HTML comments, hashtags without a space and indented code alone', () => {
        const markdown = '<!--\n# hidden\n-->\n#hashtag\n\n    # code\n\n## Real';
        expect(demoteHeadings(markdown)).toBe(
            '<!--\n# hidden\n-->\n#hashtag\n\n    # code\n\n#### Real'
        );
    });

    it('gives text without headings back as it is', () => {
        expect(demoteHeadings('Just text.\n')).toBe('Just text.\n');
    });
});

describe('llm-md/additional-pages - emitAdditionalPages', () => {
    it('emits one ### block per page, children after their parent in tree order', () => {
        const out = emitAdditionalPages([
            page('Guides', '# Guides\n\nIntro.\n', [
                page('Start', '# Start\n\nStep one.\n'),
                page('Next', 'No heading.\n')
            ]),
            page('Errors', 'List.\n')
        ]);
        expect(out).toBe(
            [
                '### Guides',
                '',
                '#### Guides',
                '',
                'Intro.',
                '',
                '### Start',
                '',
                '#### Start',
                '',
                'Step one.',
                '',
                '### Next',
                '',
                'No heading.',
                '',
                '### Errors',
                '',
                'List.'
            ].join('\n')
        );
    });

    it('writes only the heading for an empty page', () => {
        expect(emitAdditionalPages([page('Empty', '  \n')])).toBe('### Empty');
    });

    it('gives an empty string without pages', () => {
        expect(emitAdditionalPages([])).toBe('');
    });
});

describe('llm-md/dispatcher - additional pages section', () => {
    const base: ExportData = {
        schemaVersion: 6,
        generatedAt: '2026-10-22T00:00:00.000Z',
        compodocxVersion: '0.0.0'
    };
    const options = { projectName: 'Demo' };
    const meta = { generatedAt: base.generatedAt, compodocxVersion: base.compodocxVersion };

    it('adds the section under the configured name after Routes and before Design tokens', () => {
        const out = emitLlmMd({
            meta,
            options: { ...options, additionalPagesName: 'Guides & more' },
            data: {
                ...base,
                routes: [
                    {
                        kind: 'unmounted',
                        array: 'routes',
                        routes: [{ path: 'a', fullPath: '/a' }]
                    }
                ],
                styleFiles: [
                    {
                        file: 'src/theme.css',
                        language: 'css',
                        tokens: [{ name: '--gap', description: 'Gap.', group: '', type: '' }]
                    }
                ],
                additionalPages: [page('Guides', '# Guides\n')]
            } as ExportData
        });
        const routes = out.indexOf('## Routes');
        const pages = out.indexOf('## Guides & more');
        const tokens = out.indexOf('## Design tokens');
        expect(routes).toBeGreaterThan(-1);
        expect(pages).toBeGreaterThan(routes);
        expect(tokens).toBeGreaterThan(pages);
        expect(out).toContain('## Guides & more\n\n### Guides\n\n#### Guides');
    });

    it('falls back to "Additional documentation" and omits the section without pages', () => {
        const withPages = emitLlmMd({
            meta,
            options,
            data: { ...base, additionalPages: [page('One', 'Text')] }
        });
        expect(withPages).toContain('## Additional documentation\n\n### One\n\nText');
        const without = emitLlmMd({ meta, options, data: base });
        expect(without).not.toContain('## Additional documentation');
    });
});
