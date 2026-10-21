import * as crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

const nested = (depth: number): unknown[] => {
    const build = (level: number): unknown => {
        const node = { title: `Level ${level}`, file: `level${level}.md` };
        return level === depth ? node : { ...node, children: [build(level + 1)] };
    };
    return [build(1)];
};

describe('resolveAdditionalPages', () => {
    let error: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        error.mockRestore();
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
});
