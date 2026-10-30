import { Component, inject } from '@angular/core';
import { AuditService } from './audit.service';
import { ConsoleLogger, Logger } from './logger';

/**
 * Shows the audit trail. Provides its own audit service and logger.
 */
@Component({
    selector: 'app-audit-panel',
    template: '<p>Audit</p>',
    providers: [AuditService, { provide: Logger, useClass: ConsoleLogger }]
})
export class AuditPanelComponent {
    protected readonly audit = inject(AuditService);
}
