import { Tree } from '@angular-devkit/schematics';

export interface WorkspaceTarget {
    /** Path of the package.json this run will modify (always 'package.json' at root). */
    packageJsonPath: string;
    /** Path of the tsconfig.doc.json this run will create. POSIX-style separators. */
    tsconfigDocPath: string;
    /** Resolved Angular CLI project name when angular.json declared >1 project. */
    projectName?: string;
}

export type Result<T, E> = { ok: true; value: T } | { ok: false; message: string };

interface AngularProject {
    root?: string;
    sourceRoot?: string;
    projectType?: string;
}

interface AngularWorkspaceFile {
    projects?: { [name: string]: AngularProject };
}

const ANGULAR_JSON = 'angular.json';
const ROOT_PACKAGE_JSON = 'package.json';
const TSCONFIG_DOC = 'tsconfig.doc.json';

function parseAngularJson(buffer: Buffer): Result<AngularWorkspaceFile, string> {
    let parsed: unknown;
    try {
        parsed = JSON.parse(buffer.toString());
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { ok: false, message: `Could not parse angular.json: ${message}` };
    }
    if (!parsed || typeof parsed !== 'object') {
        return { ok: false, message: 'Could not parse angular.json: not a JSON object.' };
    }
    return { ok: true, value: parsed as AngularWorkspaceFile };
}

function joinPosix(...segments: string[]): string {
    return segments
        .map(seg => seg.replace(/[\\/]+$/, '').replace(/\\/g, '/'))
        .filter(seg => seg.length > 0)
        .join('/');
}

function resolveProjectTsconfigPath(project: AngularProject): string {
    const root = (project.root ?? '').trim();
    if (!root) {
        return TSCONFIG_DOC;
    }
    return joinPosix(root, TSCONFIG_DOC);
}

export function resolveWorkspaceTarget(
    tree: Tree,
    projectOption: string
): Result<WorkspaceTarget, string> {
    if (!tree.exists(ANGULAR_JSON)) {
        return {
            ok: true,
            value: {
                packageJsonPath: ROOT_PACKAGE_JSON,
                tsconfigDocPath: TSCONFIG_DOC
            }
        };
    }

    const buffer = tree.read(ANGULAR_JSON);
    if (!buffer) {
        return { ok: false, message: 'Could not read angular.json.' };
    }

    const parsed = parseAngularJson(buffer);
    if (parsed.ok === false) {
        return parsed;
    }

    const projects = parsed.value.projects ?? {};
    const projectNames = Object.keys(projects);

    if (projectNames.length === 0) {
        return {
            ok: true,
            value: {
                packageJsonPath: ROOT_PACKAGE_JSON,
                tsconfigDocPath: TSCONFIG_DOC
            }
        };
    }

    const trimmed = projectOption.trim();

    if (projectNames.length === 1) {
        const onlyName = projectNames[0];
        if (trimmed && trimmed !== onlyName) {
            return {
                ok: false,
                message: `Project '${trimmed}' not found in angular.json. Available project: ${onlyName}.`
            };
        }
        return {
            ok: true,
            value: {
                packageJsonPath: ROOT_PACKAGE_JSON,
                tsconfigDocPath: resolveProjectTsconfigPath(projects[onlyName]),
                projectName: onlyName
            }
        };
    }

    if (!trimmed) {
        return {
            ok: false,
            message: `Multiple Angular projects found (${projectNames.join(', ')}). Pass --project <name>.`
        };
    }
    if (!Object.prototype.hasOwnProperty.call(projects, trimmed)) {
        return {
            ok: false,
            message: `Project '${trimmed}' not found in angular.json. Available projects: ${projectNames.join(', ')}.`
        };
    }
    return {
        ok: true,
        value: {
            packageJsonPath: ROOT_PACKAGE_JSON,
            tsconfigDocPath: resolveProjectTsconfigPath(projects[trimmed]),
            projectName: trimmed
        }
    };
}
