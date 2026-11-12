/**
 * Builds the config. Use it via `makeConfig` in a `useFactory`:
 *
 * ```ts
 * @Component({
 *   selector: 'app-root',
 *   providers: [{ provide: CONFIG, useFactory: () => makeConfig() }]
 * })
 * export class AppRoot {}
 * ```
 *
 * Done after the block.
 */
export function makeConfig(): number {
    return 1;
}
