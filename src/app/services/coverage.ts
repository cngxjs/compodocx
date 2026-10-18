import * as path from 'node:path';
import { SyntaxKind } from 'ts-morph';

export type CoverageStatus = 'low' | 'medium' | 'good' | 'very-good';

export interface CoverageFile {
    filePath: string;
    type: string;
    linktype: string;
    linksubtype?: string;
    name: string;
    coveragePercent: number;
    coverageCount: string;
    status: CoverageStatus;
}

export interface CoverageReport {
    files: CoverageFile[];
    count: number;
    status: CoverageStatus;
}

export interface CoverageDependenciesInput {
    components: ReadonlyArray<unknown>;
    directives: ReadonlyArray<unknown>;
    entities: ReadonlyArray<unknown>;
    classes: ReadonlyArray<unknown>;
    injectables: ReadonlyArray<unknown>;
    services?: ReadonlyArray<unknown>;
    interfaces: ReadonlyArray<unknown>;
    guards: ReadonlyArray<unknown>;
    interceptors: ReadonlyArray<unknown>;
    pipes: ReadonlyArray<unknown>;
    miscellaneous: {
        functions: ReadonlyArray<unknown>;
        variables: ReadonlyArray<unknown>;
        typealiases: ReadonlyArray<unknown>;
    };
}

function getStatus(percent: number): CoverageStatus {
    if (percent <= 25) {
        return 'low';
    }
    if (percent > 25 && percent <= 50) {
        return 'medium';
    }
    if (percent > 50 && percent <= 75) {
        return 'good';
    }
    return 'very-good';
}

export function computeDocumentationCoverage(deps: CoverageDependenciesInput): CoverageReport {
    let files: CoverageFile[] = [];
    let totalProjectStatementDocumented = 0;

    const processComponentsAndDirectivesAndControllersAndEntities = (list: ReadonlyArray<any>) => {
        list.forEach((el: any) => {
            const element = (Object as any).assign({}, el);
            if (!element.propertiesClass) {
                element.propertiesClass = [];
            }
            if (!element.methodsClass) {
                element.methodsClass = [];
            }
            if (!element.hostBindings) {
                element.hostBindings = [];
            }
            if (!element.hostListeners) {
                element.hostListeners = [];
            }
            if (!element.inputsClass) {
                element.inputsClass = [];
            }
            if (!element.outputsClass) {
                element.outputsClass = [];
            }
            const cl: any = {
                filePath: element.file,
                type: element.type,
                linktype: element.type,
                name: element.name
            };
            let totalStatementDocumented = 0;
            let totalStatements =
                element.propertiesClass.length +
                element.methodsClass.length +
                element.inputsClass.length +
                element.hostBindings.length +
                element.hostListeners.length +
                element.outputsClass.length +
                1; // +1 for element decorator comment

            if (element.constructorObj) {
                totalStatements += 1;
                if (
                    element.constructorObj?.description &&
                    element.constructorObj.description !== ''
                ) {
                    totalStatementDocumented += 1;
                }
            }
            if (element.description && element.description !== '') {
                totalStatementDocumented += 1;
            }

            element.propertiesClass.forEach((property: any) => {
                if (property.modifierKind === SyntaxKind.PrivateKeyword) {
                    // Doesn't handle private for coverage
                    totalStatements -= 1;
                }
                if (
                    property.description &&
                    property.description !== '' &&
                    property.modifierKind !== SyntaxKind.PrivateKeyword
                ) {
                    totalStatementDocumented += 1;
                }
            });
            element.methodsClass.forEach((method: any) => {
                if (method.modifierKind === SyntaxKind.PrivateKeyword) {
                    // Doesn't handle private for coverage
                    totalStatements -= 1;
                }
                if (
                    method.description &&
                    method.description !== '' &&
                    method.modifierKind !== SyntaxKind.PrivateKeyword
                ) {
                    totalStatementDocumented += 1;
                }
            });
            element.hostBindings.forEach((property: any) => {
                if (property.modifierKind === SyntaxKind.PrivateKeyword) {
                    // Doesn't handle private for coverage
                    totalStatements -= 1;
                }
                if (
                    property.description &&
                    property.description !== '' &&
                    property.modifierKind !== SyntaxKind.PrivateKeyword
                ) {
                    totalStatementDocumented += 1;
                }
            });
            element.hostListeners.forEach((method: any) => {
                if (method.modifierKind === SyntaxKind.PrivateKeyword) {
                    // Doesn't handle private for coverage
                    totalStatements -= 1;
                }
                if (
                    method.description &&
                    method.description !== '' &&
                    method.modifierKind !== SyntaxKind.PrivateKeyword
                ) {
                    totalStatementDocumented += 1;
                }
            });
            element.inputsClass.forEach((input: any) => {
                if (input.modifierKind === SyntaxKind.PrivateKeyword) {
                    // Doesn't handle private for coverage
                    totalStatements -= 1;
                }
                if (
                    input.description &&
                    input.description !== '' &&
                    input.modifierKind !== SyntaxKind.PrivateKeyword
                ) {
                    totalStatementDocumented += 1;
                }
            });
            element.outputsClass.forEach((output: any) => {
                if (output.modifierKind === SyntaxKind.PrivateKeyword) {
                    // Doesn't handle private for coverage
                    totalStatements -= 1;
                }
                if (
                    output.description &&
                    output.description !== '' &&
                    output.modifierKind !== SyntaxKind.PrivateKeyword
                ) {
                    totalStatementDocumented += 1;
                }
            });

            cl.coveragePercent = Math.floor((totalStatementDocumented / totalStatements) * 100);
            if (totalStatements === 0) {
                cl.coveragePercent = 0;
            }
            cl.coverageCount = `${totalStatementDocumented}/${totalStatements}`;
            cl.status = getStatus(cl.coveragePercent);
            totalProjectStatementDocumented += cl.coveragePercent;
            files.push(cl);
        });
    };

    const processFunctionsAndVariables = (id: ReadonlyArray<any>, type: string) => {
        id.forEach((el: any) => {
            const cl: any = {
                filePath: el.file,
                type: type,
                linktype: el.type,
                linksubtype: el.subtype,
                name: el.name
            };
            if (type === 'variable' || type === 'function' || type === 'type alias') {
                cl.linktype = 'miscellaneous';
            }
            let totalStatementDocumented = 0;
            let totalStatements = 1;

            if (el.modifierKind === SyntaxKind.PrivateKeyword) {
                // Doesn't handle private for coverage
                totalStatements -= 1;
            }
            if (
                el.description &&
                el.description !== '' &&
                el.modifierKind !== SyntaxKind.PrivateKeyword
            ) {
                totalStatementDocumented += 1;
            }

            cl.coveragePercent = Math.floor((totalStatementDocumented / totalStatements) * 100);
            cl.coverageCount = `${totalStatementDocumented}/${totalStatements}`;
            cl.status = getStatus(cl.coveragePercent);
            totalProjectStatementDocumented += cl.coveragePercent;
            files.push(cl);
        });
    };

    const processClasses = (list: ReadonlyArray<any>, type: string, linktype: string) => {
        list.forEach((cl: any) => {
            const element = (Object as any).assign({}, cl);
            if (!element.properties) {
                element.properties = [];
            }
            if (!element.methods) {
                element.methods = [];
            }
            const cla: any = {
                filePath: element.file,
                type: type,
                linktype: linktype,
                name: element.name
            };
            let totalStatementDocumented = 0;
            let totalStatements = element.properties.length + element.methods.length + 1; // +1 for element itself

            if (element.constructorObj) {
                totalStatements += 1;
                if (
                    element.constructorObj?.description &&
                    element.constructorObj.description !== ''
                ) {
                    totalStatementDocumented += 1;
                }
            }
            if (element.description && element.description !== '') {
                totalStatementDocumented += 1;
            }

            element.properties.forEach((property: any) => {
                if (property.modifierKind === SyntaxKind.PrivateKeyword) {
                    // Doesn't handle private for coverage
                    totalStatements -= 1;
                }
                if (
                    property.description &&
                    property.description !== '' &&
                    property.modifierKind !== SyntaxKind.PrivateKeyword
                ) {
                    totalStatementDocumented += 1;
                }
            });
            element.methods.forEach((method: any) => {
                if (method.modifierKind === SyntaxKind.PrivateKeyword) {
                    // Doesn't handle private for coverage
                    totalStatements -= 1;
                }
                if (
                    method.description &&
                    method.description !== '' &&
                    method.modifierKind !== SyntaxKind.PrivateKeyword
                ) {
                    totalStatementDocumented += 1;
                }
            });

            cla.coveragePercent = Math.floor((totalStatementDocumented / totalStatements) * 100);
            if (totalStatements === 0) {
                cla.coveragePercent = 0;
            }
            cla.coverageCount = `${totalStatementDocumented}/${totalStatements}`;
            cla.status = getStatus(cla.coveragePercent);
            totalProjectStatementDocumented += cla.coveragePercent;
            files.push(cla);
        });
    };

    processComponentsAndDirectivesAndControllersAndEntities(deps.components as any);
    processComponentsAndDirectivesAndControllersAndEntities(deps.directives as any);
    processComponentsAndDirectivesAndControllersAndEntities(deps.entities as any);

    processClasses(deps.classes as any, 'class', 'classe');
    processClasses(deps.injectables as any, 'injectable', 'injectable');
    processClasses((deps.services ?? []) as any, 'service', 'service');
    processClasses(deps.interfaces as any, 'interface', 'interface');
    processClasses(deps.guards as any, 'guard', 'guard');
    processClasses(deps.interceptors as any, 'interceptor', 'interceptor');

    deps.pipes.forEach((pipe: any) => {
        const cl: any = {
            filePath: pipe.file,
            type: pipe.type,
            linktype: pipe.type,
            name: pipe.name
        };
        let totalStatementDocumented = 0;
        const totalStatements = 1;
        if (pipe.description && pipe.description !== '') {
            totalStatementDocumented += 1;
        }

        cl.coveragePercent = Math.floor((totalStatementDocumented / totalStatements) * 100);
        cl.coverageCount = `${totalStatementDocumented}/${totalStatements}`;
        cl.status = getStatus(cl.coveragePercent);
        totalProjectStatementDocumented += cl.coveragePercent;
        files.push(cl);
    });

    processFunctionsAndVariables(deps.miscellaneous.functions as any, 'function');
    processFunctionsAndVariables(deps.miscellaneous.variables as any, 'variable');
    processFunctionsAndVariables(deps.miscellaneous.typealiases as any, 'type alias');

    files = [...files].sort((a, b) => a.filePath.localeCompare(b.filePath));

    const count = files.length > 0 ? Math.floor(totalProjectStatementDocumented / files.length) : 0;

    return {
        files,
        count,
        status: getStatus(count)
    };
}

export interface UnitTestCoverageMetric {
    coveragePercent: number;
    coverageCount: string;
    status: CoverageStatus | 'uncovered';
    total: number;
    covered: number;
}

export interface UnitTestCoverageEntry {
    name?: string;
    filePath?: string;
    type?: string;
    linktype?: string;
    linksubtype?: string;
    statements?: UnitTestCoverageMetric;
    branches?: UnitTestCoverageMetric;
    functions?: UnitTestCoverageMetric;
    lines?: UnitTestCoverageMetric;
}

export interface UnitTestCoverageReport {
    total: UnitTestCoverageEntry;
    files: UnitTestCoverageEntry[];
    idColumn: boolean;
}

function getCovStatus(percent: number, totalLines: number): CoverageStatus | 'uncovered' {
    if (totalLines === 0) {
        return 'uncovered';
    }
    if (percent <= 25) {
        return 'low';
    }
    if (percent > 25 && percent <= 50) {
        return 'medium';
    }
    if (percent > 50 && percent <= 75) {
        return 'good';
    }
    return 'very-good';
}

/**
 * Map per-file istanbul-style coverage JSON into the report shape consumed by
 * the unit-test coverage page. Caller is responsible for reading the file
 * and for handling absence (return null was the prior behaviour; here the
 * caller supplies the already-parsed summary).
 */
export function computeUnitTestCoverage(
    unitTestSummary: Record<string, unknown>,
    coverageFiles?: ReadonlyArray<CoverageFile>
): UnitTestCoverageReport {
    let covDat: Record<string, Partial<UnitTestCoverageEntry>> | undefined;
    let covFileNames: string[] | undefined;

    if (coverageFiles) {
        covDat = {};
        covFileNames = coverageFiles.map(el => {
            const fileName = path.normalize(el.filePath);
            covDat![fileName] = {
                type: el.type,
                linktype: el.linktype,
                linksubtype: el.linksubtype,
                name: el.name
            };
            return fileName;
        });
    }

    const getCoverageData = (data: any, fileName: string): UnitTestCoverageEntry => {
        let out: UnitTestCoverageEntry = {};
        if (fileName !== 'total') {
            if (covDat === undefined) {
                // need a name to include in output but this isn't visible
                out = { name: fileName, filePath: fileName };
            } else {
                const findMatch = covFileNames!.filter(el => {
                    const normalizedFilename = path.normalize(fileName).replace(/\\/g, '/');
                    return el.includes(fileName) || normalizedFilename.includes(el);
                });
                if (findMatch.length > 0) {
                    out = { ...covDat[findMatch[0]] };
                    out.filePath = fileName;
                }
            }
        }
        const keysToGet: Array<keyof UnitTestCoverageEntry> = [
            'statements',
            'branches',
            'functions',
            'lines'
        ];
        keysToGet.forEach(key => {
            if (data[key]) {
                const t = data[key];
                out[key as 'statements' | 'branches' | 'functions' | 'lines'] = {
                    coveragePercent: Math.round(t.pct),
                    coverageCount: `${t.covered}/${t.total}`,
                    status: getCovStatus(t.pct, t.total),
                    total: t.total,
                    covered: t.covered
                };
            }
        });
        return out;
    };

    let total: UnitTestCoverageEntry = {};
    const files: UnitTestCoverageEntry[] = [];
    for (const file in unitTestSummary) {
        const dat = getCoverageData((unitTestSummary as Record<string, any>)[file], file);
        if (file === 'total') {
            total = dat;
        } else {
            files.push(dat);
        }
    }

    return {
        total,
        files,
        idColumn: covDat !== undefined
    };
}
