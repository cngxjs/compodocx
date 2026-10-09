import * as fs from 'node:fs';
import * as path from 'node:path';

import {
    detectFeatures,
    type FeatureDetection,
    type FeatureFs,
    type FeatureSymbol,
    factKey,
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

/** One entry per documented, exported symbol, in table order. */
const featureSymbols = (symbols: SymbolTable, model: SemanticModel): readonly FeatureSymbol[] => {
    const seen = new Set<string>();
    const out: FeatureSymbol[] = [];
    for (const entry of symbols.byId.values()) {
        const key = factKey(toSymbolKey(entry.ref));
        const facts = model.facts.get(key);
        if (seen.has(key) || !facts || facts.notExported) {
            continue;
        }
        seen.add(key);
        out.push({ key, file: entry.ref.file, tag: facts.featureTag });
    }
    return out;
};

/** Features of the documented symbols, from the semantic facts and the feature config. */
export const deriveFeatures = (
    model: SemanticModel,
    symbols: SymbolTable,
    mainData: MainDataInterface,
    files: readonly string[],
    cwd: string
): FeatureDetection =>
    detectFeatures({
        symbols: featureSymbols(symbols, model),
        files: files.map(file => relativeFile(cwd, path.resolve(cwd, file))),
        entryPoints: model.entryPoints,
        imports: model.imports ?? { edges: new Map() },
        config: {
            features: mainData.features,
            containers: mainData.featureContainers,
            utilityFolders: mainData.featureUtilityFolders
        },
        fs: nodeFeatureFs(cwd)
    });
