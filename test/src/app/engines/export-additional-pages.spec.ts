import { describe, expect, it } from 'vitest';
import { exportAdditionalPages } from '../../../../src/app/engines/export-additional-pages';
import type { PageInterface } from '../../../../src/app/interfaces/page.interface';

const page = (
    name: string,
    slug: string,
    extra: Partial<PageInterface> = {},
    children: PageInterface[] = []
): PageInterface => ({
    name,
    id: slug,
    context: 'additional-page',
    additionalPage: `<p>${name}</p>`,
    additionalPageSource: { slug, file: `${slug}.md`, markdown: `# ${name}\n` },
    children,
    ...extra
});

describe('exportAdditionalPages', () => {
    it('keeps the tree with slug, title, file and the raw markdown', () => {
        const pages = [
            page('Guides', 'guides', {}, [page('Getting started', 'guides/getting-started')])
        ];
        expect(exportAdditionalPages(pages)).toEqual([
            {
                slug: 'guides',
                title: 'Guides',
                file: 'guides.md',
                markdown: '# Guides\n',
                children: [
                    {
                        slug: 'guides/getting-started',
                        title: 'Getting started',
                        file: 'guides/getting-started.md',
                        markdown: '# Getting started\n'
                    }
                ]
            }
        ]);
    });

    it('takes the title from displayName and writes the label only when it differs', () => {
        const [entry] = exportAdditionalPages([
            page('E0002: node label', 'errors/e0002', { displayName: 'Value changed' })
        ]);
        expect(entry.title).toBe('Value changed');
        expect(entry.label).toBe('E0002: node label');
        expect(exportAdditionalPages([page('Same', 'same')])[0]).not.toHaveProperty('label');
    });

    it('writes aiGenerated only when the page carries the marker', () => {
        const [marked, plain] = exportAdditionalPages([
            page('Marked', 'marked', { aiGenerated: true }),
            page('Plain', 'plain', { aiGenerated: false })
        ]);
        expect(marked.aiGenerated).toBe(true);
        expect(plain).not.toHaveProperty('aiGenerated');
    });

    it('normalises backslashes in the slug and file', () => {
        const [entry] = exportAdditionalPages([
            page('Win', 'win', {
                additionalPageSource: {
                    slug: 'guides\\win',
                    file: 'guides\\win.md',
                    markdown: 'Text'
                }
            })
        ]);
        expect(entry.slug).toBe('guides/win');
        expect(entry.file).toBe('guides/win.md');
    });

    it('gives nothing for no pages and skips pages without a source', () => {
        expect(exportAdditionalPages([])).toEqual([]);
        expect(exportAdditionalPages(undefined)).toEqual([]);
        expect(
            exportAdditionalPages([page('Bare', 'bare', { additionalPageSource: undefined })])
        ).toEqual([]);
    });

    it('writes the pages of a group in its place, without a group entry', () => {
        const group: PageInterface = {
            name: 'Group',
            id: 'group',
            context: 'additional-group',
            depth: 1,
            children: [page('B', 'group/b'), page('C', 'group/c')]
        };
        const exported = exportAdditionalPages([
            page('First', 'first'),
            group,
            page('Last', 'last')
        ]);
        expect(exported.map(entry => entry.slug)).toEqual(['first', 'group/b', 'group/c', 'last']);
        expect(exported.every(entry => entry.children === undefined)).toBe(true);
    });

    it('does not mutate the page objects', () => {
        const pages = [page('Guides', 'guides', {}, [page('Child', 'guides/child')])];
        const before = structuredClone(pages);
        exportAdditionalPages(pages);
        expect(pages).toEqual(before);
    });
});
