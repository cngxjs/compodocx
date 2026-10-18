import { Service, injectAsync, resource } from '@angular/core';

/**
 * Loads reports. The heavy engine is injected on first use only.
 */
@Service()
export class ReportLoader {
    /** Engine, loaded with its chunk on first call. */
    readonly engine = injectAsync(() => import('./report-engine'));

    /** Number of stored reports. */
    readonly count = resource({ loader: async () => (await this.engine()).count() });
}
