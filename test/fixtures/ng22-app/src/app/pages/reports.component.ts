import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReportLoader } from '../reports/report-loader.service';

/**
 * Lazily loaded report list.
 */
@Component({
    selector: 'app-reports',
    template: '<p>{{ loader.count.value() }}</p>',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportsComponent {
    protected readonly loader = inject(ReportLoader);
}
