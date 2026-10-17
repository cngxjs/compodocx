import * as fs from 'node:fs';
import * as path from 'node:path';
import { exists, hasStderrError, shell, temporaryDir } from '../helpers';
import { menuOf } from '../helpers/menu';
import { featurePage, pagesIn } from '../helpers/pages';

const tmp = temporaryDir();

/** Builds a temp copy of the semantic library, optionally with a config file next to it. */
const build = (folder: string, config?: object) => {
    tmp.create(folder);
    tmp.copy('./test/fixtures/semantic-library/', folder);
    if (config) {
        fs.writeFileSync(path.join(folder, '.compodocxrc.json'), JSON.stringify(config));
    }
    const ls = shell(
        'node',
        [
            '../bin/index-cli.js',
            '-p',
            './tsconfig.json',
            '--disableSearch',
            '--no-multiVersion',
            '-d',
            'documentation'
        ],
        { cwd: folder }
    );
    if (hasStderrError(ls.stderr.toString())) {
        console.error(`shell error: ${ls.stderr.toString()}`);
        throw new Error('error');
    }
    return ls.stdout.toString();
};

describe('CLI menuFeatureSections', () => {
    const defaultFolder = `${tmp.name}-menu-sections-default`;
    const customFolder = `${tmp.name}-menu-sections-custom`;
    const custom = `${customFolder}/documentation`;
    const pages = pagesIn(custom);
    let defaultMenu: string;
    let customMenu: string;
    let stdout: string;

    beforeAll(() => {
        build(defaultFolder);
        defaultMenu = menuOf(`${defaultFolder}/documentation`);
        stdout = build(customFolder, {
            menuFeatureSections: { types: 'hidden', configuration: 'top', bogus: 'more' }
        });
        customMenu = menuOf(custom);
    });
    afterAll(() => {
        tmp.clean(defaultFolder);
        tmp.clean(customFolder);
    });

    it('groups tokens and types into role nodes by default', () => {
        expect(defaultMenu).to.contain('id="features-group-core/tokens-configuration"');
        expect(defaultMenu).to.contain('id="features-group-core/tokens-more-types"');
        expect(defaultMenu).to.contain('>FooConfig<');
    });

    it('lists config accessors in the configuration role node', () => {
        const group = (id: string) => {
            const start = defaultMenu.indexOf(`id="${id}"`);
            return defaultMenu.slice(start, defaultMenu.indexOf('</ul>', start));
        };
        const configuration = group('features-group-core-configuration');
        const utilities = group('features-group-core-more-utilities');
        for (const name of ['injectFoo', 'injectFooLimit', 'injectBar', 'injectFooTheme']) {
            expect(configuration, name).to.contain(`>${name}<`);
            expect(utilities, name).not.to.contain(`>${name}<`);
        }
        for (const name of ['injectViaMethod', 'createThing']) {
            expect(utilities, name).to.contain(`>${name}<`);
            expect(configuration, name).not.to.contain(`>${name}<`);
        }
    });

    it('lists configuration flat at the top and leaves types out', () => {
        expect(customMenu).to.not.contain('-configuration"');
        expect(customMenu).to.not.contain('-more-types"');
        expect(customMenu).to.not.contain('>FooConfig<');
        const tokens = customMenu.slice(
            customMenu.indexOf('id="features-group-core/tokens"'),
            customMenu.indexOf('</ul>', customMenu.indexOf('id="features-group-core/tokens"'))
        );
        expect(tokens).to.contain('>FOO_CONFIG<');
        expect(customMenu).to.contain('id="features-group-core-more-utilities"');
    });

    it('keeps a hidden role on its pages', () => {
        expect(exists(`${custom}/${pages.of('interface', 'FooConfig')}`)).to.be.true;
        const feature = fs.readFileSync(`${custom}/${featurePage(['core', 'tokens'])}`, 'utf8');
        expect(feature).to.contain('FooConfig');
    });

    it('warns once about an unknown role and goes on', () => {
        expect(stdout).to.contain('menuFeatureSections: unknown role "bogus" ignored');
    });
});
