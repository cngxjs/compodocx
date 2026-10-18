import { Service } from '@angular/core';

/**
 * Report engine, kept out of the main bundle.
 */
@Service()
export default class ReportEngine {
    /** Number of stored reports. */
    count(): number {
        return 0;
    }
}
