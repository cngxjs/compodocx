import { describe, expect, it } from 'vitest';
import { additionalTree } from '../../../../src/templates/helpers/additional-tree';

const page = (name: string, depth: number) => ({ name, depth });

/** `name(child, child)` notation of a tree. */
const shape = (nodes: ReturnType<typeof additionalTree<{ name: string; depth: number }>>): string =>
    nodes
        .map(node =>
            node.children.length > 0 ? `${node.page.name}(${shape(node.children)})` : node.page.name
        )
        .join(', ');

describe('additionalTree', () => {
    it('nests each page below the nearest shallower page before it', () => {
        const tree = additionalTree([
            page('a', 2),
            page('b', 2),
            page('b1', 3),
            page('b1x', 4),
            page('b2', 3),
            page('c', 2)
        ]);

        expect(shape(tree)).toBe('a, b(b1(b1x), b2), c');
    });

    it('attaches a page after a missing level to the nearest shallower page', () => {
        // A file-less node at depth 3 has no entry; its child at depth 4 follows b.
        expect(shape(additionalTree([page('b', 2), page('deep', 4), page('c', 2)]))).toBe(
            'b(deep), c'
        );
    });

    it('keeps pages that start deeper than the first level at the top', () => {
        expect(shape(additionalTree([page('deep', 3), page('a', 2)]))).toBe('deep, a');
    });

    it('returns an empty list for no pages', () => {
        expect(additionalTree([])).toEqual([]);
    });
});
