import {
    type DepGraphNode,
    walkDepGraph
} from '../../../../../src/app/engines/stackblitz/walk-dep-graph';

const node = (
    name: string,
    imports: string[] = [],
    extra: Partial<DepGraphNode> = {}
): DepGraphNode => ({
    name,
    file: `src/app/${name.toLowerCase()}.ts`,
    sourceCode: `// ${name}`,
    imports,
    ...extra
});

const resolverFor = (nodes: DepGraphNode[]) => {
    const map = new Map<string, DepGraphNode>(nodes.map(n => [n.name, n]));
    return (name: string) => map.get(name) ?? null;
};

describe('walkDepGraph', () => {
    it('returns just the root when there are no imports', () => {
        const nodes = [node('Root')];
        const result = walkDepGraph('Root', resolverFor(nodes));
        expect(result.ok).to.be.true;
        if (result.ok) {
            expect(result.value.map(n => n.name)).to.deep.equal(['Root']);
        }
    });

    it('walks one level of deps in BFS order', () => {
        const nodes = [node('Root', ['A', 'B']), node('A'), node('B')];
        const result = walkDepGraph('Root', resolverFor(nodes));
        expect(result.ok).to.be.true;
        if (result.ok) {
            expect(result.value.map(n => n.name)).to.deep.equal(['Root', 'A', 'B']);
        }
    });

    it('stops descending past the depth cap', () => {
        const nodes = [
            node('Root', ['A']),
            node('A', ['B']),
            node('B', ['C']),
            node('C', ['D']),
            node('D')
        ];
        const result = walkDepGraph('Root', resolverFor(nodes), { depth: 2 });
        expect(result.ok).to.be.true;
        if (result.ok) {
            expect(result.value.map(n => n.name)).to.deep.equal(['Root', 'A', 'B']);
        }
    });

    it('aborts with Result.err naming the root, cap, and walked files', () => {
        const ten = Array.from({ length: 10 }, (_, i) => `Node${i}`);
        const nodes = [node('Root', ten), ...ten.map(n => node(n))];
        const result = walkDepGraph('Root', resolverFor(nodes), { maxFiles: 5 });
        expect(result.ok).to.be.false;
        if (!result.ok) {
            expect(result.message).to.contain('"Root"');
            expect(result.message).to.contain('5-file cap');
            expect(result.message).to.contain('playgroundFileCountCap');
            // Lists the files walked before the cap was hit.
            expect(result.message).to.contain('Walked:');
        }
    });

    it('detects cycles without revisiting nodes', () => {
        const nodes = [node('A', ['B']), node('B', ['C']), node('C', ['A'])];
        const result = walkDepGraph('A', resolverFor(nodes));
        expect(result.ok).to.be.true;
        if (result.ok) {
            expect(result.value.map(n => n.name)).to.deep.equal(['A', 'B', 'C']);
        }
    });

    it('filters out @internal-tagged dependencies', () => {
        const nodes = [
            node('Root', ['Public', 'Private']),
            node('Public'),
            node('Private', [], { internal: true })
        ];
        const result = walkDepGraph('Root', resolverFor(nodes));
        expect(result.ok).to.be.true;
        if (result.ok) {
            expect(result.value.map(n => n.name)).to.deep.equal(['Root', 'Public']);
        }
    });
});
