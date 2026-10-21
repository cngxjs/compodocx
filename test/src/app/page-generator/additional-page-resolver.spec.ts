import * as crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pageLocation } from '../../../../src/app/links/layout';
import {
    type ResolvedAdditionalPage,
    resolveAdditionalPages
} from '../../../../src/app/page-generator/additional-page-resolver';
import { isOk } from '../../../../src/lib';
import { logger } from '../../../../src/utils/logger';
import { cleanNameWithoutSpaceAndToLowerCase } from '../../../../src/utils/utils';

const resolvedOf = (summary: unknown): readonly ResolvedAdditionalPage[] => {
    const result = resolveAdditionalPages(summary);
    if (!isOk(result)) {
        throw new Error(result.message);
    }
    return result.value;
};

const errorOf = (summary: unknown): string => {
    const result = resolveAdditionalPages(summary);
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
            `Additional pages: invalid slug "${slug}" at summary.json[1].children[0] (bad.md); expected one segment matching ^[a-z0-9][a-z0-9._-]*$`
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
});
