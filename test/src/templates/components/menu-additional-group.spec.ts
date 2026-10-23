import { beforeAll, describe, expect, it } from 'vitest';
import I18nEngine from '../../../../src/app/engines/i18n.engine';
import { Menu } from '../../../../src/templates/components/Menu';

beforeAll(() => {
    I18nEngine.init('en-US');
});

const dataWith = (additionalPages: unknown[]) => ({
    components: [],
    directives: [],
    injectables: [],
    pipes: [],
    classes: [],
    interfaces: [],
    guards: [],
    interceptors: [],
    entities: [],
    miscellaneous: null,
    additionalPages,
    includesName: 'Guides',
    appConfig: [],
    routes: null,
    disableRoutes: true,
    disableCoverage: true,
    disableOverview: true,
    disableDependencies: true,
    disableProperties: true,
    hideGenerator: true,
    groupDepth: 2,
    menuLayout: 'type',
    featuresName: '',
    referencesName: ''
});

const child = (name: string, slug: string, depth = 2) => ({
    name,
    path: `additional-documentation/${slug.split('/').slice(0, -1).join('/')}`,
    filename: slug.split('/').at(-1),
    depth,
    children: []
});

const group = {
    name: 'Group <label>',
    id: 'group',
    context: 'additional-group',
    depth: 1,
    children: [child('B', 'group/b'), child('Deep', 'group/inner/deep', 3)]
};

const first = {
    name: 'First',
    id: 'first-id',
    context: 'additional-page',
    path: 'additional-documentation',
    filename: 'first',
    depth: 1,
    children: []
};

/** The markup of the `<li>` whose toggler controls `id`. */
const entryOf = (html: string, id: string): string => {
    const start = html.lastIndexOf('<li', html.indexOf(`aria-controls="${id}"`));
    const end = html.indexOf('</ul></li>', start);
    return html.slice(start, end + '</ul></li>'.length);
};

describe('Menu additional pages group', () => {
    it('renders a group as a button toggler with its pages below it', () => {
        const html = Menu({ data: dataWith([first, group]) });
        const entry = entryOf(html, 'additional-group-group');

        expect(entry).to.match(
            /^<li class="chapter inner cdx-additional-group"[^>]*><button class="simple menu-toggler"/
        );
        expect(entry).to.include('type="button"');
        expect(entry).to.include('data-cdx-toggle="collapse"');
        expect(entry).to.include('data-cdx-target="#additional-group-group"');
        expect(entry).to.include('aria-expanded="false"');
        expect(entry).to.match(/<span class="link-name"[^>]*>Group &lt;label><\/span>/);
        expect(entry).to.match(/<ul class="links collapse" id="additional-group-group"[^>]*>/);
        expect(entry).to.include('href="additional-documentation/group/b.html"');
        expect(entry).to.include('class="link for-chapter3"');
        expect(entry).to.include('href="additional-documentation/group/inner/deep.html"');
        expect(entry).to.not.include('data-type="chapter-link"');
    });

    it('keeps a page before the group a plain link without children', () => {
        const html = Menu({ data: dataWith([first, group]) });
        const firstLink = html.indexOf('href="additional-documentation/first.html"');
        const groupStart = html.indexOf('aria-controls="additional-group-group"');

        expect(firstLink).to.be.greaterThan(-1);
        expect(firstLink).to.be.lessThan(groupStart);
        expect(html).to.not.include('additional-page-first-id');
    });

    it('renders a page with children as a link and a sibling toggle button', () => {
        const parent = {
            ...first,
            name: 'Parent <page>',
            id: 'parent-id',
            filename: 'parent',
            children: [child('Child', 'parent/child')]
        };
        const html = Menu({ data: dataWith([parent]) });
        const entry = entryOf(html, 'additional-page-parent-id');

        expect(entry).to.match(/^<li class="chapter inner cdx-additional-parent"[^>]*><a /);
        expect(entry).to.match(
            /<a data-type="chapter-link" href="additional-documentation\/parent.html" data-context-id="additional"[^>]*><span class="link-name" id="additional-page-parent-id-label"[^>]*>Parent &lt;page><\/span><\/a><button /
        );
        const button = entry.slice(entry.indexOf('<button'), entry.indexOf('</button>'));
        expect(button).to.include('class="cdx-additional-toggle"');
        expect(button).to.include('type="button"');
        expect(button).to.include('data-cdx-toggle="collapse"');
        expect(button).to.include('data-cdx-target="#additional-page-parent-id"');
        expect(button).to.include('aria-expanded="false"');
        expect(button).to.include('aria-controls="additional-page-parent-id"');
        expect(button).to.include('aria-labelledby="additional-page-parent-id-label"');
        expect(button).to.include('cdx-chevron');
        expect(entry).to.match(/<ul class="links collapse" id="additional-page-parent-id"[^>]*>/);
        expect(entry).to.include('href="additional-documentation/parent/child.html"');
        expect(entry).to.not.include('role="button"');
        expect(entry).to.not.include('menu-toggler');
    });
});
