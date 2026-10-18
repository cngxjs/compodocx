import { Rule, SchematicContext, SchematicsException, Tree } from '@angular-devkit/schematics';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';
import {
    DEFAULT_SCRIPT_PREFIX,
    GENERATED_SCRIPT_KEYS,
    SCRIPT_PREFIX_PATTERN,
    SCRIPT_VALUE_TEMPLATES,
    TSCONFIG_DOC_TEMPLATE
} from './constants';
import { detectLegacyArtefacts, hasAnyLegacy, type PackageJsonLike } from './detect';
import { logInstallSummary, logMigrationSummary } from './log';
import { migrateLegacyArtefacts } from './migrate';
import type { NgAddSchema } from './schema';
import { resolveWorkspaceTarget, type WorkspaceTarget } from './workspace';

const ROOT_PACKAGE_JSON = 'package.json';

interface ResolvedOptions {
    skipMigration: boolean;
    project: string;
    scriptPrefix: string;
}

function resolveOptions(options: NgAddSchema): ResolvedOptions {
    const scriptPrefix = (options.scriptPrefix ?? DEFAULT_SCRIPT_PREFIX).trim();
    if (!SCRIPT_PREFIX_PATTERN.test(scriptPrefix)) {
        throw new SchematicsException(
            `Invalid --scriptPrefix '${scriptPrefix}'. Must match ${SCRIPT_PREFIX_PATTERN.source}.`
        );
    }
    return {
        skipMigration: options.skipMigration === true,
        project: options.project ?? '',
        scriptPrefix
    };
}

function readPackageJson(tree: Tree, path: string): PackageJsonLike {
    const buffer = tree.read(path);
    if (!buffer) {
        throw new SchematicsException(`Could not locate ${path}.`);
    }
    try {
        return JSON.parse(buffer.toString()) as PackageJsonLike;
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        throw new SchematicsException(`Could not parse ${path}: ${message}`);
    }
}

function writePackageJson(tree: Tree, path: string, packageJson: PackageJsonLike): void {
    const serialized = `${JSON.stringify(packageJson, null, 2)}\n`;
    tree.overwrite(path, serialized);
}

function buildScriptValue(key: string, tsconfigPath: string): string {
    if (key === 'build' || key === 'serve' || key === 'build-and-serve') {
        return SCRIPT_VALUE_TEMPLATES[key]({ tsconfigPath });
    }
    throw new SchematicsException(`Unknown generated script key '${key}'.`);
}

function applyGeneratedScripts(
    packageJson: PackageJsonLike,
    target: WorkspaceTarget,
    scriptPrefix: string
): { added: number } {
    const scripts: { [key: string]: string } = packageJson.scripts ?? {};
    let added = 0;

    for (const key of GENERATED_SCRIPT_KEYS) {
        const fullKey = `${scriptPrefix}:${key}`;
        const value = buildScriptValue(key, target.tsconfigDocPath);
        if (scripts[fullKey] !== value) {
            scripts[fullKey] = value;
            added += 1;
        }
    }

    packageJson.scripts = scripts;
    return { added };
}

export function ngAdd(options: NgAddSchema = {}): Rule {
    return (tree: Tree, context: SchematicContext) => {
        const resolved = resolveOptions(options);

        const targetResult = resolveWorkspaceTarget(tree, resolved.project);
        if (targetResult.ok === false) {
            throw new SchematicsException(targetResult.message);
        }
        const target = targetResult.value;

        const packageJson = readPackageJson(tree, ROOT_PACKAGE_JSON);
        const finding = detectLegacyArtefacts(packageJson, tree.exists(target.tsconfigDocPath));

        let nextPackageJson: PackageJsonLike = packageJson;
        if (!resolved.skipMigration && hasAnyLegacy(finding)) {
            const migration = migrateLegacyArtefacts(
                packageJson,
                finding,
                resolved.scriptPrefix
            );
            nextPackageJson = migration.packageJson;
            logMigrationSummary(context.logger, migration);
        }

        const { added } = applyGeneratedScripts(nextPackageJson, target, resolved.scriptPrefix);
        writePackageJson(tree, ROOT_PACKAGE_JSON, nextPackageJson);

        let createdTsconfigDoc = false;
        if (!tree.exists(target.tsconfigDocPath)) {
            tree.create(
                target.tsconfigDocPath,
                `${JSON.stringify(TSCONFIG_DOC_TEMPLATE, null, 2)}\n`
            );
            createdTsconfigDoc = true;
        }

        context.addTask(new NodePackageInstallTask());

        logInstallSummary(context.logger, {
            addedScriptCount: added,
            createdTsconfigDoc,
            scriptPrefix: resolved.scriptPrefix,
            projectName: target.projectName
        });

        return tree;
    };
}
