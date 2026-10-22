import * as fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import type { PageInterface } from '../../../../src/app/interfaces/page.interface';
import { pageLocation } from '../../../../src/app/links/layout';
import {
    type LabelMap,
    resolveAdditionalPages
} from '../../../../src/app/page-generator/additional-page-resolver';
import {
    type AdditionalPageContent,
    buildAdditionalPages,
    isAdditionalGroup,
    skippedPageMessage
} from '../../../../src/app/page-generator/additional-page-tree';
import { err, isOk, ok, type Result } from '../../../../src/lib';

const fixture = 'test/fixtures/additional-identity';

const readJson = (file: string): unknown => JSON.parse(fs.readFileSync(file, 'utf8'));

const resolvedOf = (summary: unknown, labels?: LabelMap) => {
    const result = resolveAdditionalPages(summary, labels, 'labels.json');
    if (!isOk(result)) {
        throw new Error(result.message);
    }
    return result.value;
};

const read = (file: string): Result<AdditionalPageContent> =>
    ok({ html: `<p>${file}</p>`, raw: `# ${file}\n` });

/** A reader for which the `missing` files do not exist. */
const readWithout =
    (...missing: string[]) =>
    (file: string): Result<AdditionalPageContent> =>
        missing.includes(file) ? err(`${file} not found`) : read(file);

const locate = (segments: readonly string[]) =>
    pageLocation({ type: 'additional', folder: 'additional-documentation', slugs: segments });

const outline = (pages: readonly PageInterface[]) =>
    pages.map(page => ({
        name: page.name,
        path: `${page.path}/${page.filename}`,
        children: (page.children ?? []).map(child => `${child.path}/${child.filename}`)
    }));

/** Top-level entries as `group <name>` or the page path, with the child paths. */
const entries = (pages: readonly PageInterface[]) =>
    pages.map(page => [
        isAdditionalGroup(page) ? `group ${page.name}` : `${page.path}/${page.filename}`,
        ...(page.children ?? []).map(child => `${child.path}/${child.filename}`)
    ]);

describe('buildAdditionalPages', () => {
    it('builds the tree of the additional-identity summary', () => {
        const resolved = resolvedOf(
            readJson(`${fixture}/en/summary.json`),
            readJson(`${fixture}/labels.json`) as LabelMap
        );
        const { pages, aliases } = buildAdditionalPages(resolved, read, locate);

        expect(outline(pages)).toEqual([
            {
                name: 'Error reference',
                path: 'additional-documentation/errors',
                children: [
                    'additional-documentation/errors/e0001',
                    'additional-documentation/errors/e0002',
                    'additional-documentation/errors/e0003',
                    'additional-documentation/errors/e0004'
                ]
            },
            {
                name: 'Guides',
                path: 'additional-documentation/guides',
                children: ['additional-documentation/guides/getting-started']
            }
        ]);
        expect(aliases).toEqual([
            {
                from: 'additional-documentation/errors/e0003-old-name.html',
                to: 'additional-documentation/errors/e0003.html',
                title: 'Renamed page'
            },
            {
                from: 'additional-documentation/e0003.html',
                to: 'additional-documentation/errors/e0003.html',
                title: 'Renamed page'
            }
        ]);
    });

    it('fills a page from its resolved node, its content and its location', () => {
        const [errors] = buildAdditionalPages(
            resolvedOf(
                readJson(`${fixture}/en/summary.json`),
                readJson(`${fixture}/labels.json`) as LabelMap
            ),
            read,
            locate
        ).pages;
        const renamed = errors.children[2];

        expect(renamed).toEqual({
            name: 'E0003: from labels file',
            displayName: 'Renamed page',
            pageHeading: 'Renamed page',
            id: 'errors/e0003',
            filename: 'e0003',
            context: 'additional-page',
            path: 'additional-documentation/errors',
            additionalPage: '<p>errors/e0003.md</p>',
            additionalPageSource: {
                slug: 'errors/e0003',
                file: 'errors/e0003.md',
                markdown: '# errors/e0003.md\n'
            },
            aiGenerated: false,
            depth: 2,
            childrenLength: 0,
            children: [],
            lastChild: false,
            pageType: 'internal'
        });
    });

    it('skips a page whose file is missing and keeps its siblings', () => {
        const { pages, skipped } = buildAdditionalPages(
            resolvedOf([
                { title: 'A', file: 'a.md' },
                { title: 'Gone', file: 'gone.md' },
                { title: 'C', file: 'c.md', children: [{ title: 'Lost', file: 'lost.md' }] }
            ]),
            readWithout('gone.md', 'lost.md'),
            locate
        );

        expect(outline(pages)).toEqual([
            { name: 'A', path: 'additional-documentation/a', children: [] },
            { name: 'C', path: 'additional-documentation/c', children: [] }
        ]);
        expect(skipped).toEqual([
            { nodePath: '[1]', file: 'gone.md' },
            { nodePath: '[2].children[0]', file: 'lost.md' }
        ]);
        expect(skipped.map(skippedPageMessage)).toEqual([
            'Additional pages: summary.json[1] (gone.md) not found, page skipped',
            'Additional pages: summary.json[2].children[0] (lost.md) not found, page skipped'
        ]);
    });

    it('drops the aliases of a skipped page', () => {
        const { aliases } = buildAdditionalPages(
            resolvedOf([
                { title: 'A', file: 'a.md', aliases: ['old-a'] },
                { title: 'Gone', file: 'gone.md', aliases: ['old-gone'] }
            ]),
            readWithout('gone.md'),
            locate
        );

        expect(aliases).toEqual([
            {
                from: 'additional-documentation/old-a.html',
                to: 'additional-documentation/a.html',
                title: 'A'
            }
        ]);
    });

    it('turns a first node without a file into a group', () => {
        const { pages } = buildAdditionalPages(
            resolvedOf([{ title: 'Group', children: [{ title: 'A', file: 'a.md' }] }]),
            read,
            locate
        );

        expect(entries(pages)).toEqual([['group Group', 'additional-documentation/group/a']]);
        expect(pages[0]).toEqual({
            name: 'Group',
            id: 'group',
            context: 'additional-group',
            depth: 1,
            children: [expect.objectContaining({ name: 'A' })]
        });
    });

    it('keeps the pages of a group after a page out of that page', () => {
        const { pages } = buildAdditionalPages(
            resolvedOf([
                { title: 'First', file: 'first.md' },
                { title: 'Group', children: [{ title: 'B', file: 'b.md' }] },
                { title: 'Last', file: 'last.md' }
            ]),
            read,
            locate
        );

        expect(entries(pages)).toEqual([
            ['additional-documentation/first'],
            ['group Group', 'additional-documentation/group/b'],
            ['additional-documentation/last']
        ]);
    });

    it('builds groups for an object root', () => {
        const { pages } = buildAdditionalPages(
            resolvedOf({
                children: [
                    { title: 'First', file: 'first.md' },
                    { title: 'Group', children: [{ title: 'B', file: 'b.md' }] }
                ]
            }),
            read,
            locate
        );

        expect(entries(pages)).toEqual([
            ['additional-documentation/first'],
            ['group Group', 'additional-documentation/group/b']
        ]);
    });

    it('turns a depth-1 page with a missing file into a group for its children', () => {
        const { pages, skipped } = buildAdditionalPages(
            resolvedOf([
                { title: 'First', file: 'first.md' },
                {
                    title: 'Parent',
                    label: 'Parent label',
                    file: 'parent.md',
                    aliases: ['old-parent'],
                    children: [{ title: 'Kid', file: 'kid.md' }]
                }
            ]),
            readWithout('parent.md'),
            locate
        );

        expect(entries(pages)).toEqual([
            ['additional-documentation/first'],
            ['group Parent label', 'additional-documentation/parent/kid']
        ]);
        expect(pages[1].displayName).toBe('Parent');
        expect(skipped).toEqual([{ nodePath: '[1]', file: 'parent.md' }]);
    });

    it('leaves out a group without pages below it', () => {
        const { pages } = buildAdditionalPages(
            resolvedOf([
                { title: 'Empty', children: [] },
                { title: 'Gone', file: 'gone.md' },
                { title: 'Lost', children: [{ title: 'Kid', file: 'kid.md' }] },
                { title: 'A', file: 'a.md' }
            ]),
            readWithout('gone.md', 'kid.md'),
            locate
        );

        expect(entries(pages)).toEqual([['additional-documentation/a']]);
    });

    it('keeps the pages below a deeper node without a file under its depth-1 entry', () => {
        const { pages } = buildAdditionalPages(
            resolvedOf([
                {
                    title: 'Top',
                    file: 'top.md',
                    children: [{ title: 'Inner', children: [{ title: 'Deep', file: 'deep.md' }] }]
                },
                {
                    title: 'Group',
                    children: [{ title: 'Inner', children: [{ title: 'Deep', file: 'g.md' }] }]
                }
            ]),
            read,
            locate
        );

        expect(entries(pages)).toEqual([
            ['additional-documentation/top', 'additional-documentation/top/inner/deep'],
            ['group Group', 'additional-documentation/group/inner/deep']
        ]);
        expect(pages[0].children[0].depth).toBe(3);
    });
});
