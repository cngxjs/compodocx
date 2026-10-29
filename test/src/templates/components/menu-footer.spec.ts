import { beforeAll, describe, expect, it } from 'vitest';
import I18nEngine from '../../../../src/app/engines/i18n.engine';
import { Menu } from '../../../../src/templates/components/Menu';

beforeAll(() => {
    I18nEngine.init('en-US');
});

const data = (hideGenerator: boolean) => ({
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
    additionalPages: [],
    appConfig: [],
    routes: null,
    disableRoutes: true,
    disableCoverage: true,
    disableOverview: true,
    disableDependencies: true,
    disableProperties: true,
    hideGenerator,
    groupDepth: 2,
    menuLayout: 'type',
    featuresName: '',
    referencesName: ''
});

describe('Menu generator footer', () => {
    it('follows the menu nav instead of sitting in its list', () => {
        const html = Menu({ data: data(false) } as never);
        const navEnd = html.indexOf('</nav>');
        const footer = html.indexOf('class="copyright cdx-sidebar-footer"');
        expect(html).to.match(/^<nav class="cdx-sidebar-menu"/);
        expect(footer).to.be.greaterThan(navEnd);
        expect(html.slice(0, navEnd)).to.not.contain('copyright');
        expect(html.slice(footer)).to.contain('href="https://compodocx.dev/"');
    });

    it('leaves the footer out with hideGenerator', () => {
        const html = Menu({ data: data(true) } as never);
        expect(html).to.not.contain('cdx-sidebar-footer');
        expect(html).to.match(/<\/nav>\s*$/);
    });
});
