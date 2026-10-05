import { Directive, inject, input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { QueryParamGroupService } from './query-param-group.service';
import { QueryParamAccessor } from './query-param-accessor.interface';
import { selectValueAccessor } from '../accessors/util';

/**
 * Binds a {@link QueryParam} to a DOM element.
 *
 * This directive accepts the name of a {@link QueryParam} inside its parent {@link QueryParamGroup}.
 * It binds this parameter to the host element, which is required to have a [ControlValueAccessor]
 * {@link https://angular.io/api/forms/ControlValueAccessor}.
 */
@Directive({
    selector: '[queryParamName]'
})
export class QueryParamNameDirective implements QueryParamAccessor, OnChanges, OnDestroy {
    /**
     * The name of the {@link QueryParam} inside its parent {@link QueryParamGroup}.
     * Note that this does not refer to the [parameter name]{@link QueryParam#urlParam}.
     */
    public readonly name = input<string>(undefined, { alias: 'queryParamName' });

    private groupService = inject(QueryParamGroupService, { optional: true });

    private valueAccessors = inject(NG_VALUE_ACCESSOR, { optional: true, self: true });

    /** @internal */
    public valueAccessor: ControlValueAccessor | null = null;

    constructor() {
        if (!this.groupService) {
            throw new Error(
                `No parent configuration found. Did you forget to add [queryParamGroup]?`
            );
        }

        this.valueAccessor = selectValueAccessor(this.valueAccessors);
    }

    /** @ignore */
    public ngOnChanges(changes: SimpleChanges) {
        const nameChange = changes['name'];
        if (nameChange) {
            if (!nameChange.firstChange) {
                this.groupService.deregisterQueryParamDirective(nameChange.previousValue);
            }

            if (nameChange.currentValue) {
                this.groupService.registerQueryParamDirective(this);
            }
        }
    }

    /** @ignore */
    public ngOnDestroy() {
        if (this.groupService) {
            this.groupService.deregisterQueryParamDirective(this.name());
        }
    }
}
