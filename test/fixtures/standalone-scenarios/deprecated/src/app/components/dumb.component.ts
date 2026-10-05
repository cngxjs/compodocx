import { Component, input, output } from '@angular/core';

import { DumbParentComponent } from './dumb-parent.component';

/**
 * @example
 * empty component
 *
 * @deprecated This component is deprecated
 */
@Component({
    selector: 'cp-dumb',
    template: 'dumb component',
    host: {
        '[attr.empty]': 'emptyHostBinding',
        '(mouseup)': 'onMouseup()'
    }
})
export class DumbComponent extends DumbParentComponent {
    /**
     * @example
     * component property
     */
    emptyProperty = '';

    /**
     * @example
     * component input
     * @deprecated This input is deprecated
     */
    public emptyInput = input<string>();

    /**
     * @example
     * component output
     * @deprecated This output is deprecated
     */
    public emptyOutput = output<string>();

    /**
     * @example
     * component accessor
     * @deprecated This getter is deprecated
     */
    get emptyAccessor() {
        return this._emptyAccessor;
    }
    /**
     * @deprecated This setter is deprecated
     */
    set emptyAccessor(val) {
        this._emptyAccessor = val;
    }
    private _emptyAccessor = '';

    /**
     * @example
     * component hostBinding
     *
     * @deprecated This hostbinding is deprecated
     */
    emptyHostBinding: string;

    /**
     * @deprecated This hostlistener is deprecated
     */
    onMouseup(): void {}

    /**
     * @param emptyParam component method param
     * @returns component method return
     */
    emptyMethod(emptyParam: string) {
        return emptyParam;
    }
}
