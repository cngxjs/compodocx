import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ExportData } from '../../../src/app/interfaces/export-data.interface';
import { shell, temporaryDir } from '../helpers';
import { menuOf } from '../helpers/menu';
import { featurePage, pagesIn } from '../helpers/pages';

/** The type layout (the default is the feature layout). */
const TYPE_LAYOUT = path.resolve('test/fixtures/type-layout.compodocxrc.json');

const tmp = temporaryDir();

const SOURCES: Record<string, string> = {
    'tsconfig.json': JSON.stringify({
        compilerOptions: { target: 'ES2022', module: 'ES2022', moduleResolution: 'bundler' },
        include: ['src/**/*.ts']
    }),
    'src/geometry.ts': `/** Shapes and points. */
export namespace Geometry {
    /** A point in the plane. */
    export interface Point { x: number; y: number; }
    /** Distance between two points. */
    export function distance(a: Point, b: Point): number { return Math.hypot(a.x - b.x, a.y - b.y); }
}
`,
    'src/api.ts': `import { Geometry } from './geometry';
import G = Geometry;

/** The public API surface. */
export namespace Api {
    /** The point type of the API. */
    export import Point = Geometry.Point;
    export import distance = G.distance;
}

/** Nothing inside. */
export namespace Empty {}

/** A top-level alias. */
export import Pt = Geometry.Point;
`,
    'src/shape.ts': `import { Api, Pt } from './api';

/** Uses {@link Pt} and {@link Api.Point}. */
export interface Shape {
    origin: Pt;
    corner: Api.Point;
}
`,
    'src/index.ts': `export * from './geometry';
export * from './api';
export * from './shape';
`
};

describe('CLI namespace aliases', () => {
    const project = `${tmp.name}-ns-alias-project`;
    const htmlFolder = `${tmp.name}-ns-alias-html`;
    const typeFolder = `${tmp.name}-ns-alias-type`;
    const jsonFolder = `${tmp.name}-ns-alias-json`;
    const llmFolder = `${tmp.name}-ns-alias-llm`;
    const pages = pagesIn(htmlFolder);

    const generate = (folder: string, ...flags: string[]): void => {
        tmp.create(folder);
        shell('node', [
            './bin/index-cli.js',
            ...flags,
            '-p',
            path.join(project, 'tsconfig.json'),
            '--disableSearch',
            '--no-multiVersion',
            '-d',
            folder
        ]);
    };
    const read = (file: string): string =>
        fs.readFileSync(path.join(htmlFolder, pages.of('namespace', file)), 'utf8');

    beforeAll(() => {
        tmp.create(project);
        for (const [file, text] of Object.entries(SOURCES)) {
            fs.mkdirSync(path.dirname(path.join(project, file)), { recursive: true });
            fs.writeFileSync(path.join(project, file), text);
        }
        generate(htmlFolder);
        generate(typeFolder, '-c', TYPE_LAYOUT);
        generate(jsonFolder, '-e', 'json');
        generate(llmFolder, '-e', 'llm-md');
    });
    afterAll(() => {
        for (const folder of [project, htmlFolder, typeFolder, jsonFolder, llmFolder]) {
            tmp.clean(folder);
        }
    });

    it('lists each alias in its namespace, linked to the target page', () => {
        const html = read('Api');
        const depth = pages.depthOf(pages.of('namespace', 'Api'));
        expect(html).to.contain(
            `<a href="${pages.href('interface', 'Geometry.Point', depth)}"><code>Api.Point</code></a>`
        );
        expect(html).to.contain(
            `<a href="${pages.href('function', 'Geometry.distance', depth)}"><code>Api.distance</code></a>`
        );
        expect(html).to.contain('data-cdx-namespace-alias="Geometry.distance"');
        expect(html).to.contain('The point type of the API');
        expect(html).to.contain('Distance between two points');
    });

    it('gives an alias and an empty namespace no page, menu or palette entry', () => {
        expect(() => pages.of('namespace', 'Empty')).toThrow();
        expect(() => pages.of('interface', 'Api.Point')).toThrow();
        for (const folder of [htmlFolder, typeFolder]) {
            const menu = menuOf(folder);
            const item = (name: string) => `<span class="cdx-menu-item-name">${name}</span>`;
            expect(menu).to.contain(item('Api'));
            expect(menu).to.not.contain(item('Empty'));
            expect(menu).to.not.contain(item('Api.Point'));
            const index = fs.readFileSync(path.join(folder, 'js/entities.js'), 'utf8');
            expect(index).to.not.contain('"Empty"');
            expect(index).to.not.contain('"Pt"');
        }
    });

    it('resolves alias names in descriptions and types to the target page', () => {
        const html = fs.readFileSync(path.join(htmlFolder, pages.of('interface', 'Shape')), 'utf8');
        const depth = pages.depthOf(pages.of('interface', 'Shape'));
        const href = pages.href('interface', 'Geometry.Point', depth);
        expect(html).to.contain(
            `Uses <a href="${href}">Pt</a> and <a href="${href}">Api.Point</a>`
        );
        expect(html).to.match(new RegExp(`<a href="${href}"[^>]*>Pt</a>`));
    });

    it('reads {@link} as its link text in the feature summary and the sidebar preview', () => {
        const feature = fs.readFileSync(path.join(htmlFolder, featurePage(['app'])), 'utf8');
        expect(feature).to.contain('<td>Uses Pt and Api.Point</td>');
        expect(feature).to.not.contain('{@link');
        expect(menuOf(htmlFolder)).to.contain('data-cdx-desc="Uses Pt and Api.Point."');
    });

    it('writes the aliases to the JSON export and keeps the empty namespace there', () => {
        const data: ExportData = JSON.parse(
            fs.readFileSync(path.join(jsonFolder, 'documentation.json'), 'utf8')
        );
        const api = data.namespaces?.find(entry => entry.name === 'Api');
        expect(api?.aliases).toEqual([
            { name: 'Api.Point', target: 'Geometry.Point' },
            { name: 'Api.distance', target: 'Geometry.distance' }
        ]);
        expect(data.namespaces?.map(entry => entry.name)).toContain('Empty');
        expect(data.aliases).toEqual([{ name: 'Pt', target: 'Geometry.Point' }]);
    });

    it('lists the aliases in llm-md and skips the empty namespace', () => {
        const md = fs.readFileSync(path.join(llmFolder, 'llm-context.md'), 'utf8');
        expect(md).to.contain('- `Api.Point` -> `Geometry.Point`');
        expect(md).to.contain('## Aliases\n\n- `Pt` -> `Geometry.Point`');
        expect(md).to.not.contain('### Empty');
    });
});
