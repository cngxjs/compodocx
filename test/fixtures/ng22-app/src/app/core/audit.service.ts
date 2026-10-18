import { Service } from '@angular/core';

/**
 * Collects audit entries. Not auto-provided: list it in a `providers` array.
 */
@Service({ autoProvided: false })
export class AuditService {
    private readonly entries: string[] = [];

    /** Adds one entry. */
    record(entry: string): void {
        this.entries.push(entry);
    }
}
