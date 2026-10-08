import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import Configuration from '../configuration';
import { withoutHiddenItems } from '../di/model';
import DependenciesEngine, { buildGroupTree } from '../engines/dependencies.engine';
import { pageLocation } from '../links/layout';

/**
 * Generates one landing page per `@category` bucket under
 * `menuLayout: 'feature'`. Pages live at `categories/<bucket-id>.html`
 * (bucket id may contain `/`, becoming a nested directory). The same URL
 * is linked from both the Features and References sidebar bucket-labels
 * — so the page serves as the canonical entry point for anyone
 * navigating by feature surface.
 *
 * Both leaf and intermediate folder nodes get a landing page:
 * - leaf (`ui/feedback/toast`): lists the entities directly tagged with
 *   `@category ui/feedback/toast` (plus any folder-fallback matches).
 * - intermediate (`ui/feedback`): lists every entity in itself AND all
 *   descendant leaves, so a reader exploring "ui/feedback" gets the
 *   whole surface without drilling further.
 *
 * No pages emit when `menuLayout !== 'feature'` — the type-layout has no
 * bucket concept.
 */
export class BucketLandingPageGenerator {
    public prepare(): Promise<true> {
        return new Promise(resolve => {
            const layout = Configuration.mainData.menuLayout ?? 'type';
            if (layout !== 'feature') {
                resolve(true);
                return;
            }
            const buckets = DependenciesEngine.categorizedByFeature ?? {};
            if (Object.keys(buckets).length === 0) {
                resolve(true);
                return;
            }
            logger.info('Prepare bucket landing pages');
            const visible = withoutHiddenItems(
                buckets as Record<string, any[]>,
                Configuration.mainData.di
            );
            const tree = buildGroupTree(visible);
            for (const node of tree) {
                this.emitRecursive(node);
            }
            resolve(true);
        });
    }

    /** Walk the bucket tree depth-first, emitting one landing page per
     *  non-empty node. Items from descendants aggregate up so intermediate
     *  landings list the whole surface; node-direct items take priority
     *  when the same entity name appears at multiple depths (the bucket
     *  tree builder doesn't duplicate so this is defensive only). */
    private emitRecursive(node: {
        name: string;
        fullPath: string;
        items: any[];
        children: any[];
    }): readonly any[] {
        const directItems = node.items ?? [];
        const descendantItems = (node.children ?? []).flatMap(child => this.emitRecursive(child));
        // Dedup by entity name + kind — same symbol won't appear twice on
        // an intermediate landing even if it lives under multiple subtrees.
        const seen = new Set<string>();
        const aggregated: any[] = [];
        for (const item of [...directItems, ...descendantItems]) {
            const key = `${item.kind}:${item.name}`;
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            aggregated.push(item);
        }
        if (aggregated.length === 0) {
            return [];
        }
        const segments = node.fullPath.split('/').filter(Boolean);
        if (segments.length === 0) {
            return aggregated;
        }
        const { path, filename, depth } = pageLocation({ type: 'bucket', segments });
        Configuration.addPage({
            path,
            name: `bucket-landing-${node.fullPath.replaceAll('/', '-')}`,
            filename,
            id: `bucket-landing-${node.fullPath.replaceAll('/', '-')}`,
            context: 'bucket-landing',
            bucketLanding: {
                bucket: node.fullPath,
                segments,
                depth,
                items: aggregated
            },
            depth,
            pageType: COMPODOC_DEFAULTS.PAGE_TYPES.INTERNAL
        } as any);
        return aggregated;
    }
}
