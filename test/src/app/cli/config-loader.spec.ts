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
        disableRoutesGraph: false,
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
        gaID: '',
        publicApiOnly: '',
        maxSearchResults: 15,
        stackblitz: false,
        stackblitzTemplate: '',
        menuLayout: 'type',
        features: {},
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
        .option('--port [port]', '', '8080')
        .option('--exportFormat [format]', '', 'html')
        .option('--jsonIndent <spaces>', '', '0')
        .option('--multiVersion', '', true)
        .option('--no-multiVersion')
        .option('--versionLabel [label]')
        .option('--versionsRoot [path]')
        .option('--maxVersionsShown <n>', '', '10')
        .option('--gaID [id]')
        .option('--coverageTest [threshold]')
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
        if (!result.ok) {
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
        if (!result.ok) {
            return;
        }
        expect(result.value.config).toMatchObject({ theme: 'ocean', port: 9000 });
        expect(result.value.explorerResult?.filepath).toContain('.compodocrc.json');
    });

    it('honours explicitConfigPath over cwd search', () => {
        const explicit = path.join(tmpDir, 'explicit-config.json');
        fs.writeFileSync(explicit, JSON.stringify({ theme: 'midnight' }));
        const result = loadConfigFile({ explicitConfigPath: explicit, cwd: tmpDir });
        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }
        expect(result.value.config).toMatchObject({ theme: 'midnight' });
    });

    it('returns err when the explicit config path cannot be parsed', () => {
        const broken = path.join(tmpDir, 'broken.json');
        fs.writeFileSync(broken, '{ this is not json');
        const result = loadConfigFile({ explicitConfigPath: broken, cwd: tmpDir });
        expect(result.ok).toBe(false);
        if (result.ok) {
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

    it('--port from CLI overrides config-file port', () => {
        const mainData = makeMainData();
        const program = makeProgram(['--port', '9000']);
        applyConfigToMainData(mainData, { port: 7777 }, program, { cwd: '/tmp/test' });
        expect(mainData.port).toBe('9000');
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
                featureUtilityFolders: 'helpers' as unknown as string[]
            },
            makeProgram(),
            { cwd: '/tmp/test' }
        );
        expect(mainData.featureContainers).toEqual(['modules']);
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
        expect(mainData.disableRoutesGraph).toBe(true);
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
