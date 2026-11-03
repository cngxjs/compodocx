import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { attachNeighbourReadme } from '../../../../src/app/page-generator/neighbour-readme';

let dir: string;

const entityWithReadme = (name: string, markdown: string | undefined) => {
    const file = path.join(dir, `${name}.ts`);
    fs.writeFileSync(file, `export class ${name} {}\n`);
    if (markdown !== undefined) {
        fs.writeFileSync(path.join(dir, `${name}.md`), markdown);
    }
    return { name, file } as { name: string; file: string; readme?: string };
};

beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-neighbour-readme-'));
});

afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
});

describe('attachNeighbourReadme', () => {
    it('returns the marker value and renders the README', () => {
        const entity = entityWithReadme('WithValue', '<!-- @aiGenerated 2026-11 -->\n\n# Hi\n');
        expect(attachNeighbourReadme(entity)).toEqual({ symbolReadmeAiGenerated: '2026-11' });
        expect(entity.readme).toContain('>Hi<');
    });

    it('returns true for the bare marker', () => {
        const entity = entityWithReadme('Bare', '<!-- @aiGenerated -->\n# Hi\n');
        expect(attachNeighbourReadme(entity)).toEqual({ symbolReadmeAiGenerated: true });
    });

    it('returns no field for a README without the marker', () => {
        const entity = entityWithReadme('Plain', '# Hi\n\nText\n');
        expect(attachNeighbourReadme(entity)).toEqual({});
        expect(entity.readme).toContain('<p>Text</p>');
    });

    it('leaves the entity alone without a README', () => {
        const entity = entityWithReadme('NoReadme', undefined);
        expect(attachNeighbourReadme(entity)).toEqual({});
        expect(entity.readme).toBeUndefined();
    });

    it('accepts an entity without a file', () => {
        expect(attachNeighbourReadme({ name: 'Ghost' })).toEqual({});
    });
});
