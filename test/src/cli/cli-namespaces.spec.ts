import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ExportData } from '../../../src/app/interfaces/export-data.interface';
import type { PageKind } from '../../../src/app/links/layout';
import { shell, temporaryDir } from '../helpers';
import { menuOf } from '../helpers/menu';
import { pagesIn } from '../helpers/pages';

/** The type layout (the default is the feature layout). */
const TYPE_LAYOUT = path.resolve('test/fixtures/type-layout.compodocxrc.json');
const TSCONFIG = './test/fixtures/semantic-library/tsconfig.json';

const tmp = temporaryDir();

const generate = (folder: string, ...flags: string[]): void => {
    tmp.create(folder);
    shell('node', [
        './bin/index-cli.js',
        ...flags,
        '-p',
        TSCONFIG,
        '--disableSearch',
        '--no-multiVersion',
        '-d',
        folder
    ]);
};

describe('CLI namespaces', () => {
    const featureFolder = `${tmp.name}-namespaces-feature`;
    const typeFolder = `${tmp.name}-namespaces-type`;
    const pages = pagesIn(featureFolder);
    const typePages = pagesIn(typeFolder);
    const read = (kind: PageKind, name: string): string =>
        fs.readFileSync(path.join(featureFolder, pages.of(kind, name)), 'utf8');
    /** Link from the page of `kind`/`name` to the namespace page of `ns`. */
    const namespaceHref = (kind: PageKind, name: string, ns: string): string =>
        pages.href('namespace', ns, pages.depthOf(pages.of(kind, name)));

    beforeAll(() => {
        generate(featureFolder);
        generate(typeFolder, '-c', TYPE_LAYOUT);
    });
    afterAll(() => {
        tmp.clean(featureFolder);
        tmp.clean(typeFolder);
    });

    it('writes a namespace page that lists and links its members', () => {
        const html = read('namespace', 'Bridge');
        expect(html).to.contain('<span>Bridge</span>');
        expect(html).to.contain('cdx-badge--entity-namespace');
        expect(html).to.contain('Typed access to a third-party private surface.');
        const depth = pages.depthOf(pages.of('namespace', 'Bridge'));
        expect(html).to.contain(
            `<a href="${pages.href('interface', 'Bridge.StateSource', depth)}"><code>Bridge.StateSource</code></a>`
        );
        expect(html).to.contain(
            `<a href="${pages.href('namespace', 'Bridge.Inner', depth)}"><code>Bridge.Inner</code></a>`
        );
        expect(html).to.contain(`import { Bridge } from '@sem/core';`);
    });

    it('titles both same-name members by their qualified name and links their namespace', () => {
        for (const ns of ['Bridge', 'Other']) {
            const name = `${ns}.StateSource`;
            const html = read('interface', name);
            expect(html).to.contain(
                `<h1 class="cdx-entity-hero-name"><span class="">${name}</span>`
            );
            expect(html).to.contain(
                `Namespace <a href="${namespaceHref('interface', name, ns)}"><code>${ns}</code></a>`
            );
        }
    });

    it('documents a member of a dotted namespace under its full chain', () => {
        const html = read('variable', 'Bridge.Dotted.DOTTED');
        expect(html).to.contain('Bridge.Dotted.DOTTED');
        expect(html).to.contain(
            `<a href="${namespaceHref('variable', 'Bridge.Dotted.DOTTED', 'Bridge.Dotted')}"><code>Bridge.Dotted</code></a>`
        );
    });

    it('marks a module augmentation with its module', () => {
        const html = read('interface', 'Matchers');
        expect(html).to.contain('Augments <code>some-test-runner</code>');
        expect(html).to.not.contain('data-cdx-namespace=');
    });

    it('never documents a member that is not exported', () => {
        expect(() => pages.of('variable', 'Bridge.internalOnly')).toThrow();
        expect(read('namespace', 'Bridge')).to.not.contain('internalOnly');
        for (const folder of [featureFolder, typeFolder]) {
            expect(menuOf(folder)).to.not.contain('internalOnly');
            expect(fs.readFileSync(path.join(folder, 'js/entities.js'), 'utf8')).to.not.contain(
                'internalOnly'
            );
        }
    });

    it('lists the namespace in the sidebar under both layouts', () => {
        const featureMenu = menuOf(featureFolder);
        expect(featureMenu).to.contain(`href="${pages.of('namespace', 'Bridge')}"`);
        expect(featureMenu).to.contain('data-cdx-kind="namespace"');
        expect(featureMenu).to.contain(
            '<span class="cdx-menu-item-name">Bridge.StateSource</span>'
        );
        const typeMenu = menuOf(typeFolder);
        expect(typeMenu).to.contain('id="namespaces-links"');
        expect(typeMenu).to.contain(`href="${typePages.of('namespace', 'Bridge')}"`);
        expect(typeMenu).to.contain('<span class="cdx-menu-item-name">Bridge.Inner</span>');
    });

    it('indexes the namespace for the command palette', () => {
        const index = fs.readFileSync(path.join(featureFolder, 'js/entities.js'), 'utf8');
        expect(index).to.contain(
            `"Bridge":{"href":"${pages.of('namespace', 'Bridge')}","kind":"namespace"}`
        );
    });
});

describe('CLI namespaces in the exports', () => {
    const jsonFolder = `${tmp.name}-namespaces-json`;
    const publicFolder = `${tmp.name}-namespaces-public`;
    const llmFolder = `${tmp.name}-namespaces-llm`;
    const json = (folder: string): ExportData =>
        JSON.parse(fs.readFileSync(path.join(folder, 'documentation.json'), 'utf8'));
    const qualified = (list: { name: string; namespace?: string }[] = []): string[] =>
        list.map(item => (item.namespace ? `${item.namespace}.${item.name}` : item.name)).sort();

    beforeAll(() => {
        generate(jsonFolder, '-e', 'json');
        generate(
            publicFolder,
            '-e',
            'json',
            '--publicApiOnly',
            './test/fixtures/semantic-library/ng-packaged'
        );
        generate(llmFolder, '-e', 'llm-md');
    });
    afterAll(() => {
        tmp.clean(jsonFolder);
        tmp.clean(publicFolder);
        tmp.clean(llmFolder);
    });

    it('writes namespace and augments on the entries and the namespaces at the top level', () => {
        const data = json(jsonFolder);
        expect(qualified(data.namespaces)).toEqual([
            'Bridge',
            'Bridge.Dotted',
            'Bridge.Inner',
            'Other'
        ]);
        const bridge = data.namespaces?.find(entry => entry.name === 'Bridge');
        expect(bridge?.entryPoint).toBe('@sem/core');
        expect(bridge?.members).toContain('Bridge.StateSource');
        expect(qualified(data.interfaces)).toEqual(
            expect.arrayContaining(['Bridge.StateSource', 'Matchers', 'Other.StateSource'])
        );
        const matchers = data.interfaces?.find(entry => entry.name === 'Matchers');
        expect(matchers?.augments).toBe('some-test-runner');
        expect(matchers?.namespace).toBeUndefined();
    });

    it('keeps the namespace members under --publicApiOnly', () => {
        const data = json(publicFolder);
        expect(qualified(data.namespaces)).toEqual([
            'Bridge',
            'Bridge.Dotted',
            'Bridge.Inner',
            'Other'
        ]);
        expect(qualified(data.miscellaneous?.variables as never)).toEqual([
            'Bridge.Dotted.DOTTED',
            'Bridge.HOST_SELECTOR'
        ]);
    });

    it('heads llm-md entries with the qualified name and lists the namespaces', () => {
        const md = fs.readFileSync(path.join(llmFolder, 'llm-context.md'), 'utf8');
        expect(md).to.contain('### Bridge.StateSource');
        expect(md).to.contain('Namespace: Bridge');
        expect(md).to.contain('Augments: some-test-runner');
        expect(md).to.contain('## Namespaces');
        expect(md).not.to.contain('internalOnly');
    });
});
