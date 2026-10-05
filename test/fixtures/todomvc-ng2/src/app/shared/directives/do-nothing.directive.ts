import { Directive, input, output } from '@angular/core';

import { DoNothingDirectiveSchema } from './do-nothing-directive.metadata';

/**
 * @example
 * empty directive
 */
@Directive(DoNothingDirectiveSchema)
export class DoNothingDirective {
    protected popover: string;

    /**
     * @example
     * directive property
     */
    emptyProperty = '';

    /**
     * @example
     * directive input
     */
    public emptyInput = input<string>();

    /**
     * @example
     * directive accessor
     */
    get emptyAccessor() {
        return this._emptyAccessor;
    }
    set emptyAccessor(val) {
        this._emptyAccessor = val;
    }
    private _emptyAccessor = '';

    /**
     * @example
     * directive output
     */
    public emptyOutput = output<string>();

    constructor() {
        console.log('Do nothing directive');
    }

    ngOnDestroy() {}

    /**
     * @param emptyParam directive method param
     * @returns directive method return
     */
    emptyMethod(emptyParam: string) {
        return emptyParam;
    }

    public submitTriggered() {}

    /**
     * HostBinding description
     * @example
     * directive hostBinding
     */
    color: string;

    /**
     * HostListener description 1
     * @example
     * directive hostListener
     */
    onMouseup(mouseX: number, mouseY: number): void {}
    /**
     * HostListener description 2
     */
    onMousedown(mouseX: number, mouseY: number): void {}
    /**
     * HostListener description 3
     */
    onClick(e: Event): void {}

    private _fullName: string;

    /**
     * Getter of _fullName
     * @return {string} _fullName value
     */
    get fullName(): string {
        return this._fullName;
    }

    /**
     * Setter of _fullName
     * @param  {string} newName The new name
     */
    set fullName(newName: string) {
        this._fullName = newName;
    }
}
