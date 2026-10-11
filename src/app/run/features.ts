import * as fs from 'node:fs';
import * as path from 'node:path';

import {
    compareText,
    detectFeatures,
    type FamilySymbol,
    type Feature,
    type FeatureDetection,
    type FeatureFs,
    type FeatureModel,
    type FeatureSymbol,
    factKey,
    linkFamilies,
    relativeFile,
    type SemanticModel
} from '../compiler/semantic';
import type { MainDataInterface } from '../interfaces/main-data.interface';
import { featureSegments, placeInFolders, type SymbolTable, toSymbolKey } from '../links';

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
        if (entry.ref.kind === 'style') {
            continue;
        }
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
    const sourceFiles = files.map(file => relativeFile(cwd, path.resolve(cwd, file)));
    const detect = (members: readonly FeatureSymbol[], documented: readonly string[]) =>
        detectFeatures({
            symbols: members,
            files: documented,
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
    const detection = detect(inputs.features, sourceFiles);
    const families = linkFamilies(detection.model, inputs.families);
    const symbolsOnly = { ...detection, model: { ...detection.model, families } };
    const styles = styleInputs(symbols);
    return styles.length === 0
        ? symbolsOnly
        : withStyleMembers(symbolsOnly, styles, detect, inputs.features, sourceFiles);
};

/** One file-only feature member per style page of the table. */
const styleInputs = (symbols: SymbolTable): readonly FeatureSymbol[] =>
    [...symbols.byId.values()]
        .filter(entry => entry.ref.kind === 'style')
        .map(entry => ({ key: factKey(toSymbolKey(entry.ref)), file: entry.ref.file }));

/**
 * Place the style pages by the same rules as symbols. A second detection
 * with the style files added gives each its feature; the symbols keep the
 * features of the first one, so style files never move a symbol. A feature
 * only style files fall into joins the model.
 */
const withStyleMembers = (
    detection: FeatureDetection,
    styles: readonly FeatureSymbol[],
    detect: (members: readonly FeatureSymbol[], documented: readonly string[]) => FeatureDetection,
    members: readonly FeatureSymbol[],
    sourceFiles: readonly string[]
): FeatureDetection => {
    const withStyles = detect(
        [...members, ...styles],
        [...sourceFiles, ...styles.map(style => style.file)]
    ).model;
    const known = new Set(detection.model.features.map(feature => feature.id));
    const featureOf = new Map(detection.model.featureOf);
    const added = new Map<string, Feature>();
    for (const style of styles) {
        const id = withStyles.featureOf.get(style.key);
        const feature = withStyles.features.find(candidate => candidate.id === id);
        if (id === undefined || feature === undefined) {
            continue;
        }
        featureOf.set(style.key, id);
        if (!known.has(id)) {
            added.set(id, { ...feature, styleOnly: true });
        }
    }
    const features = [...detection.model.features, ...added.values()].sort(
        (a, b) => compareText(a.entryPoint ?? '', b.entryPoint ?? '') || compareText(a.key, b.key)
    );
    return { ...detection, model: { ...detection.model, features, featureOf } };
};

/** The table with every symbol page in the folder of its feature (its page segments). */
export const placeInFeatures = (symbols: SymbolTable, features: FeatureModel): SymbolTable => {
    const { segments } = featureSegments(features.features);
    return placeInFolders(symbols, entry => {
        const feature = features.featureOf.get(factKey(toSymbolKey(entry.ref)));
        return feature === undefined ? undefined : segments.get(feature);
    });
};
