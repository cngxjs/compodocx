import * as fs from 'node:fs';
import * as path from 'node:path';

import {
    detectFeatures,
    type FamilySymbol,
    type FeatureDetection,
    type FeatureFs,
    type FeatureSymbol,
    factKey,
    linkFamilies,
    relativeFile,
    type SemanticModel
} from '../compiler/semantic';
import type { MainDataInterface } from '../interfaces/main-data.interface';
import { type SymbolTable, toSymbolKey } from '../links';

/** File system answers for the feature detection, paths relative to `cwd`. */
export const nodeFeatureFs = (cwd: string): FeatureFs => {
    const stat = (rel: string) => {
        try {
            return fs.statSync(path.resolve(cwd, rel));
        } catch {
            return undefined;
        }
    };
    return {
        isDirectory: dir => stat(dir)?.isDirectory() === true,
        isFile: file => stat(file)?.isFile() === true,
        packageName: dir => {
            try {
                const manifest = JSON.parse(
                    fs.readFileSync(path.resolve(cwd, dir, 'package.json'), 'utf8')
                );
                return typeof manifest.name === 'string' ? manifest.name : undefined;
            } catch {
                return undefined;
            }
        }
    };
};

interface Inputs {
    readonly features: readonly FeatureSymbol[];
    readonly families: readonly FamilySymbol[];
}

/**
 * One entry per documented symbol that is not hidden, in table order. A
 * symbol without facts (a module augmentation, a destructured constant) is
 * placed by its file alone.
 */
const symbolInputs = (symbols: SymbolTable, model: SemanticModel): Inputs => {
    const seen = new Set<string>();
    const features: FeatureSymbol[] = [];
    const families: FamilySymbol[] = [];
    for (const entry of symbols.byId.values()) {
        const key = factKey(toSymbolKey(entry.ref));
        const facts = model.facts.get(key);
        if (seen.has(key) || facts?.notExported) {
            continue;
        }
        seen.add(key);
        features.push({ key, file: entry.ref.file, tag: facts?.featureTag });
        families.push({ key, kind: entry.ref.kind, usedBy: (facts?.usedBy ?? []).map(factKey) });
    }
    return { features, families };
};

/**
 * Features of the documented symbols, from the semantic facts and the
 * feature config, with the family links between them.
 */
export const deriveFeatures = (
    model: SemanticModel,
    symbols: SymbolTable,
    mainData: MainDataInterface,
    files: readonly string[],
    cwd: string
): FeatureDetection => {
    const inputs = symbolInputs(symbols, model);
    const detection = detectFeatures({
        symbols: inputs.features,
        files: files.map(file => relativeFile(cwd, path.resolve(cwd, file))),
        entryPoints: model.entryPoints,
        imports: model.imports ?? { edges: new Map() },
        config: {
            features: mainData.features,
            containers: mainData.featureContainers,
            utilityFolders: mainData.featureUtilityFolders,
            roleFolders: mainData.featureRoleFolders
        },
        fs: nodeFeatureFs(cwd)
    });
    const families = linkFamilies(detection.model, inputs.families);
    return { ...detection, model: { ...detection.model, families } };
};
