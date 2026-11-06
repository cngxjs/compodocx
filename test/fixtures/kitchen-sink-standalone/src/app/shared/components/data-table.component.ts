import {
    Component,
    input,
    output,
    computed,
    signal,
    contentChild,
    contentChildren,
    TemplateRef,
    ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Column definition.
 */
export interface Column<T = unknown> {
    key: string;
    header: string;
    sortable?: boolean;
    width?: string;
    accessor?: (row: T) => unknown;
}

/**
 * A generic, standalone data table using signal APIs.
 *
 * @example
 * ```html
 * <app-data-table [columns]="cols" [rows]="data" (rowClicked)="onRow($event)" />
 * ```
 *
 * @since 2.0.0
 * @aiGenerated claude-opus-4.7
 * @storybook https://storybook.example.com/?path=/story/shared-datatable--default
 * @figma https://www.figma.com/file/abc123/Design-System?node-id=42:1337
 * @stackblitz https://stackblitz.com/edit/angular-data-table-demo
 * @github https://github.com/cngxjs/compodocx/blob/develop/test/fixtures/kitchen-sink-standalone/src/app/shared/components/data-table.component.ts
 * @docs https://cngx.dev/components/data-table
 */
@Component({
    selector: 'app-data-table',
    standalone: true,
    imports: [CommonModule],
    template: `
        <table>
            <thead>
                <tr>
                    <th *ngFor="let col of columns()">{{ col.header }}</th>
                </tr>
            </thead>
            <tbody>
                <tr *ngFor="let row of rows(); trackBy: trackByIndex" (click)="rowClicked.emit(row)">
                    <td *ngFor="let col of columns()">{{ getCellValue(row, col) }}</td>
                </tr>
            </tbody>
        </table>
        <p *ngIf="isEmpty()">No data available</p>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataTableComponent<T = unknown> {
    /**
     * Table column definitions.
     */
    readonly columns = input<Column<T>[]>([]);

    /**
     * Table row data.
     */
    readonly rows = input<T[]>([]);

    /**
     * Whether the table is loading.
     */
    readonly loading = input(false);

    /**
     * Emitted when a row is clicked.
     */
    readonly rowClicked = output<T>();

    /**
     * Emitted when a column is sorted.
     */
    readonly sortChanged = output<{ key: string; direction: 'asc' | 'desc' }>();

    /**
     * Whether the table is empty.
     */
    readonly isEmpty = computed(() => this.rows().length === 0 && !this.loading());

    /**
     * Total row count.
     */
    readonly rowCount = computed(() => this.rows().length);

    /**
     * Custom header template.
     */
    readonly headerTemplate = contentChild<TemplateRef<unknown>>('headerTpl');

    /**
     * Custom cell templates.
     */
    readonly cellTemplates = contentChildren<TemplateRef<unknown>>('cellTpl');

    /**
     * Current sort state.
     */
    private readonly sortState = signal<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    getCellValue(row: T, col: Column<T>): unknown {
        if (col.accessor) return col.accessor(row);
        return (row as Record<string, unknown>)[col.key];
    }

    trackByIndex(index: number): number {
        return index;
    }
}
