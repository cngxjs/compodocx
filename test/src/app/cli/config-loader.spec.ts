import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
        silent: true,
        routeToStderr: false
    }
}));

vi.mock('../../../../src/app/engines/i18n.engine', () => ({
    default: {
        supportLanguage: vi.fn(() => true),
        fallbackLanguage: 'en-US'
    }
}));

import { applyConfigToMainData, loadConfigFile } from '../../../../src/app/cli/config-loader';
import type { MainDataInterface } from '../../../../src/app/interfaces/main-data.interface';
import { logger } from '../../../../src/utils/logger';
import { DEFAULT_MENU_FEATURE_SECTIONS } from '../../../../src/utils/menu-feature-sections';

const makeMainData = (): MainDataInterface => {
    return {
        output: './documentation/',
        outputProvided: false,
        theme: 'default',
        extTheme: '',
        customThemePath: '',
        shikiTheme: '',
        documentationMainName: 'Application documentation',
        assetsFolder: '',
        port: 8080,
        host: '127.0.0.1',
        hostname: '127.0.0.1',
        open: false,
        toggleMenuItems: ['all'],
        templates: '',
        navTabConfig: [],
        includes: '',
        includesName: 'Additional documentation',
        includesLabels: '',
        coverageTest: false,
        coverageTestThreshold: 70,
        coverageTestPerFile: false,
        coverageMinimumPerFile: 0,
        coverageTestThresholdFail: true,
        coverageTestShowOnlyFailed: false,
        unitTestCoverage: '',
        disableSourceCode: false,
        disableDomTree: false,
        disableTemplateTab: false,
        disableStyleTab: false,
        disableGraph: false,
        disableCoverage: false,
        disablePrivate: false,
        disableProtected: false,
        disableInternal: false,
        disableLifeCycleHooks: false,
        disableConstructors: false,
        disableRoutes: false,
        disableSearch: false,
        disableDependencies: false,
        disableDependenciesTab: false,
        disablePlaygroundTab: false,
        disableProperties: false,
        disableFilePath: false,
        disableOverview: false,
        showEffects: false,
        customFavicon: '',
        customLogo: '',
        customLogoDark: '',
        logoLayout: 'auto',
        gaID: '',
        publicApiOnly: '',
        maxSearchResults: 15,
        menuLayout: 'type',
        features: {},
        classificationAxes: {},
        featureContainers: ['features', 'pages', 'domains'],
        featureUtilityFolders: [
            'internal',
            'i18n',
            'utils',
            'testing',
            '__test-helpers',
            'examples'
        ],
        collapsedAll: false,
        language: 'en-US',
        watch: false,
        serve: false,
        exportFormat: 'html',
        jsonIndent: 0,
        multiVersion: true,
        versionLabel: '',
        versionsRoot: '',
        maxVersionsShown: 10,
        tsconfig: '',
        hideGenerator: false,
        hideDarkModeToggle: false,
        infoTabSections: [],
        apiTabSections: [],
        themingTabSections: [],
        themingPrivatePrefix: '--_',
        playgroundDependencies: {}
    } as unknown as MainDataInterface;
};

const makeProgram = (argv: readonly string[] = []): Command => {
    const program = new Command();
    program.exitOverride();
    program.allowExcessArguments();
    program
        .option('-c, --config [config]')
        .option('-d, --output [folder]', '', './documentation/')
        .option('--theme [theme]')
        .option('--includesLabels [path]')
        .option('--port [port]', '', '8080')
        .option('--exportFormat [format]', '', 'html')
        .option('--jsonIndent <spaces>', '', '0')
        .option('--multiVersion', '', true)
        .option('--no-multiVersion')
        .option('--versionLabel [label]')
        .option('--versionsRoot [path]')
        .option('--maxVersionsShown <n>', '', '10')
        .option('--maxSearchResults <n>', '', '15')
        .option('--gaID [id]')
        .option('--logoLayout [layout]')
        .option('--customLogo [path]')
        .option('--customLogoDark [path]')
        .option('--coverageTest [threshold]')
        .option('--coverageMinimumPerFile [minimum]')
        .option('--coverageTestThresholdFail [true|false]', '', true)
        .option('--showEffects', '', false)
        .option('--disableSearch', '', false)
        .option('-p, --tsconfig [config]')
        .option('--language [language]', '', 'en-US')
        .option('-t, --silent', '', true);

    program.parse(['node', 'compodocx', ...argv], { from: 'user' });
    return program;
};

describe('loadConfigFile', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-cfg-loader-')));
    });

    afterEach(() => {
        if (fs.existsSync(tmpDir)) {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it('returns ok({}) when no config file is found in cwd', () => {
        const result = loadConfigFile({ cwd: tmpDir });
        expect(result.ok).toBe(true);
        if (result.ok === false) {
            return;
        }
        expect(result.value.config).toEqual({});
        expect(result.value.explorerResult).toBe(null);
    });

    it('returns ok(config) for a directory containing a .compodocrc.json', () => {
        fs.writeFileSync(
            path.join(tmpDir, '.compodocrc.json'),
            JSON.stringify({ theme: 'ocean', port: 9000 })
        );
        const result = loadConfigFile({ cwd: tmpDir });
        expect(result.ok).toBe(true);
        if (result.ok === false) {
            return;
        }
        expect(result.value.config).toMatchObject({ theme: 'ocean', port: 9000 });
        expect(result.value.explorerResult?.filepath).toContain('.compodocrc.json');
    });

    it.each(['.compodocxrc.json', '.compodocxrc', '.compodocxrc.yaml'])('finds %s in cwd', file => {
        fs.writeFileSync(path.join(tmpDir, file), JSON.stringify({ theme: 'ocean' }));
        const result = loadConfigFile({ cwd: tmpDir });
        expect(result.ok).toBe(true);
        if (result.ok === false) {
            return;
        }
        expect(result.value.config).toMatchObject({ theme: 'ocean' });
        expect(result.value.explorerResult?.filepath).toBe(path.join(tmpDir, file));
    });

    it('finds the compodocx and the compodoc key in package.json', () => {
        const pkg = path.join(tmpDir, 'package.json');
        fs.writeFileSync(pkg, JSON.stringify({ name: 'x', compodocx: { theme: 'ocean' } }));
        const compodocx = loadConfigFile({ cwd: tmpDir });
        fs.writeFileSync(pkg, JSON.stringify({ name: 'x', compodoc: { theme: 'midnight' } }));
        const compodoc = loadConfigFile({ cwd: tmpDir });
        expect(compodocx.ok && compodocx.value.config).toMatchObject({ theme: 'ocean' });
        expect(compodoc.ok && compodoc.value.config).toMatchObject({ theme: 'midnight' });
    });

    it('prefers .compodocxrc.json over .compodocrc.json in the same folder', () => {
        fs.writeFileSync(path.join(tmpDir, '.compodocrc.json'), JSON.stringify({ theme: 'a' }));
        fs.writeFileSync(path.join(tmpDir, '.compodocxrc.json'), JSON.stringify({ theme: 'b' }));
        const result = loadConfigFile({ cwd: tmpDir });
        expect(result.ok).toBe(true);
        if (result.ok === false) {
            return;
        }
        expect(result.value.config).toMatchObject({ theme: 'b' });
        expect(result.value.explorerResult?.filepath).toContain('.compodocxrc.json');
    });

    it('honours explicitConfigPath over cwd search', () => {
        const explicit = path.join(tmpDir, 'explicit-config.json');
        fs.writeFileSync(explicit, JSON.stringify({ theme: 'midnight' }));
        const result = loadConfigFile({ explicitConfigPath: explicit, cwd: tmpDir });
        expect(result.ok).toBe(true);
        if (result.ok === false) {
            return;
        }
        expect(result.value.config).toMatchObject({ theme: 'midnight' });
    });

    it('returns err when the explicit config path cannot be parsed', () => {
        const broken = path.join(tmpDir, 'broken.json');
        fs.writeFileSync(broken, '{ this is not json');
        const result = loadConfigFile({ explicitConfigPath: broken, cwd: tmpDir });
        expect(result.ok).toBe(false);
        if (result.ok === true) {
            return;
        }
        expect(result.message).toContain('Failed to load configuration file');
    });
});

describe('applyConfigToMainData', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('drops the miscellaneous and tokens menu keys with a warning, keeps the new ones', () => {
        const mainData = makeMainData();
        const program = makeProgram();
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
        applyConfigToMainData(
            mainData,
            { toggleMenuItems: ['tokens', 'miscellaneous', 'dependency-injection', 'utilities'] },
            program,
            { cwd: '/tmp/test' }
        );
        expect(mainData.toggleMenuItems).toEqual(['dependency-injection', 'utilities']);
        expect(warn).toHaveBeenCalledWith('toggleMenuItems: "tokens" has no effect');
        expect(warn).toHaveBeenCalledWith('toggleMenuItems: "miscellaneous" has no effect');
        warn.mockRestore();
    });

    it('reads styleFiles relative to the config file folder', () => {
        const mainData = makeMainData();
        applyConfigToMainData(
            mainData,
            { styleFiles: ['projects/*/theming/**/*.css'] },
            makeProgram(),
            { cwd: '/tmp/test', configDir: '/tmp/test/conf' }
        );
        expect(mainData.styleFiles).toEqual(['projects/*/theming/**/*.css']);
        expect(mainData.styleFilesBase).toBe('/tmp/test/conf');
    });

    it('ignores styleFiles that is not a list of non-empty strings, with a warning', () => {
        for (const styleFiles of ['a/*.css', ['ok/*.css', ''], [1]] as unknown[]) {
            const mainData = makeMainData();
            mainData.styleFiles = [];
            const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
            applyConfigToMainData(mainData, { styleFiles } as never, makeProgram(), {
                cwd: '/tmp/test'
            });
            expect(mainData.styleFiles).toEqual([]);
            expect(warn).toHaveBeenCalledWith(
                'styleFiles: expected a list of non-empty glob strings; ignored'
            );
            warn.mockRestore();
        }
    });

    it('reads themingPrivatePrefix as a prefix or false', () => {
        for (const themingPrivatePrefix of ['--priv-', false] as const) {
            const mainData = makeMainData();
            const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
            applyConfigToMainData(mainData, { themingPrivatePrefix }, makeProgram(), {
                cwd: '/tmp/test'
            });
            expect(mainData.themingPrivatePrefix).toBe(themingPrivatePrefix);
            expect(warn).not.toHaveBeenCalled();
            warn.mockRestore();
        }
    });

    it('keeps the default themingPrivatePrefix for an invalid value, with a warning', () => {
        for (const themingPrivatePrefix of ['', '--', '_x', true, 3] as unknown[]) {
            const mainData = makeMainData();
            const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
            applyConfigToMainData(mainData, { themingPrivatePrefix } as never, makeProgram(), {
                cwd: '/tmp/test'
            });
            expect(mainData.themingPrivatePrefix).toBe('--_');
            expect(warn).toHaveBeenCalledWith(
                'themingPrivatePrefix: expected false or a prefix such as "--_" that starts with "--"; ignored, "--_" stays'
            );
            warn.mockRestore();
        }
    });

    it('config-file value applies when CLI does not override', () => {
        const mainData = makeMainData();
        const program = makeProgram();
        applyConfigToMainData(mainData, { theme: 'ocean' }, program, { cwd: '/tmp/test' });
        expect(mainData.theme).toBe('ocean');
    });

    it('CLI flag wins over config-file value', () => {
        const mainData = makeMainData();
        const program = makeProgram(['--theme', 'midnight']);
        applyConfigToMainData(mainData, { theme: 'ocean' }, program, { cwd: '/tmp/test' });
        expect(mainData.theme).toBe('midnight');
    });

    it('maxSearchResults: config value applies, the default flag does not override it', () => {
        const mainData = makeMainData();
        const program = makeProgram();
        applyConfigToMainData(mainData, { maxSearchResults: 0 }, program, { cwd: '/tmp/test' });
        expect(mainData.maxSearchResults).toBe(0);
    });

    it('maxSearchResults: an explicit flag wins and is a number', () => {
        const mainData = makeMainData();
        const program = makeProgram(['--maxSearchResults', '40']);
        applyConfigToMainData(mainData, { maxSearchResults: 7 }, program, { cwd: '/tmp/test' });
        expect(mainData.maxSearchResults).toBe(40);
    });

    it('config-file includesLabels sets mainData.includesLabels', () => {
        const mainData = makeMainData();
        applyConfigToMainData(mainData, { includesLabels: 'labels.json' }, makeProgram(), {
            cwd: '/tmp/test'
        });
        expect(mainData.includesLabels).toBe('labels.json');
    });

    it('--includesLabels from CLI wins over the config file', () => {
        const mainData = makeMainData();
        const program = makeProgram(['--includesLabels', 'cli.json']);
        applyConfigToMainData(mainData, { includesLabels: 'labels.json' }, program, {
            cwd: '/tmp/test'
        });
        expect(mainData.includesLabels).toBe('cli.json');
    });

    it('--port from CLI overrides config-file port', () => {
        const mainData = makeMainData();
        const program = makeProgram(['--port', '9000']);
        applyConfigToMainData(mainData, { port: 7777 }, program, { cwd: '/tmp/test' });
        expect(mainData.port).toBe('9000');
    });

    it('customLogoDark: config value applies, the CLI flag wins', () => {
        const fromConfig = makeMainData();
        applyConfigToMainData(
            fromConfig,
            { customLogo: 'brand/logo.svg', customLogoDark: 'brand/logo-dark.svg' },
            makeProgram(),
            { cwd: '/tmp/test' }
        );
        expect(fromConfig.customLogoDark).toBe('brand/logo-dark.svg');

        const fromCli = makeMainData();
        applyConfigToMainData(
            fromCli,
            { customLogo: 'brand/logo.svg', customLogoDark: 'brand/logo-dark.svg' },
            makeProgram(['--customLogoDark', 'cli/night.svg']),
            { cwd: '/tmp/test' }
        );
        expect(fromCli.customLogoDark).toBe('cli/night.svg');
    });

    it('customLogoDark: ignored without customLogo or with the same file name, with a warning', () => {
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
        const alone = makeMainData();
        applyConfigToMainData(alone, { customLogoDark: 'brand/logo-dark.svg' }, makeProgram(), {
            cwd: '/tmp/test'
        });
        expect(alone.customLogoDark).toBe('');
        expect(warn).toHaveBeenCalledWith('customLogoDark: needs customLogo; ignored');

        const clash = makeMainData();
        applyConfigToMainData(
            clash,
            { customLogo: 'light/logo.svg', customLogoDark: 'dark/logo.svg' },
            makeProgram(),
            { cwd: '/tmp/test' }
        );
        expect(clash.customLogoDark).toBe('');
        expect(warn).toHaveBeenCalledWith(
            'customLogoDark: "logo.svg" has the file name of customLogo; ignored'
        );
        warn.mockRestore();
    });

    it('logoLayout: config value applies, the CLI flag wins', () => {
        const fromConfig = makeMainData();
        applyConfigToMainData(fromConfig, { logoLayout: 'icon' }, makeProgram(), {
            cwd: '/tmp/test'
        });
        expect(fromConfig.logoLayout).toBe('icon');

        const fromCli = makeMainData();
        applyConfigToMainData(
            fromCli,
            { logoLayout: 'icon' },
            makeProgram(['--logoLayout', 'wordmark']),
            { cwd: '/tmp/test' }
        );
        expect(fromCli.logoLayout).toBe('wordmark');
    });

    it('logoLayout: an unknown value keeps auto, with a warning', () => {
        const mainData = makeMainData();
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
        applyConfigToMainData(mainData, { logoLayout: 'square' }, makeProgram(), {
            cwd: '/tmp/test'
        });
        expect(mainData.logoLayout).toBe('auto');
        expect(warn).toHaveBeenCalledWith(
            'logoLayout: expected one of auto, icon, wordmark, got "square"; ignored'
        );
        warn.mockRestore();
    });

    it('menuLayout: "feature" propagates from config', () => {
        const mainData = makeMainData();
        const program = makeProgram();
        applyConfigToMainData(mainData, { menuLayout: 'feature' }, program, { cwd: '/tmp/test' });
        expect(mainData.menuLayout).toBe('feature');
    });

    it('warns that featureLibraryScope is ignored', () => {
        const mainData = makeMainData();
        applyConfigToMainData(
            mainData,
            { featureLibraryScope: 'primary' } as never,
            makeProgram(),
            {
                cwd: '/tmp/test'
            }
        );
        expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
            'featureLibraryScope is ignored: each feature lists its primary members, or its whole surface when it has none'
        );
        expect(mainData).not.toHaveProperty('featureLibraryScope');
    });

    it('warns that groupBy and groupDepth are ignored', () => {
        const mainData = makeMainData();
        applyConfigToMainData(
            mainData,
            { groupBy: 'folder', groupDepth: 3 } as never,
            makeProgram(),
            { cwd: '/tmp/test' }
        );
        expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
            'groupBy is ignored: the sidebar groups symbols by feature'
        );
        expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
            'groupDepth is ignored: the sidebar groups symbols by feature'
        );
        expect(mainData).not.toHaveProperty('groupBy');
    });

    it('warns that disableRoutesGraph is ignored and reads disableRoutes', () => {
        const ignored = makeMainData();
        applyConfigToMainData(ignored, { disableRoutesGraph: true } as never, makeProgram(), {
            cwd: '/tmp/test'
        });
        expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
            'disableRoutesGraph is ignored: the routes graph is gone; use disableRoutes'
        );
        expect(ignored.disableRoutes).toBe(false);
        const disabled = makeMainData();
        applyConfigToMainData(disabled, { disableRoutes: true }, makeProgram(), {
            cwd: '/tmp/test'
        });
        expect(disabled.disableRoutes).toBe(true);
    });

    it('warns that disableMainGraph is ignored', () => {
        applyConfigToMainData(makeMainData(), { disableMainGraph: true } as never, makeProgram(), {
            cwd: '/tmp/test'
        });
        expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
            'disableMainGraph is ignored: there is no module graph any more'
        );
    });

    it('warns that the upstream gaSite and templatePlayground keys are ignored', () => {
        applyConfigToMainData(
            makeMainData(),
            { gaSite: 'example.com', templatePlayground: true } as never,
            makeProgram(),
            { cwd: '/tmp/test' }
        );
        expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
            'gaSite is ignored: Universal Analytics is end-of-life; use gaID with a GA4 measurement ID (G-XXXXXXXXXX)'
        );
        expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
            'templatePlayground is ignored: the Template Playground was removed'
        );
    });

    it('warns that the stackblitz, stackblitzTemplate and base keys are ignored', () => {
        applyConfigToMainData(
            makeMainData(),
            { stackblitz: true, stackblitzTemplate: 'abc', base: '/docs/' } as never,
            makeProgram(),
            { cwd: '/tmp/test' }
        );
        expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
            'stackblitz is ignored: it never had an effect; use @playground'
        );
        expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
            'stackblitzTemplate is ignored: it never had an effect; use @playground'
        );
        expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
            'base is ignored: it never had an effect'
        );
    });

    it.each([
        ['material', 'default'],
        ['original', 'default'],
        ['postmark', 'nord'],
        ['readthedocs', 'default'],
        ['stripe', 'ocean'],
        ['vagrant', 'midnight'],
        ['laravel', 'ember']
    ])('maps the upstream theme %s to %s with a warning', (upstream, builtIn) => {
        const mainData = makeMainData();
        applyConfigToMainData(mainData, { theme: upstream }, makeProgram(), { cwd: '/tmp/test' });
        expect(mainData.theme).toBe(builtIn);
        expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
            expect.stringContaining(`'${upstream}' theme has been removed; using '${builtIn}'.`)
        );
    });

    it('keeps built-in theme names without a warning', () => {
        const mainData = makeMainData();
        applyConfigToMainData(mainData, { theme: 'gitbook' }, makeProgram(), { cwd: '/tmp/test' });
        expect(mainData.theme).toBe('gitbook');
        expect(vi.mocked(logger.warn)).not.toHaveBeenCalled();
    });

    it.each([
        [80, 80],
        ['85', 85],
        [true, 70],
        [0, 0]
    ])('coverageTest %j in the config file sets the threshold %i', (value, threshold) => {
        const mainData = makeMainData();
        applyConfigToMainData(mainData, { coverageTest: value }, makeProgram(), {
            cwd: '/tmp/test'
        });
        expect(mainData.coverageTest).toBe(true);
        expect(mainData.coverageTestThreshold).toBe(threshold);
    });

    it('leaves the coverage test off without the key or with false', () => {
        for (const config of [{}, { coverageTest: false }]) {
            const mainData = makeMainData();
            applyConfigToMainData(mainData, config, makeProgram(), { cwd: '/tmp/test' });
            expect(mainData.coverageTest).toBe(false);
            expect(mainData.coverageTestThreshold).toBe(70);
        }
    });

    it('coverageMinimumPerFile accepts numbers and numeric strings', () => {
        const numeric = makeMainData();
        applyConfigToMainData(numeric, { coverageMinimumPerFile: 40 }, makeProgram(), {
            cwd: '/tmp/test'
        });
        expect(numeric.coverageTestPerFile).toBe(true);
        expect(numeric.coverageMinimumPerFile).toBe(40);
        const text = makeMainData();
        applyConfigToMainData(text, { coverageMinimumPerFile: '25' }, makeProgram(), {
            cwd: '/tmp/test'
        });
        expect(text.coverageMinimumPerFile).toBe(25);
    });

    it('the CLI coverage threshold wins over the config file', () => {
        const mainData = makeMainData();
        applyConfigToMainData(
            mainData,
            { coverageTest: 80 },
            makeProgram(['--coverageTest', '90']),
            { cwd: '/tmp/test' }
        );
        expect(mainData.coverageTestThreshold).toBe(90);
    });

    it.each([
        [false, false],
        ['false', false],
        [true, true],
        ['true', true]
    ])('coverageTestThresholdFail %j in the config file applies', (value, expected) => {
        const mainData = makeMainData();
        applyConfigToMainData(mainData, { coverageTestThresholdFail: value }, makeProgram(), {
            cwd: '/tmp/test'
        });
        expect(mainData.coverageTestThresholdFail).toBe(expected);
    });

    it('an explicit coverageTestThresholdFail on the CLI beats the config file', () => {
        const off = makeMainData();
        applyConfigToMainData(
            off,
            { coverageTestThresholdFail: true },
            makeProgram(['--coverageTestThresholdFail', 'false']),
            { cwd: '/tmp/test' }
        );
        expect(off.coverageTestThresholdFail).toBe(false);
        const on = makeMainData();
        applyConfigToMainData(
            on,
            { coverageTestThresholdFail: false },
            makeProgram(['--coverageTestThresholdFail']),
            { cwd: '/tmp/test' }
        );
        expect(on.coverageTestThresholdFail).toBe(true);
    });

    it('keeps valid feature globs and warns about invalid keys', () => {
        const mainData = makeMainData();
        applyConfigToMainData(
            mainData,
            {
                features: {
                    'projects/forms/select/**': 'select',
                    'projects/forms/chips/**': 'Chips Group',
                    'projects/forms/list/**': 'list/item'
                }
            },
            makeProgram(),
            { cwd: '/tmp/test' }
        );
        expect(mainData.features).toEqual({ 'projects/forms/select/**': 'select' });
        expect(vi.mocked(logger.warn)).toHaveBeenCalledTimes(2);
        expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
            expect.stringContaining('"projects/forms/chips/**": "Chips Group"')
        );
    });

    it('takes feature container and utility folder lists, ignoring non-lists with a warning', () => {
        const mainData = makeMainData();
        applyConfigToMainData(
            mainData,
            {
                featureContainers: ['modules'],
                featureUtilityFolders: 'helpers' as unknown as string[],
                featureRoleFolders: ['di']
            },
            makeProgram(),
            { cwd: '/tmp/test' }
        );
        expect(mainData.featureContainers).toEqual(['modules']);
        expect(mainData.featureRoleFolders).toEqual(['di']);
        expect(mainData.featureUtilityFolders).toEqual([
            'internal',
            'i18n',
            'utils',
            'testing',
            '__test-helpers',
            'examples'
        ]);
        expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
            'featureUtilityFolders: expected a list of folder names; ignored'
        );
    });

    it('reads classificationAxes, dropping invalid parts with a warning each', () => {
        const mainData = makeMainData();
        applyConfigToMainData(
            mainData,
            {
                classificationAxes: {
                    stability: {
                        values: ['stable', 'experimental'],
                        paths: { 'src/labs/**': 'experimental', 'src/old/**': 'legacy' },
                        default: 'stable',
                        kinds: ['component', 'style']
                    },
                    'Bad Name': { values: ['x'] }
                }
            },
            makeProgram(),
            { cwd: '/tmp/test' }
        );
        expect(mainData.classificationAxes).toEqual({
            stability: {
                label: 'stability',
                values: ['stable', 'experimental'],
                paths: { 'src/labs/**': 'experimental' },
                default: 'stable',
                kinds: ['component']
            }
        });
        expect(vi.mocked(logger.warn)).toHaveBeenCalledTimes(3);
        expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
            'classificationAxes: "stability.kinds" ignores "style" (not a symbol kind)'
        );
    });

    describe('menuFeatureSections', () => {
        const apply = (menuFeatureSections: unknown) => {
            const mainData = makeMainData();
            mainData.menuFeatureSections = DEFAULT_MENU_FEATURE_SECTIONS;
            applyConfigToMainData(mainData, { menuFeatureSections } as never, makeProgram(), {
                cwd: '/tmp/test'
            });
            return mainData.menuFeatureSections;
        };

        it('keeps the defaults without the key', () => {
            const mainData = makeMainData();
            mainData.menuFeatureSections = DEFAULT_MENU_FEATURE_SECTIONS;
            applyConfigToMainData(mainData, {}, makeProgram(), { cwd: '/tmp/test' });
            expect(mainData.menuFeatureSections).toEqual({
                configuration: 'own',
                utilities: 'more',
                constants: 'more',
                types: 'more'
            });
            expect(vi.mocked(logger.warn)).not.toHaveBeenCalled();
        });

        it('reads valid placements and keeps the default for missing roles', () => {
            expect(apply({ types: 'hidden', configuration: 'top' })).toEqual({
                configuration: 'top',
                utilities: 'more',
                constants: 'more',
                types: 'hidden'
            });
            expect(vi.mocked(logger.warn)).not.toHaveBeenCalled();
        });

        it('drops an unknown role and an unknown value with one warning each', () => {
            expect(apply({ types: 'nope', foo: 'more', constants: 'own' })).toEqual({
                configuration: 'own',
                utilities: 'more',
                constants: 'own',
                types: 'more'
            });
            expect(vi.mocked(logger.warn)).toHaveBeenCalledTimes(2);
            expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
                'menuFeatureSections.types: unknown value "nope" ignored (expected own, more, top, hidden)'
            );
            expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
                'menuFeatureSections: unknown role "foo" ignored (expected configuration, utilities, constants, types)'
            );
        });

        it('ignores a value that is not an object', () => {
            expect(apply('hidden')).toEqual(DEFAULT_MENU_FEATURE_SECTIONS);
            expect(vi.mocked(logger.warn)).toHaveBeenCalledTimes(1);
        });
    });

    it('collapsedAll: true propagates from config', () => {
        const mainData = makeMainData();
        const program = makeProgram();
        applyConfigToMainData(mainData, { collapsedAll: true }, program, { cwd: '/tmp/test' });
        expect(mainData.collapsedAll).toBe(true);
    });

    it('playgroundDependencies propagates from config when object', () => {
        const mainData = makeMainData();
        const program = makeProgram();
        const deps = { 'my-lib': '^1.0.0' };
        applyConfigToMainData(mainData, { playgroundDependencies: deps }, program, {
            cwd: '/tmp/test'
        });
        expect(mainData.playgroundDependencies).toEqual(deps);
    });

    it('invalid menuLayout exits with code 2', () => {
        const mainData = makeMainData();
        const program = makeProgram();
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
            throw new Error(`process.exit(${code})`);
        }) as never);
        expect(() =>
            applyConfigToMainData(
                mainData,
                { menuLayout: 'invalid' as unknown as 'feature' },
                program,
                { cwd: '/tmp/test' }
            )
        ).toThrow(/process\.exit\(2\)/);
        expect(exitSpy).toHaveBeenCalledWith(2);
        exitSpy.mockRestore();
    });

    it('invalid collapsedAll exits with code 2', () => {
        const mainData = makeMainData();
        const program = makeProgram();
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
            throw new Error(`process.exit(${code})`);
        }) as never);
        expect(() =>
            applyConfigToMainData(
                mainData,
                { collapsedAll: 'yes' as unknown as boolean },
                program,
                { cwd: '/tmp/test' }
            )
        ).toThrow(/process\.exit\(2\)/);
        expect(exitSpy).toHaveBeenCalledWith(2);
        exitSpy.mockRestore();
    });

    it('--no-multiVersion flips mainData.multiVersion to false', () => {
        const mainData = makeMainData();
        const program = makeProgram(['--no-multiVersion']);
        applyConfigToMainData(mainData, {}, program, { cwd: '/tmp/test' });
        expect(mainData.multiVersion).toBe(false);
    });

    it('--minimal sets four disable flags', () => {
        const mainData = makeMainData();
        const program = makeProgram();
        applyConfigToMainData(mainData, { minimal: true }, program, { cwd: '/tmp/test' });
        expect(mainData.disableSearch).toBe(true);
        expect(mainData.disableRoutes).toBe(true);
        expect(mainData.disableGraph).toBe(true);
        expect(mainData.disableCoverage).toBe(true);
    });

    it('exportFormat=llm-md without -d routes logger to stderr', () => {
        const mainData = makeMainData();
        // Simulate mainData state where exportFormat is llm-md and -d was not set
        const program = makeProgram();
        applyConfigToMainData(mainData, { exportFormat: 'llm-md' }, program, { cwd: '/tmp/test' });
        expect(mainData.exportFormat).toBe('llm-md');
        expect(logger.routeToStderr).toBe(true);
    });

    it('warns when --language is unsupported', async () => {
        const mainData = makeMainData();
        const I18nEngine = (await import('../../../../src/app/engines/i18n.engine')).default;
        vi.mocked(I18nEngine.supportLanguage).mockReturnValueOnce(false);
        const program = makeProgram(['--language', 'xx-XX']);
        applyConfigToMainData(mainData, {}, program, { cwd: '/tmp/test' });
        expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
            expect.stringContaining('The language xx-XX is not available')
        );
    });

    it('tsconfig boolean (`-p` with no value) exits with code 1', () => {
        const mainData = makeMainData();
        // simulate user typing `-p` with no value: commander sets tsconfig=true (boolean)
        const program = makeProgram();
        program.setOptionValue('tsconfig', true);
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
            throw new Error(`process.exit(${code})`);
        }) as never);
        expect(() => applyConfigToMainData(mainData, {}, program, { cwd: '/tmp/test' })).toThrow(
            /process\.exit\(1\)/
        );
        expect(exitSpy).toHaveBeenCalledWith(1);
        exitSpy.mockRestore();
    });
});
