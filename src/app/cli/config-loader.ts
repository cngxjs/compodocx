import * as path from 'node:path';
import type { Command } from 'commander';
import { type CosmiconfigResult, cosmiconfigSync } from 'cosmiconfig';
import * as fs from 'fs-extra';

import { err, isErr, ok, type Result } from '../../lib';
import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { parseJsonIndent } from '../../utils/json-indent.util';
import { logger } from '../../utils/logger';
import { parseDisableMarkdownPages } from '../../utils/markdown-pages';
import { parseMaxSearchResults } from '../../utils/max-search-results.util';
import { parseMaxVersionsShown } from '../../utils/max-versions-shown.util';
import { parseMenuFeatureSections } from '../../utils/menu-feature-sections';
import { parseSearchFacetLimit } from '../../utils/search-facet-limit.util';
import { parseAxesConfig } from '../compiler/semantic/axes';
import { isFeatureKey } from '../compiler/semantic/features';
import I18nEngine from '../engines/i18n.engine';
import { STACKBLITZ_POST_LIMIT } from '../engines/stackblitz/constants';
import type { ConfigurationFileInterface } from '../interfaces/configuration-file.interface';
import type { MainDataInterface } from '../interfaces/main-data.interface';
import { isTableKind } from '../links/symbol-id';
import { isLogoLayoutSetting, LOGO_LAYOUTS, logoImage } from '../page-generator/brand-images';

/** Config names in search order: `.compodocxrc*` / `compodocx` key first, then the `compodoc` ones. */
const COSMICONFIG_MODULE_NAMES: readonly string[] = ['compodocx', 'compodoc'];

/** Menu keys of chapters that no longer exist; they warn and are dropped. */
const REMOVED_MENU_ITEMS: readonly string[] = ['modules', 'miscellaneous', 'tokens'];

/** Config keys that no longer have an effect, with the reason; each one present warns once. */
const IGNORED_CONFIG_KEYS: Readonly<Record<string, string>> = {
    groupBy: 'the sidebar groups symbols by feature',
    groupDepth: 'the sidebar groups symbols by feature',
    featureLibraryScope:
        'each feature lists its primary members, or its whole surface when it has none',
    disableRoutesGraph: 'the routes graph is gone; use disableRoutes',
    disableMainGraph: 'there is no module graph any more',
    gaSite: 'Universal Analytics is end-of-life; use gaID with a GA4 measurement ID (G-XXXXXXXXXX)',
    templatePlayground: 'the Template Playground was removed',
    stackblitz: 'it never had an effect; use @playground',
    stackblitzTemplate: 'it never had an effect; use @playground',
    base: 'it never had an effect'
};

/** Upstream compodoc theme names, mapped to the built-in theme used in their place. */
const UPSTREAM_THEMES: Readonly<Record<string, string>> = {
    material: 'default',
    original: 'default',
    postmark: 'nord',
    readthedocs: 'default',
    stripe: 'ocean',
    vagrant: 'midnight',
    laravel: 'ember'
};

/** A coverage key turns its test on unless it is missing, `false` or `null`. */
const isCoverageOn = (value: unknown): boolean =>
    value !== undefined && value !== null && value !== false;

/** A number or numeric string is the threshold; `true` or anything else keeps the default. */
const coverageValue = (value: unknown, fallback: number): number => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;
    return Number.isNaN(parsed) ? fallback : parsed;
};

/** `false` and `'false'` turn failing off; any other value keeps it on. */
const isFailOn = (value: unknown): boolean => value !== false && value !== 'false';

export interface LoadConfigOptions {
    readonly explicitConfigPath?: string;
    readonly cwd: string;
}

export interface LoadedConfig {
    /** Parsed config object (empty when no file was discovered). */
    readonly config: Partial<ConfigurationFileInterface>;
    /** Raw cosmiconfig result (carries `filepath` for "Using configuration file" logging). `null` when search returned nothing. */
    readonly explorerResult: CosmiconfigResult | null;
}

export type ConfigFileResult = Result<LoadedConfig, string>;

export interface ApplySources {
    readonly cwd: string;
    /** Folder of the config file, when one was loaded. */
    readonly configDir?: string;
}

/**
 * Cosmiconfig boundary. Honours an explicit `-c` path, otherwise searches
 * `opts.cwd` for `.compodocxrc*` / `compodocx.config.*` / a `compodocx` key in
 * `package.json`, then for the same `compodoc` names. Returns
 * `ok({ config: {}, explorerResult: null })` when nothing is found so callers
 * can downgrade to a warning.
 */
export function loadConfigFile(opts: LoadConfigOptions): ConfigFileResult {
    const explorers = COSMICONFIG_MODULE_NAMES.map(name => cosmiconfigSync(name));

    let explorerResult: CosmiconfigResult | undefined;
    try {
        if (opts.explicitConfigPath) {
            let configFilePath = opts.explicitConfigPath;
            const match = configFilePath.match(opts.cwd);
            if (match && match.length > 0) {
                configFilePath = configFilePath.replace(opts.cwd + path.sep, '');
            }
            // Resolve against opts.cwd (not process.cwd()) so callers can
            // pass a non-default cwd in tests without the path collapsing
            // to the test runner's working directory.
            explorerResult = explorers[0].load(path.resolve(opts.cwd, configFilePath)) ?? undefined;
        } else {
            explorerResult = explorers.reduce<CosmiconfigResult | undefined>(
                (found, next) => found ?? next.search(opts.cwd) ?? undefined,
                undefined
            );
        }
    } catch (e) {
        return err(`Failed to load configuration file: ${(e as Error).message}`);
    }

    if (!explorerResult) {
        return ok({ config: {}, explorerResult: null });
    }

    const config: Partial<ConfigurationFileInterface> =
        typeof explorerResult.config !== 'undefined' ? explorerResult.config : {};

    return ok({ config, explorerResult });
}

const isStringList = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every(item => typeof item === 'string');

/**
 * `styleFiles` from the config file: a list of non-empty glob strings,
 * relative to the config file's folder. Anything else warns and is ignored.
 */
function applyStyleFilesConfig(
    configFile: Partial<ConfigurationFileInterface>,
    mainData: MainDataInterface,
    sources: ApplySources
): void {
    const { styleFiles } = configFile;
    if (styleFiles === undefined) {
        return;
    }
    if (!isStringList(styleFiles) || styleFiles.some(glob => glob.trim() === '')) {
        logger.warn('styleFiles: expected a list of non-empty glob strings; ignored');
        return;
    }
    mainData.styleFiles = styleFiles;
    mainData.styleFilesBase = sources.configDir ?? '';
}

/**
 * `themingPrivatePrefix` from the config file: `false`, or a string that starts
 * with `--` and names at least one more character. Anything else warns and the
 * default stays.
 */
function applyThemingPrivatePrefix(
    configFile: Partial<ConfigurationFileInterface>,
    mainData: MainDataInterface
): void {
    const prefix: unknown = configFile.themingPrivatePrefix;
    if (prefix === undefined) {
        return;
    }
    if (prefix === false || (typeof prefix === 'string' && /^--./.test(prefix))) {
        mainData.themingPrivatePrefix = prefix;
        return;
    }
    logger.warn(
        `themingPrivatePrefix: expected false or a prefix such as "--_" that starts with "--"; ignored, "${mainData.themingPrivatePrefix}" stays`
    );
}

/**
 * `features`, `featureContainers`, `featureUtilityFolders` and `featureRoleFolders` from the config
 * file. Invalid entries warn once each and are ignored; the run goes on.
 */
function applyFeatureConfig(
    configFile: Partial<ConfigurationFileInterface>,
    mainData: MainDataInterface
): void {
    const { features, featureContainers, featureUtilityFolders, featureRoleFolders } = configFile;
    if (features !== undefined) {
        if (features === null || typeof features !== 'object' || Array.isArray(features)) {
            logger.warn('features: expected an object of file glob -> feature key; ignored');
        } else {
            const valid: Record<string, string> = {};
            for (const [glob, key] of Object.entries(features)) {
                if (typeof key === 'string' && isFeatureKey(key)) {
                    valid[glob] = key;
                } else {
                    logger.warn(
                        `features: ignoring "${glob}": "${String(key)}" (expected one segment [a-z0-9][a-z0-9-]*)`
                    );
                }
            }
            mainData.features = valid;
        }
    }
    if (featureContainers !== undefined) {
        if (isStringList(featureContainers)) {
            mainData.featureContainers = featureContainers;
        } else {
            logger.warn('featureContainers: expected a list of folder names; ignored');
        }
    }
    if (featureUtilityFolders !== undefined) {
        if (isStringList(featureUtilityFolders)) {
            mainData.featureUtilityFolders = featureUtilityFolders;
        } else {
            logger.warn('featureUtilityFolders: expected a list of folder names; ignored');
        }
    }
    if (featureRoleFolders !== undefined) {
        if (isStringList(featureRoleFolders)) {
            mainData.featureRoleFolders = featureRoleFolders;
        } else {
            logger.warn('featureRoleFolders: expected a list of folder names; ignored');
        }
    }
}

/**
 * `classificationAxes` from the config file. Invalid parts warn once each and
 * are dropped; the run goes on.
 */
function applyAxesConfig(
    configFile: Partial<ConfigurationFileInterface>,
    mainData: MainDataInterface
): void {
    if (configFile.classificationAxes === undefined) {
        return;
    }
    const parsed = parseAxesConfig(
        configFile.classificationAxes,
        kind => kind !== 'style' && isTableKind(kind)
    );
    for (const warning of parsed.warnings) {
        logger.warn(warning);
    }
    mainData.classificationAxes = parsed.axes;
}

/**
 * `menuFeatureSections` from the config file over the defaults. An unknown
 * role or value warns once and is dropped; the run goes on.
 */
function applyMenuFeatureSections(
    configFile: Partial<ConfigurationFileInterface>,
    mainData: MainDataInterface
): void {
    if (configFile.menuFeatureSections === undefined) {
        return;
    }
    const parsed = parseMenuFeatureSections(configFile.menuFeatureSections);
    for (const warning of parsed.warnings) {
        logger.warn(warning);
    }
    mainData.menuFeatureSections = parsed.sections;
}

/**
 * Merge config-file values and CLI flags onto `Configuration.mainData`.
 *
 * The body is a verbatim relocation of the legacy `start()` if-cascade.
 * Precedence rule: every setting first picks up the config-file value
 * (when present and truthy), then the CLI flag wins when commander
 * reports the source as `'cli'` or the value differs from the default.
 *
 * Side-effects allowed:
 *  - `process.exit(1)` for invalid `--jsonIndent` / `--maxVersionsShown` /
 *    `--maxSearchResults` / `--searchFacetLimit` /
 *    missing custom-theme file / `--tsconfig` boolean.
 *  - `process.exit(2)` for invalid `menuLayout` / `collapsedAll` / `featuresName` / `aiGeneratedNote` / `exampleUrlBase` /
 *    `referencesName` config.
 *  - Mutates `logger.silent` and `logger.routeToStderr`.
 *  - Mutates `I18nEngine` via the language-availability warning.
 *
 * Wrapping these in `Result` is a Sprint 7+ concern; today's job is
 * byte-equality with develop.
 */
export function applyConfigToMainData(
    mainData: MainDataInterface,
    configFile: Partial<ConfigurationFileInterface>,
    program: Command,
    sources: ApplySources
): void {
    const programOptions = program.opts();

    if (configFile.output) {
        mainData.output = configFile.output;
        mainData.outputProvided = true;
    }
    if (programOptions.output && programOptions.output !== COMPODOC_DEFAULTS.folder) {
        mainData.output = programOptions.output;
        mainData.outputProvided = true;
    }
    // Detect explicit -d on the CLI even if the user passed the default
    // value verbatim. The previous block compares the resolved value to
    // the default and would miss `-d ./documentation/`. Commander's
    // option-source API distinguishes "default" from "cli" cleanly.
    if (program.getOptionValueSource('output') === 'cli') {
        mainData.outputProvided = true;
    }

    if (configFile.extTheme) {
        mainData.extTheme = configFile.extTheme;
    }
    if (programOptions.extTheme) {
        mainData.extTheme = programOptions.extTheme;
    }

    if (configFile.language) {
        mainData.language = configFile.language;
    }
    if (programOptions.language) {
        mainData.language = programOptions.language;
    }

    if (configFile.theme) {
        mainData.theme = configFile.theme;
    }
    if (programOptions.theme) {
        mainData.theme = programOptions.theme;
    }

    // Upstream compodoc theme names fall back to the closest built-in theme
    if (mainData.theme && Object.hasOwn(UPSTREAM_THEMES, mainData.theme)) {
        const replacement = UPSTREAM_THEMES[mainData.theme];
        logger.warn(
            `'${mainData.theme}' theme has been removed; using '${replacement}'. Use 'default', 'gitbook', 'ocean', 'ember', 'midnight', 'neon', 'brutalist', 'nord', or 'rose-pine' instead.`
        );
        mainData.theme = replacement;
    }

    // --extTheme is a deprecated alias - treat as custom theme path
    if (mainData.extTheme && !mainData.theme) {
        mainData.theme = mainData.extTheme;
    }

    // Detect custom theme file path (contains '/' or ends with '.css')
    const themeVal = mainData.theme;
    if (
        themeVal &&
        (themeVal.includes('/') || themeVal.includes(path.sep) || themeVal.endsWith('.css'))
    ) {
        const resolved = path.resolve(sources.cwd, themeVal);
        if (fs.existsSync(resolved)) {
            mainData.customThemePath = resolved;
            mainData.theme = 'custom';
            logger.info(`Custom theme: ${resolved}`);
        } else {
            logger.error(`Custom theme file not found: ${resolved}`);
            process.exit(1);
        }
    }

    if (configFile.shikiTheme) {
        mainData.shikiTheme = configFile.shikiTheme;
    }
    if (programOptions.shikiTheme) {
        mainData.shikiTheme = programOptions.shikiTheme;
    }

    if (configFile.name) {
        mainData.documentationMainName = configFile.name;
    }
    if (programOptions.name && programOptions.name !== COMPODOC_DEFAULTS.title) {
        mainData.documentationMainName = programOptions.name;
    }

    if (configFile.assetsFolder) {
        mainData.assetsFolder = configFile.assetsFolder;
    }
    if (programOptions.assetsFolder) {
        mainData.assetsFolder = programOptions.assetsFolder;
    }

    if (configFile.open) {
        mainData.open = configFile.open;
    }
    if (programOptions.open) {
        mainData.open = programOptions.open;
    }

    if (configFile.toggleMenuItems) {
        mainData.toggleMenuItems = configFile.toggleMenuItems;
    }
    if (
        programOptions.toggleMenuItems &&
        programOptions.toggleMenuItems !== COMPODOC_DEFAULTS.toggleMenuItems
    ) {
        mainData.toggleMenuItems = programOptions.toggleMenuItems;
    }
    for (const removed of REMOVED_MENU_ITEMS) {
        if (mainData.toggleMenuItems.includes(removed)) {
            logger.warn(`toggleMenuItems: "${removed}" has no effect`);
            mainData.toggleMenuItems = mainData.toggleMenuItems.filter(item => item !== removed);
        }
    }

    if (configFile.templates) {
        mainData.templates = configFile.templates;
    }
    if (programOptions.templates) {
        mainData.templates = programOptions.templates;
    }

    if (configFile.navTabConfig) {
        mainData.navTabConfig = configFile.navTabConfig;
    }
    if (
        programOptions.navTabConfig &&
        JSON.parse(programOptions.navTabConfig).length !== COMPODOC_DEFAULTS.navTabConfig.length
    ) {
        mainData.navTabConfig = JSON.parse(programOptions.navTabConfig);
    }

    if (configFile.infoTabSections) {
        mainData.infoTabSections = configFile.infoTabSections;
    }

    if (configFile.apiTabSections) {
        mainData.apiTabSections = configFile.apiTabSections;
    }

    if (configFile.themingTabSections) {
        mainData.themingTabSections = configFile.themingTabSections;
    }
    applyThemingPrivatePrefix(configFile, mainData);

    if (
        configFile.playgroundDependencies &&
        typeof configFile.playgroundDependencies === 'object'
    ) {
        mainData.playgroundDependencies = configFile.playgroundDependencies;
    }

    if (typeof configFile.playgroundMaterialShell === 'boolean') {
        mainData.playgroundMaterialShell = configFile.playgroundMaterialShell;
    }

    const setPlaygroundCap = (
        value: unknown,
        min: number,
        max: number,
        assign: (n: number) => void
    ): void => {
        if (typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max) {
            assign(value);
        }
    };
    setPlaygroundCap(configFile.playgroundDepDepth, 1, 100, n => {
        mainData.playgroundDepDepth = n;
    });
    setPlaygroundCap(configFile.playgroundFileCountCap, 1, 1000, n => {
        mainData.playgroundFileCountCap = n;
    });
    setPlaygroundCap(configFile.playgroundFileCap, 500, 1_000_000, n => {
        mainData.playgroundFileCap = n;
    });

    if (
        Array.isArray(configFile.playgroundHead) &&
        configFile.playgroundHead.every(line => typeof line === 'string')
    ) {
        mainData.playgroundHead = configFile.playgroundHead;
    }

    if (typeof configFile.playgroundGlobalStyles === 'string') {
        mainData.playgroundGlobalStyles = configFile.playgroundGlobalStyles;
    }

    if (
        Array.isArray(configFile.playgroundVendor) &&
        configFile.playgroundVendor.every(p => typeof p === 'string')
    ) {
        mainData.playgroundVendor = configFile.playgroundVendor;
    }

    if (
        typeof configFile.playgroundVendorRoot === 'string' &&
        configFile.playgroundVendorRoot.length > 0
    ) {
        mainData.playgroundVendorRoot = configFile.playgroundVendorRoot;
    }

    // Backstop closure cap. Floor keeps a meaningful payload; ceiling is the
    // observed StackBlitz POST limit - raising past it re-opens the 413.
    setPlaygroundCap(configFile.playgroundVendorCap, 50_000, STACKBLITZ_POST_LIMIT, n => {
        mainData.playgroundVendorCap = n;
    });

    if (typeof configFile.playgroundVendorIncludeSourcemaps === 'boolean') {
        mainData.playgroundVendorIncludeSourcemaps = configFile.playgroundVendorIncludeSourcemaps;
    }

    if (configFile.includes) {
        mainData.includes = configFile.includes;
    }
    if (programOptions.includes) {
        mainData.includes = programOptions.includes;
    }

    if (configFile.includesName) {
        mainData.includesName = configFile.includesName;
    }
    if (
        programOptions.includesName &&
        programOptions.includesName !== COMPODOC_DEFAULTS.additionalEntryName
    ) {
        mainData.includesName = programOptions.includesName;
    }

    if (configFile.includesLabels) {
        mainData.includesLabels = configFile.includesLabels;
    }
    if (programOptions.includesLabels) {
        mainData.includesLabels = programOptions.includesLabels;
    }

    if (configFile.silent) {
        logger.silent = false;
    }
    if (programOptions.silent) {
        logger.silent = false;
    }

    if (configFile.serve) {
        mainData.serve = configFile.serve;
    }
    if (programOptions.serve) {
        mainData.serve = programOptions.serve;
    }

    if (configFile.host) {
        mainData.host = configFile.host;
        mainData.hostname = configFile.host;
    }
    if (programOptions.host) {
        mainData.host = programOptions.host;
        mainData.hostname = programOptions.host;
    }

    if (configFile.port) {
        mainData.port = configFile.port;
    }
    if (programOptions.port && programOptions.port !== COMPODOC_DEFAULTS.port) {
        mainData.port = programOptions.port;
    }

    if (configFile.watch) {
        mainData.watch = configFile.watch;
    }
    if (programOptions.watch) {
        mainData.watch = programOptions.watch;
    }

    if (configFile.exportFormat) {
        mainData.exportFormat = configFile.exportFormat;
    }
    if (
        programOptions.exportFormat &&
        programOptions.exportFormat !== COMPODOC_DEFAULTS.exportFormat
    ) {
        mainData.exportFormat = programOptions.exportFormat;
    }

    // When llm-md streams to stdout, every progress log line must go to
    // stderr so the markdown payload stays clean for `> file.md`,
    // `| pbcopy`, `| less` and similar redirections. The banner is
    // skipped entirely in that mode (downstream tools never want it).
    const isLlmMdStdoutMode = mainData.exportFormat === 'llm-md' && !mainData.outputProvided;
    if (isLlmMdStdoutMode) {
        logger.routeToStderr = true;
    }

    if (configFile.jsonIndent !== undefined) {
        const result = parseJsonIndent(configFile.jsonIndent, 'config');
        if (isErr(result)) {
            logger.error(result.message);
            process.exit(1);
        }
        mainData.jsonIndent = result.value;
    }
    // Commander always assigns a default value; only override when the
    // user actually passed `--jsonIndent` on the command line. Using
    // getOptionValueSource avoids the trap where a config-file value of
    // `4` would be silently re-overwritten by the CLI default `0` (or
    // worse, where an explicit `--jsonIndent 0` from the CLI fails to
    // override a config-file `4` because both stringify to the default).
    if (program.getOptionValueSource('jsonIndent') === 'cli') {
        const result = parseJsonIndent(programOptions.jsonIndent, 'flag');
        if (isErr(result)) {
            logger.error(result.message);
            process.exit(1);
        }
        mainData.jsonIndent = result.value;
    }

    // Multi-version flags. Order matters: pick up config-file values
    // first, then let CLI flags override only when they were actually
    // passed (F22 - distinguishing default from user-provided).
    if (typeof configFile.multiVersion === 'boolean') {
        mainData.multiVersion = configFile.multiVersion;
    }
    // Commander's --no-X sets opts.X to false even when the user didn't
    // pass the flag (it's the option default), so the source check is
    // the only safe way to distinguish "user opted out" from "default".
    if (program.getOptionValueSource('multiVersion') === 'cli') {
        mainData.multiVersion = programOptions.multiVersion === true;
    }

    if (typeof configFile.versionLabel === 'string') {
        mainData.versionLabel = configFile.versionLabel;
    }
    if (program.getOptionValueSource('versionLabel') === 'cli') {
        mainData.versionLabel = String(programOptions.versionLabel ?? '');
    }

    if (typeof configFile.versionsRoot === 'string') {
        mainData.versionsRoot = configFile.versionsRoot;
    }
    if (program.getOptionValueSource('versionsRoot') === 'cli') {
        mainData.versionsRoot = String(programOptions.versionsRoot ?? '');
    }

    if (configFile.maxVersionsShown !== undefined) {
        const result = parseMaxVersionsShown(configFile.maxVersionsShown, 'config');
        if (isErr(result)) {
            logger.error(result.message);
            process.exit(1);
        }
        mainData.maxVersionsShown = result.value;
    }
    if (program.getOptionValueSource('maxVersionsShown') === 'cli') {
        const result = parseMaxVersionsShown(programOptions.maxVersionsShown, 'flag');
        if (isErr(result)) {
            logger.error(result.message);
            process.exit(1);
        }
        mainData.maxVersionsShown = result.value;
    }

    if (configFile.hideGenerator) {
        mainData.hideGenerator = configFile.hideGenerator;
    }
    if (programOptions.hideGenerator) {
        mainData.hideGenerator = programOptions.hideGenerator;
    }

    if (configFile.hideDarkModeToggle) {
        mainData.hideDarkModeToggle = configFile.hideDarkModeToggle;
    }
    if (programOptions.hideDarkModeToggle) {
        mainData.hideDarkModeToggle = programOptions.hideDarkModeToggle;
    }

    if (isCoverageOn(configFile.coverageTest)) {
        mainData.coverageTest = true;
        mainData.coverageTestThreshold = coverageValue(
            configFile.coverageTest,
            COMPODOC_DEFAULTS.defaultCoverageThreshold
        );
    }
    if (programOptions.coverageTest) {
        mainData.coverageTest = true;
        mainData.coverageTestThreshold = coverageValue(
            programOptions.coverageTest,
            COMPODOC_DEFAULTS.defaultCoverageThreshold
        );
    }

    if (isCoverageOn(configFile.coverageMinimumPerFile)) {
        mainData.coverageTestPerFile = true;
        mainData.coverageMinimumPerFile = coverageValue(
            configFile.coverageMinimumPerFile,
            COMPODOC_DEFAULTS.defaultCoverageMinimumPerFile
        );
    }
    if (programOptions.coverageMinimumPerFile) {
        mainData.coverageTestPerFile = true;
        mainData.coverageMinimumPerFile = coverageValue(
            programOptions.coverageMinimumPerFile,
            COMPODOC_DEFAULTS.defaultCoverageMinimumPerFile
        );
    }

    // The flag has a commander default, so only an explicit CLI value beats the config file.
    if (configFile.coverageTestThresholdFail !== undefined) {
        mainData.coverageTestThresholdFail = isFailOn(configFile.coverageTestThresholdFail);
    }
    if (program.getOptionValueSource('coverageTestThresholdFail') === 'cli') {
        mainData.coverageTestThresholdFail = isFailOn(programOptions.coverageTestThresholdFail);
    }

    if (configFile.coverageTestShowOnlyFailed) {
        mainData.coverageTestShowOnlyFailed = configFile.coverageTestShowOnlyFailed;
    }
    if (programOptions.coverageTestShowOnlyFailed) {
        mainData.coverageTestShowOnlyFailed = programOptions.coverageTestShowOnlyFailed;
    }

    if (configFile.unitTestCoverage) {
        mainData.unitTestCoverage = configFile.unitTestCoverage;
    }
    if (programOptions.unitTestCoverage) {
        mainData.unitTestCoverage = programOptions.unitTestCoverage;
    }

    if (configFile.disableSourceCode) {
        mainData.disableSourceCode = configFile.disableSourceCode;
    }
    if (programOptions.disableSourceCode) {
        mainData.disableSourceCode = programOptions.disableSourceCode;
    }

    if (configFile.disableDomTree) {
        mainData.disableDomTree = configFile.disableDomTree;
    }
    if (programOptions.disableDomTree) {
        mainData.disableDomTree = programOptions.disableDomTree;
    }

    if (configFile.disableTemplateTab) {
        mainData.disableTemplateTab = configFile.disableTemplateTab;
    }
    if (programOptions.disableTemplateTab) {
        mainData.disableTemplateTab = programOptions.disableTemplateTab;
    }

    if (configFile.disableStyleTab) {
        mainData.disableStyleTab = configFile.disableStyleTab;
    }
    if (programOptions.disableStyleTab) {
        mainData.disableStyleTab = programOptions.disableStyleTab;
    }

    if (configFile.disableGraph) {
        mainData.disableGraph = configFile.disableGraph;
    }
    if (programOptions.disableGraph) {
        mainData.disableGraph = programOptions.disableGraph;
    }

    if (configFile.disableCoverage) {
        mainData.disableCoverage = configFile.disableCoverage;
    }
    if (programOptions.disableCoverage) {
        mainData.disableCoverage = programOptions.disableCoverage;
    }

    if (configFile.disablePrivate) {
        mainData.disablePrivate = configFile.disablePrivate;
    }
    if (programOptions.disablePrivate) {
        mainData.disablePrivate = programOptions.disablePrivate;
    }

    if (configFile.disableProtected) {
        mainData.disableProtected = configFile.disableProtected;
    }
    if (programOptions.disableProtected) {
        mainData.disableProtected = programOptions.disableProtected;
    }

    if (configFile.disableInternal) {
        mainData.disableInternal = configFile.disableInternal;
    }
    if (programOptions.disableInternal) {
        mainData.disableInternal = programOptions.disableInternal;
    }

    if (configFile.disableLifeCycleHooks) {
        mainData.disableLifeCycleHooks = configFile.disableLifeCycleHooks;
    }
    if (programOptions.disableLifeCycleHooks) {
        mainData.disableLifeCycleHooks = programOptions.disableLifeCycleHooks;
    }

    if (configFile.disableConstructors) {
        mainData.disableConstructors = configFile.disableConstructors;
    }
    if (programOptions.disableConstructors) {
        mainData.disableConstructors = programOptions.disableConstructors;
    }

    if (configFile.disableRoutes) {
        mainData.disableRoutes = configFile.disableRoutes;
    }
    if (programOptions.disableRoutes) {
        mainData.disableRoutes = programOptions.disableRoutes;
    }

    if (configFile.disableSearch) {
        mainData.disableSearch = configFile.disableSearch;
    }
    if (programOptions.disableSearch) {
        mainData.disableSearch = programOptions.disableSearch;
    }

    if (configFile.disableDependencies) {
        mainData.disableDependencies = configFile.disableDependencies;
    }
    if (programOptions.disableDependencies) {
        mainData.disableDependencies = programOptions.disableDependencies;
    }

    if (configFile.disableDependenciesTab) {
        mainData.disableDependenciesTab = configFile.disableDependenciesTab;
    }
    if (programOptions.disableDependenciesTab) {
        mainData.disableDependenciesTab = programOptions.disableDependenciesTab;
    }

    if (configFile.disablePlaygroundTab) {
        mainData.disablePlaygroundTab = configFile.disablePlaygroundTab;
    }
    if (programOptions.disablePlaygroundTab) {
        mainData.disablePlaygroundTab = programOptions.disablePlaygroundTab;
    }

    if (configFile.strictPlaygrounds) {
        mainData.strictPlaygrounds = configFile.strictPlaygrounds;
    }
    if (programOptions.strictPlaygrounds) {
        mainData.strictPlaygrounds = programOptions.strictPlaygrounds;
    }

    if (configFile.disableProperties) {
        mainData.disableProperties = configFile.disableProperties;
    }
    if (programOptions.disableProperties) {
        mainData.disableProperties = programOptions.disableProperties;
    }

    if (configFile.disableFilePath) {
        mainData.disableFilePath = configFile.disableFilePath;
    }
    if (programOptions.disableFilePath) {
        mainData.disableFilePath = programOptions.disableFilePath;
    }

    if (configFile.disableOverview) {
        mainData.disableOverview = configFile.disableOverview;
    }
    if (programOptions.disableOverview) {
        mainData.disableOverview = programOptions.disableOverview;
    }

    const disableMarkdownPages =
        program.getOptionValueSource('disableMarkdownPages') === 'cli'
            ? programOptions.disableMarkdownPages
            : configFile.disableMarkdownPages;
    if (disableMarkdownPages !== undefined) {
        const parsed = parseDisableMarkdownPages(disableMarkdownPages);
        for (const warning of parsed.warnings) {
            logger.warn(warning);
        }
        mainData.disableMarkdownPages = parsed.pages;
    }

    if (configFile.showEffects) {
        mainData.showEffects = configFile.showEffects;
    }
    if (programOptions.showEffects) {
        mainData.showEffects = programOptions.showEffects;
    }

    if (configFile.minimal) {
        mainData.disableSearch = true;
        mainData.disableRoutes = true;
        mainData.disableGraph = true;
        mainData.disableCoverage = true;
    }
    if (programOptions.minimal) {
        mainData.disableSearch = true;
        mainData.disableRoutes = true;
        mainData.disableGraph = true;
        mainData.disableCoverage = true;
    }

    if (configFile.customFavicon) {
        mainData.customFavicon = configFile.customFavicon;
    }
    if (programOptions.customFavicon) {
        mainData.customFavicon = programOptions.customFavicon;
    }

    if (configFile.customLogo) {
        mainData.customLogo = configFile.customLogo;
    }
    if (programOptions.customLogo) {
        mainData.customLogo = programOptions.customLogo;
    }

    if (configFile.customLogoDark) {
        mainData.customLogoDark = configFile.customLogoDark;
    }
    if (programOptions.customLogoDark) {
        mainData.customLogoDark = programOptions.customLogoDark;
    }
    if (mainData.customLogoDark && !mainData.customLogo) {
        logger.warn('customLogoDark: needs customLogo; ignored');
        mainData.customLogoDark = '';
    }
    if (
        mainData.customLogoDark &&
        logoImage(mainData.customLogoDark) === logoImage(mainData.customLogo)
    ) {
        logger.warn(
            `customLogoDark: "${logoImage(mainData.customLogoDark)}" has the file name of customLogo; ignored`
        );
        mainData.customLogoDark = '';
    }

    const logoLayout = programOptions.logoLayout ?? configFile.logoLayout;
    if (logoLayout !== undefined) {
        if (isLogoLayoutSetting(logoLayout)) {
            mainData.logoLayout = logoLayout;
        } else {
            logger.warn(
                `logoLayout: expected one of ${LOGO_LAYOUTS.join(', ')}, got "${logoLayout}"; ignored`
            );
        }
    }

    if (configFile.gaID) {
        mainData.gaID = configFile.gaID;
    }
    if (programOptions.gaID) {
        mainData.gaID = programOptions.gaID;
    }

    if (configFile.publicApiOnly) {
        mainData.publicApiOnly = configFile.publicApiOnly;
    }
    if (programOptions.publicApiOnly) {
        mainData.publicApiOnly = programOptions.publicApiOnly;
    }

    // The block below historically lived AFTER the banner print. That
    // ordering is preserved by the orchestrator calling printBanner
    // between `loadConfigFile` and a follow-up logger.info for the
    // discovered config file. Everything from here to the end of the
    // function is post-banner config merge logic.

    if (programOptions.language && !I18nEngine.supportLanguage(programOptions.language)) {
        logger.warn(
            `The language ${programOptions.language} is not available, falling back to ${I18nEngine.fallbackLanguage}`
        );
    }

    if (programOptions.tsconfig && typeof programOptions.tsconfig === 'boolean') {
        logger.error(`Please provide a tsconfig file.`);
        process.exit(1);
    }

    if (configFile.tsconfig) {
        mainData.tsconfig = configFile.tsconfig;
    }
    if (programOptions.tsconfig) {
        mainData.tsconfig = programOptions.tsconfig;
    }

    if (configFile.maxSearchResults !== undefined) {
        const result = parseMaxSearchResults(configFile.maxSearchResults, 'config');
        if (isErr(result)) {
            logger.error(result.message);
            process.exit(1);
        }
        mainData.maxSearchResults = result.value;
    }
    if (program.getOptionValueSource('maxSearchResults') === 'cli') {
        const result = parseMaxSearchResults(programOptions.maxSearchResults, 'flag');
        if (isErr(result)) {
            logger.error(result.message);
            process.exit(1);
        }
        mainData.maxSearchResults = result.value;
    }
    if (configFile.searchFacetLimit !== undefined) {
        const result = parseSearchFacetLimit(configFile.searchFacetLimit, 'config');
        if (isErr(result)) {
            logger.error(result.message);
            process.exit(1);
        }
        mainData.searchFacetLimit = result.value;
    }
    if (program.getOptionValueSource('searchFacetLimit') === 'cli') {
        const result = parseSearchFacetLimit(programOptions.searchFacetLimit, 'flag');
        if (isErr(result)) {
            logger.error(result.message);
            process.exit(1);
        }
        mainData.searchFacetLimit = result.value;
    }

    for (const [key, reason] of Object.entries(IGNORED_CONFIG_KEYS)) {
        if ((configFile as Record<string, unknown>)[key] !== undefined) {
            logger.warn(`${key} is ignored: ${reason}`);
        }
    }

    if (configFile.menuLayout !== undefined) {
        const layout = configFile.menuLayout;
        if (layout !== 'type' && layout !== 'feature') {
            logger.error(`Invalid menuLayout value "${layout}". Expected "type" or "feature".`);
            process.exit(2);
        }
        mainData.menuLayout = layout;
    }

    applyFeatureConfig(configFile, mainData);
    applyAxesConfig(configFile, mainData);
    applyMenuFeatureSections(configFile, mainData);
    applyStyleFilesConfig(configFile, mainData, sources);

    if (configFile.featuresName !== undefined) {
        if (typeof configFile.featuresName !== 'string') {
            logger.error(
                `Invalid featuresName value "${configFile.featuresName}". Expected string.`
            );
            process.exit(2);
        }
        mainData.featuresName = configFile.featuresName;
    }

    if (configFile.aiGeneratedNote !== undefined) {
        if (typeof configFile.aiGeneratedNote !== 'string') {
            logger.error(
                `Invalid aiGeneratedNote value "${configFile.aiGeneratedNote}". Expected string.`
            );
            process.exit(2);
        }
        mainData.aiGeneratedNote = configFile.aiGeneratedNote.trim();
    }

    if (configFile.exampleUrlBase !== undefined) {
        if (typeof configFile.exampleUrlBase !== 'string') {
            logger.error(
                `Invalid exampleUrlBase value "${configFile.exampleUrlBase}". Expected string.`
            );
            process.exit(2);
        }
        mainData.exampleUrlBase = configFile.exampleUrlBase.trim();
    }
    if (program.getOptionValueSource('exampleUrlBase') === 'cli') {
        mainData.exampleUrlBase = String(programOptions.exampleUrlBase).trim();
    }

    if (configFile.referencesName !== undefined) {
        if (typeof configFile.referencesName !== 'string') {
            logger.error(
                `Invalid referencesName value "${configFile.referencesName}". Expected string.`
            );
            process.exit(2);
        }
        mainData.referencesName = configFile.referencesName;
    }

    if (configFile.collapsedAll !== undefined) {
        if (typeof configFile.collapsedAll !== 'boolean') {
            logger.error(
                `Invalid collapsedAll value "${configFile.collapsedAll}". Expected boolean.`
            );
            process.exit(2);
        }
        mainData.collapsedAll = configFile.collapsedAll;
    }
}
