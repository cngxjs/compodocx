import * as crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pageLocation } from '../../../../src/app/links/layout';
import {
    type LabelMap,
    parseLabelMap,
    type ResolvedAdditionalPage,
    type ResolvedAdditionalPages,
    resolveAdditionalPages
} from '../../../../src/app/page-generator/additional-page-resolver';
import { isOk } from '../../../../src/lib';
import { logger } from '../../../../src/utils/logger';
import { cleanNameWithoutSpaceAndToLowerCase } from '../../../../src/utils/utils';

const resolvedWithGroupsOf = (summary: unknown, labels?: LabelMap): ResolvedAdditionalPages => {
    const result = resolveAdditionalPages(summary, labels, 'labels.json');
    if (!isOk(result)) {
        throw new Error(result.message);
    }
    return result.value;
};

const resolvedOf = (summary: unknown, labels?: LabelMap): readonly ResolvedAdditionalPage[] =>
    resolvedWithGroupsOf(summary, labels).pages;

const errorOf = (summary: unknown, labels?: LabelMap): string => {
    const result = resolveAdditionalPages(summary, labels, 'labels.json');
    if (isOk(result)) {
        throw new Error('expected an error result');
    }
    return result.message;
};

const nested = (depth: number): unknown[] => {
    const build = (level: number): unknown => {
        const node = { title: `Level ${level}`, file: `level${level}.md` };
        return level === depth ? node : { ...node, children: [build(level + 1)] };
    };
    return [build(1)];
};

describe('resolveAdditionalPages', () => {
    let error: ReturnType<typeof vi.spyOn>;
    let warn: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
        warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
        error.mockRestore();
        warn.mockRestore();
    });

    it('lists nodes in document order, each node before its children', () => {
        const pages = resolvedOf([
            { title: 'A', file: 'a.md' },
            {
                title: 'B',
                file: 'b.md',
                children: [
                    { title: 'B1', file: 'b1.md', children: [{ title: 'B1a', file: 'b1a.md' }] },
                    { title: 'B2', file: 'b2.md' }
                ]
            },
            { title: 'C', file: 'c.md' }
        ]);
        expect(pages.map(p => p.title)).toEqual(['A', 'B', 'B1', 'B1a', 'B2', 'C']);
        expect(pages.map(p => p.nodePath)).toEqual([
            '[0]',
            '[1]',
            '[1].children[0]',
            '[1].children[0].children[0]',
            '[1].children[1]',
            '[2]'
        ]);
    });

    it('builds the segments from the titles on the chain, root first', () => {
        const pages = resolvedOf([
            {
                title: 'Guide Basics',
                file: 'guide.md',
                children: [{ title: 'Deep Dive', file: 'deep.md' }]
            }
        ]);
        expect(pages[1].segments).toEqual(['guide-basics', 'deep-dive']);
        expect(pages[1].title).toBe('Deep Dive');
        expect(pages[1].label).toBe('Deep Dive');
        expect(pages[1].heading).toBe(false);
        expect(pages[1].aliases).toEqual([]);
        expect(pages[1].domId).toBe(
            crypto.createHash('sha512').update('Deep Divedeep.md').digest('hex')
        );
    });

    it('skips nodes deeper than 5 levels and logs an error', () => {
        const pages = resolvedOf(nested(7));
        expect(pages.map(p => p.depth)).toEqual([1, 2, 3, 4, 5]);
        expect(error).toHaveBeenCalledTimes(2);
        expect(error).toHaveBeenCalledWith('Only 5 levels of depth are supported');
    });

    it('skips a node without a title', () => {
        const pages = resolvedOf([
            { file: 'untitled.md' },
            { title: 'Titled', file: 'titled.md' },
            { title: 'No file' }
        ]);
        expect(pages.map(p => p.file)).toEqual(['titled.md']);
        expect(pages[0].nodePath).toBe('[1]');
    });

    it('derives each segment with cleanNameWithoutSpaceAndToLowerCase', () => {
        const title = 'Signals & Reactivity: A Tour';
        const [page] = resolvedOf([{ title, file: 'signals.md' }]);
        expect(page.segments).toEqual([cleanNameWithoutSpaceAndToLowerCase(title)]);
    });

    it('reports childrenLength and the 1-based depth', () => {
        const pages = resolvedOf([
            {
                title: 'Parent',
                file: 'parent.md',
                children: [
                    { title: 'First', file: 'first.md' },
                    { title: 'Second', file: 'second.md', children: [] }
                ]
            }
        ]);
        expect(pages.map(p => [p.title, p.depth, p.childrenLength])).toEqual([
            ['Parent', 1, 2],
            ['First', 2, 0],
            ['Second', 2, 0]
        ]);
    });

    it('accepts a root object whose children array holds the nodes', () => {
        const nodes = [
            { title: 'A', file: 'a.md', children: [{ title: 'A1', file: 'a1.md' }] },
            { title: 'B', file: 'b.md' }
        ];
        const fromObject = resolvedOf({ title: 'Root', file: 'root.md', children: nodes });
        const fromArray = resolvedOf(nodes);
        expect(fromObject.map(p => [p.title, p.depth, p.segments])).toEqual(
            fromArray.map(p => [p.title, p.depth, p.segments])
        );
        expect(fromObject.map(p => p.nodePath)).toEqual([
            '.children[0]',
            '.children[0].children[0]',
            '.children[1]'
        ]);
    });

    it('lets an explicit slug replace only its own segment, also when it equals an ancestor slug', () => {
        const pages = resolvedOf([
            {
                title: 'Error Reference',
                slug: 'errors',
                file: 'errors.md',
                children: [{ title: 'Some Long Title', slug: 'e0001', file: 'e0001.md' }]
            },
            {
                title: 'Guide',
                slug: 'guide',
                file: 'guide.md',
                children: [{ title: 'Other', slug: 'guide', file: 'guide-inner.md' }]
            }
        ]);
        expect(pages.map(p => p.segments)).toEqual([
            ['errors'],
            ['errors', 'e0001'],
            ['guide'],
            ['guide', 'guide']
        ]);
        expect(pages.map(p => p.title)).toEqual([
            'Error Reference',
            'Some Long Title',
            'Guide',
            'Other'
        ]);
        expect(
            pageLocation({
                type: 'additional',
                folder: 'additional-documentation',
                slugs: pages[3].segments
            })
        ).toMatchObject({
            path: 'additional-documentation/guide',
            filename: 'guide'
        });
    });

    it('uses the slug of a slugged parent for the segments of its children', () => {
        const pages = resolvedOf([
            {
                title: 'Renamed Parent',
                slug: 'stable',
                file: 'parent.md',
                children: [{ title: 'Child Page', file: 'child.md' }]
            }
        ]);
        expect(pages[1].segments).toEqual(['stable', 'child-page']);
    });

    it.each([
        'Upper',
        'über',
        'a/b',
        '..',
        '.hidden',
        '',
        'a b'
    ])('rejects the invalid slug %j with the node path', slug => {
        const message = errorOf([
            { title: 'Ok', file: 'ok.md' },
            {
                title: 'Parent',
                file: 'parent.md',
                children: [{ title: 'Bad', slug, file: 'bad.md' }]
            }
        ]);
        expect(message).toBe(
            `Additional pages: invalid slug "${slug}" at summary.json[1].children[0] (bad.md); expected one segment of at most 200 characters matching ^[a-z0-9][a-z0-9._-]*$`
        );
    });

    it('accepts a slug of 200 characters and rejects one of 201', () => {
        const ok = 'a'.repeat(200);
        const [page] = resolvedOf([{ title: 'Long', slug: ok, file: 'long.md' }]);
        expect(page.segments).toEqual([ok]);
        const slug = 'a'.repeat(201);
        expect(errorOf([{ title: 'Long', slug, file: 'long.md' }])).toBe(
            `Additional pages: invalid slug "${slug}" at summary.json[0] (long.md); expected one segment of at most 200 characters matching ^[a-z0-9][a-z0-9._-]*$`
        );
    });

    it('rejects an alias with a segment of 201 characters', () => {
        const alias = `guides/${'a'.repeat(201)}`;
        expect(errorOf([{ title: 'Ok', file: 'ok.md', aliases: [alias] }])).toBe(
            `Additional pages: invalid alias "${alias}" at summary.json[0] (ok.md); each segment must have at most 200 characters and match ^[a-z0-9][a-z0-9._-]*$`
        );
    });

    it('rejects two derived slugs that give the same path and names both nodes and files', () => {
        const message = errorOf([
            { title: 'Same Name', file: 'one.md' },
            { title: 'Same name', file: 'two.md' }
        ]);
        expect(message).toBe(
            'Additional pages: "same-name.html" is claimed by summary.json[0] (one.md) and summary.json[1] (two.md)'
        );
    });

    it('rejects an explicit slug that collides with a derived slug', () => {
        const message = errorOf([
            { title: 'Getting Started', file: 'start.md' },
            { title: 'Anything', slug: 'getting-started', file: 'other.md' }
        ]);
        expect(message).toBe(
            'Additional pages: "getting-started.html" is claimed by summary.json[0] (start.md) and summary.json[1] (other.md)'
        );
    });

    it('treats NFC and NFD spellings of the same derived title as one path', () => {
        const message = errorOf([
            { title: 'caf\u00e9', file: 'nfc.md' },
            { title: 'cafe\u0301', file: 'nfd.md' }
        ]);
        expect(message).toContain(
            'is claimed by summary.json[0] (nfc.md) and summary.json[1] (nfd.md)'
        );
    });

    it('accepts multi-segment aliases and passes them on', () => {
        const [page] = resolvedOf([
            {
                title: 'Signals',
                slug: 'signals',
                file: 'signals.md',
                aliases: ['guides/signals-and-reactivity', 'old-signals']
            }
        ]);
        expect(page.aliases).toEqual(['guides/signals-and-reactivity', 'old-signals']);
    });

    it('rejects an alias that is not a path of slug segments, naming the node', () => {
        const message = errorOf([{ title: 'Ok', file: 'ok.md', aliases: ['fine', 'Not/Fine'] }]);
        expect(message).toBe(
            'Additional pages: invalid alias "Not/Fine" at summary.json[0] (ok.md); each segment must have at most 200 characters and match ^[a-z0-9][a-z0-9._-]*$'
        );
        expect(errorOf([{ title: 'Ok', file: 'ok.md', aliases: 'old' }])).toContain(
            'invalid alias "old"'
        );
        expect(errorOf([{ title: 'Ok', file: 'ok.md', aliases: [3] }])).toContain(
            'invalid alias "3"'
        );
    });

    it('rejects an alias equal to the path of its own page', () => {
        const message = errorOf([
            {
                title: 'Guides',
                slug: 'guides',
                children: [
                    { title: 'Intro', slug: 'intro', file: 'intro.md', aliases: ['guides/intro'] }
                ]
            }
        ]);
        expect(message).toBe(
            'Additional pages: alias "guides/intro" at summary.json[0].children[0] (intro.md) is the path of its own page'
        );
    });

    it('rejects an alias that is the path of another page, whichever comes first', () => {
        const message = errorOf([
            { title: 'One', slug: 'one', file: 'one.md', aliases: ['two'] },
            { title: 'Two', slug: 'two', file: 'two.md' }
        ]);
        expect(message).toBe(
            'Additional pages: "two.html" is claimed by summary.json[0] as alias (one.md) and summary.json[1] (two.md)'
        );
        expect(
            errorOf([
                { title: 'Two', slug: 'two', file: 'two.md' },
                { title: 'One', slug: 'one', file: 'one.md', aliases: ['two'] }
            ])
        ).toBe(
            'Additional pages: "two.html" is claimed by summary.json[0] (two.md) and summary.json[1] as alias (one.md)'
        );
        expect(
            errorOf([
                { title: 'Two', slug: 'two', file: 'two.md' },
                { title: 'One', slug: 'one', file: 'one.md', aliases: ['Two'] }
            ])
        ).toMatch(/^Additional pages: invalid alias "Two" at summary\.json\[1\]/);
    });

    it('rejects two aliases with the same path and names both nodes', () => {
        const message = errorOf([
            { title: 'One', slug: 'one', file: 'one.md', aliases: ['old'] },
            { title: 'Two', slug: 'two', file: 'two.md', aliases: ['old'] }
        ]);
        expect(message).toBe(
            'Additional pages: "old.html" is claimed by summary.json[0] as alias (one.md) and summary.json[1] as alias (two.md)'
        );
    });

    it('uses the path as DOM id with an explicit slug and the hash without', () => {
        const pages = resolvedOf([
            {
                title: 'Slugged',
                slug: 'fixed',
                file: 'a.md',
                children: [{ title: 'Kid', slug: 'kid', file: 'k.md' }]
            },
            { title: 'Plain', file: 'b.md' }
        ]);
        expect(pages[0].domId).toBe('fixed');
        expect(pages[1].domId).toBe('fixed/kid');
        expect(pages[2].domId).toBe(crypto.createHash('sha512').update('Plainb.md').digest('hex'));
    });

    it('warns about a slug below a parent without a slug and stays quiet when the parent has one', () => {
        resolvedOf([
            {
                title: 'No Slug',
                file: 'parent.md',
                children: [{ title: 'Child', slug: 'child', file: 'child.md' }]
            }
        ]);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith(
            'Additional pages: summary.json[0].children[0] has a slug but its parent summary.json[0] has none; renaming the parent moves this page'
        );

        warn.mockClear();
        resolvedOf([
            {
                title: 'With Slug',
                slug: 'parent',
                file: 'parent.md',
                children: [{ title: 'Child', slug: 'child', file: 'child.md' }]
            }
        ]);
        expect(warn).not.toHaveBeenCalled();
    });

    it('defaults the label to the title and heading to false', () => {
        const [page] = resolvedOf([{ title: 'Plain', file: 'plain.md' }]);
        expect(page.title).toBe('Plain');
        expect(page.label).toBe('Plain');
        expect(page.heading).toBe(false);
    });

    it('keeps the label independent of title and slug', () => {
        const pages = resolvedOf([
            {
                title: 'Long page title',
                label: 'Short',
                slug: 'fixed',
                heading: true,
                file: 'a.md',
                children: [{ title: 'Kid', label: 7, heading: 'yes', file: 'b.md' }]
            }
        ]);
        expect(pages[0].label).toBe('Short');
        expect(pages[0].title).toBe('Long page title');
        expect(pages[0].heading).toBe(true);
        expect(pages[0].segments).toEqual(['fixed']);
        expect(pages[1].label).toBe('Kid');
        expect(pages[1].heading).toBe(false);
    });

    it('rejects a node with a slug and no title', () => {
        expect(errorOf([{ slug: 'e0001', file: 'e.md' }])).toBe(
            'Additional pages: no title for summary.json[0] (e.md); set "title" on the node or in the labels file'
        );
    });

    it('lets the node beat the labels file for title and label', () => {
        const [page] = resolvedOf(
            [
                {
                    title: 'Node title',
                    label: 'Node label',
                    slug: 'e1',
                    file: 'e.md'
                }
            ],
            { e1: { title: 'File title', label: 'File label' } }
        );
        expect(page.title).toBe('Node title');
        expect(page.label).toBe('Node label');
    });

    it('lets the labels file beat the default for title and label', () => {
        const pages = resolvedOf(
            [
                { slug: 'e1', file: 'e.md' },
                { title: 'Plain', file: 'p.md' }
            ],
            {
                e1: { title: 'File title', label: 'File label' },
                plain: { label: 'Plain label' }
            }
        );
        expect(pages[0].title).toBe('File title');
        expect(pages[0].label).toBe('File label');
        expect(pages[1].title).toBe('Plain');
        expect(pages[1].label).toBe('Plain label');
    });

    it('never lets a labels file title change the derived slug', () => {
        const [page] = resolvedOf([{ title: 'Plain Page', file: 'p.md' }], {
            'plain-page': { title: 'Something else' },
            plainpage: { title: 'Another' }
        });
        expect(page.segments).toEqual([cleanNameWithoutSpaceAndToLowerCase('Plain Page')]);
        expect(page.title).toBe('Plain Page');
    });

    it('rejects a key that matches several pages and names all of them', () => {
        const message = errorOf(
            [
                { title: 'A', slug: 'dup', file: 'a.md' },
                {
                    title: 'B',
                    slug: 'b',
                    file: 'b.md',
                    children: [{ slug: 'dup', title: 'C', file: 'c.md' }]
                }
            ],
            { dup: { label: 'x' } }
        );
        expect(message).toBe(
            'Additional pages: labels file labels.json: key "dup" matches several pages: summary.json[0] (a.md), summary.json[1].children[0] (c.md)'
        );
    });

    it('warns about a key that matches no page and still resolves', () => {
        const pages = resolvedOf([{ title: 'A', slug: 'a', file: 'a.md' }], {
            a: { label: 'A1' },
            unused: { label: 'x' }
        });
        expect(pages).toHaveLength(1);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith(
            'Additional pages: labels file labels.json: key "unused" matches no page'
        );
    });

    it('does not warn about a key that titles a group without a file', () => {
        const pages = resolvedOf(
            [{ slug: 'group', children: [{ title: 'A', slug: 'a', file: 'a.md' }] }],
            { group: { title: 'Group' } }
        );
        expect(pages.map(page => page.segments)).toEqual([['group', 'a']]);
        expect(warn).not.toHaveBeenCalled();
    });

    it('lists the depth-1 nodes without a file as groups', () => {
        const { pages, groups } = resolvedWithGroupsOf(
            [
                { title: 'First', file: 'first.md' },
                {
                    title: 'Group',
                    label: 'Group label',
                    children: [{ title: 'Inner', children: [{ title: 'Deep', file: 'deep.md' }] }]
                },
                { slug: 'titled', children: [] }
            ],
            { titled: { title: 'From labels' } }
        );
        expect(pages.map(page => page.segments)).toEqual([['first'], ['group', 'inner', 'deep']]);
        expect(groups).toEqual([
            { nodePath: '[1]', segments: ['group'], title: 'Group', label: 'Group label' },
            { nodePath: '[2]', segments: ['titled'], title: 'From labels', label: 'From labels' }
        ]);
    });

    it('lists the groups of an object root with its node paths', () => {
        const { groups } = resolvedWithGroupsOf({
            children: [{ title: 'Group', children: [{ title: 'A', file: 'a.md' }] }]
        });
        expect(groups).toEqual([
            { nodePath: '.children[0]', segments: ['group'], title: 'Group', label: 'Group' }
        ]);
    });
});

describe('parseLabelMap', () => {
    const messageOf = (raw: string): string => {
        const result = parseLabelMap(raw, 'labels.json');
        if (isOk(result)) {
            throw new Error('expected an error result');
        }
        return result.message;
    };

    it('parses entries with optional label and title', () => {
        const result = parseLabelMap('{"a":{"label":"A"},"b":{"title":"B"},"c":{}}', 'labels.json');
        if (!isOk(result)) {
            throw new Error(result.message);
        }
        expect(result.value.a.label).toBe('A');
        expect(result.value.b.title).toBe('B');
        expect(result.value.c.label).toBeUndefined();
    });

    it('keeps a __proto__ key as an entry', () => {
        const result = parseLabelMap('{"__proto__":{"label":"P"}}', 'labels.json');
        if (!isOk(result)) {
            throw new Error(result.message);
        }
        expect(Object.hasOwn(result.value, '__proto__')).toBe(true);
    });

    it('rejects invalid JSON', () => {
        expect(messageOf('{nope')).toMatch(
            /^Additional pages: labels file labels\.json: invalid JSON \(/
        );
    });

    it('rejects an entry that is not an object', () => {
        expect(messageOf('{"a":"text"}')).toBe(
            'Additional pages: labels file labels.json: entry "a" is not an object'
        );
    });

    it('rejects a non-string label', () => {
        expect(messageOf('{"a":{"label":7}}')).toBe(
            'Additional pages: labels file labels.json: entry "a": "label" must be a string'
        );
    });
});
