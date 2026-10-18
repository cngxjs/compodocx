import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SessionService } from '../core/session.service';

/**
 * Start page. Opts back into the eager strategy.
 */
@Component({
    selector: 'app-dashboard',
    template: '<p>{{ session.profile.value()?.name }}</p>',
    changeDetection: ChangeDetectionStrategy.Default
})
export class DashboardComponent {
    protected readonly session = inject(SessionService);
}
