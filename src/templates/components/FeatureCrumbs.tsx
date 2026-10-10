import Html from '@kitajs/html';
import Configuration from '../../app/configuration';
import type { EntityKind } from '../../app/engines/dependencies.engine';
import { hrefFor, hrefText } from '../../app/links/layout';
import type { TableKind } from '../../app/links/symbol-id';
import { type FeatureInfo, featureInfoOf } from '../helpers/feature-info';
import { ownEntry } from '../helpers/symbol-facts';

/** The feature of an engine object of `kind`; undefined without the feature model. */
export const entityFeature = (
    kind: EntityKind | TableKind,
    item: { readonly name?: unknown; readonly file?: unknown } | undefined
): FeatureInfo | undefined => {
    const data = Configuration.mainData;
    return featureInfoOf(data.semantic, ownEntry(data, kind, item));
};

const Crumb = (segments: readonly string[], text: string, depth: number): string =>
    (
        <li>
            <a href={hrefText(hrefFor({ type: 'feature', segments }, depth))}>{text}</a>
        </li>
    ) as string;

/**
 * Breadcrumb items of a symbol page: the entry point, then the feature when
 * it is not the entry point's root feature; an app feature on its own. Each
 * item links to its feature page. Undefined without a feature.
 */
export const FeatureCrumbs = (info: FeatureInfo | undefined, depth: number): string | undefined => {
    if (!info) {
        return undefined;
    }
    const { feature, segments } = info;
    if (feature.entryPoint === undefined) {
        return Crumb(segments, feature.label, depth);
    }
    if (feature.key === '') {
        return Crumb(segments, segments.join('/'), depth);
    }
    const entrySegments = info.root?.segments ?? segments.slice(0, -1);
    const entry = info.root
        ? Crumb(entrySegments, entrySegments.join('/'), depth)
        : ((<li>{entrySegments.join('/')}</li>) as string);
    return entry + Crumb(segments, feature.label, depth);
};
