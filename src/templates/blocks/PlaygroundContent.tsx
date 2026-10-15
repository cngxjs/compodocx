import Html from '@kitajs/html';
import { renderCustomTemplate } from '../../app/engines/custom-template.engine';
import type {
    ConsumerPackageJson,
    DepGraphResolver,
    FileRefBundle,
    VendorPackage
} from '../../app/engines/stackblitz';
import type { ComponentPlaygroundBlock } from '../helpers/jsdoc';
import { BlockPlayground } from './BlockPlayground';

export type PlaygroundContentProps = {
    readonly componentName: string;
    readonly componentFile?: string;
    readonly componentSourceCode?: string;
    readonly playgrounds: ComponentPlaygroundBlock[];
    readonly resolve?: DepGraphResolver;
    readonly workspacePackage?: ConsumerPackageJson;
    readonly extraDependencies?: Record<string, string>;
    /** Config-file `playgroundMaterialShell` - forwarded to each block. */
    readonly materialShell?: boolean;
    /** Config caps forwarded to each block. */
    readonly depth?: number;
    readonly maxFiles?: number;
    readonly fileCap?: number;
    /** Config-file `playgroundHead` - extra `<head>` entries, forwarded to each block. */
    readonly head?: string[];
    /** Config-file `playgroundGlobalStyles` - global CSS, forwarded to each block. */
    readonly globalStyles?: string;
    /**
     * Vendor packages resolved from `playgroundVendor`, keyed by full package
     * name. Forwarded to each block; the manifest builder embeds only the
     * per-playground import closure.
     */
    readonly vendorPackages?: Record<string, VendorPackage>;
    /** Config-file `playgroundVendorCap` - forwarded to each block. */
    readonly vendorCap?: number;
    /**
     * Pre-resolved file-ref bundles, keyed by block index in
     * `props.playgrounds`. Populated by `application.ts:resolvePlaygroundFiles`
     * for blocks that carry `fileRef`; absent for inline blocks.
     */
    readonly fileBundles?: Record<number, FileRefBundle>;
};

/**
 * Renders one BlockPlayground per `@playground` block on the component. The
 * Playground tab calls this; tab visibility is gated upstream in
 * `getNavTabs()` so this component is only invoked when blocks exist.
 */
export function PlaygroundContent(props: PlaygroundContentProps): string {
    const blocks = props.playgrounds ?? [];
    const overrideArgs = {
        componentName: props.componentName,
        playgrounds: blocks
    };
    const custom = renderCustomTemplate('playground-content', overrideArgs);
    if (custom !== null) {
        return custom;
    }

    if (blocks.length === 0) {
        return '';
    }

    return (
        <div class="cdx-playground-stack">
            {blocks.map((block, index) =>
                BlockPlayground({
                    componentName: props.componentName,
                    componentFile: props.componentFile,
                    componentSourceCode: props.componentSourceCode,
                    block,
                    index,
                    resolve: props.resolve,
                    workspacePackage: props.workspacePackage,
                    extraDependencies: props.extraDependencies,
                    materialShell: props.materialShell,
                    depth: props.depth,
                    maxFiles: props.maxFiles,
                    fileCap: props.fileCap,
                    head: props.head,
                    globalStyles: props.globalStyles,
                    vendorPackages: props.vendorPackages,
                    vendorCap: props.vendorCap,
                    fileBundle: props.fileBundles?.[index]
                })
            )}
        </div>
    ) as string;
}
