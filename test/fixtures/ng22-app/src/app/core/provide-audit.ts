import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { AuditService } from './audit.service';
import { ConsoleLogger, Logger } from './logger';

/**
 * Provides the audit trail for the application.
 */
export function provideAudit(): EnvironmentProviders {
    return makeEnvironmentProviders([AuditService, { provide: Logger, useClass: ConsoleLogger }]);
}
