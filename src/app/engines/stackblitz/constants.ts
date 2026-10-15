/**
 * Single source of truth for the StackBlitz playground manifest builder.
 * Both the dep walker and the file-content emitter read these limits - never
 * hardcode the same numbers in multiple call sites (caps belong at the
 * bottleneck so a future revision lifts them in one place).
 */

/** Maximum import depth to follow when walking transitive deps. */
export const STACKBLITZ_DEP_DEPTH = 3;

/** Hard ceiling on the number of source files included in one manifest. */
export const STACKBLITZ_FILE_COUNT_CAP = 25;

/** Per-file character cap applied at the file-content emitter bottleneck. */
export const STACKBLITZ_FILE_CAP = 8000;

/**
 * Observed StackBlitz project-POST limit. `openProject` submits the whole
 * project (files + dependencies) as a single form POST to stackblitz.com;
 * their edge (nginx) rejects bodies past roughly this size with
 * `413 Request Entity Too Large`. It is the REAL binding constraint on a
 * vendored playground's payload - the per-closure byte cap below is set under
 * it so a build fails fast instead of producing a manifest that 413s on click.
 * Not officially documented; sourced from the practical failure point.
 */
export const STACKBLITZ_POST_LIMIT = 2_000_000;

/**
 * Total byte cap on a single playground's vendored (`playgroundVendor`)
 * closure, AFTER slimming (sourcemaps + legacy bundle dirs dropped) and
 * entry-point pruning (only imported entry points + their referenced siblings
 * ship). The per-file truncation cap does NOT apply to vendored files -
 * truncating a FESM bundle would corrupt it - so the slimmed-and-pruned
 * closure is measured up front and the build FAILS, naming packages and sizes,
 * when it blows this cap.
 *
 * Default is set comfortably under {@link STACKBLITZ_POST_LIMIT} to leave room
 * for the non-vendored scaffold files and the form-encoding overhead of the
 * POST. Overridable per build via the `playgroundVendorCap` config key for the
 * rare oversized closure; raising it past the StackBlitz limit re-opens the
 * 413 it exists to prevent. The slimming/pruning is the real fix - this cap is
 * the backstop.
 */
export const STACKBLITZ_VENDOR_TOTAL_CAP = 1_500_000;

/**
 * StackBlitz `template` value passed to `openProject`. We deliberately use
 * `'node'` (WebContainer-based) rather than `'angular-cli'`: the latter has
 * a pinned Angular version baked into StackBlitz's runtime, which conflicts
 * with the consumer's `@angular/core` spec and crashes the dev server. With
 * `'node'`, our `package.json` and `angular.json` drive everything fresh.
 */
export const STACKBLITZ_TEMPLATE = 'node' as const;

/** Footer appended to truncated file contents. */
export const STACKBLITZ_TRUNCATION_FOOTER =
    '\n// ... [truncated by compodocx, view full source on the doc page]';

/**
 * Tag pattern for the JSDoc parser. Title is required after the tag name;
 * an optional trailing `.html` / `.ts` relative path token switches the block
 * into file-ref mode (handled by `extractJsdocPlaygroundBlocks`). The actual
 * parsing lives in `src/templates/helpers/jsdoc.ts` - this regex stays as a
 * coarse documentation-grade matcher; downstream consumers should not rely on
 * its capture group for file-ref detection.
 */
export const PLAYGROUND_TAG_PATTERN = /^@playground\s+(.+?)$/m;
