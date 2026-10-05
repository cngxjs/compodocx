import { Component, OnInit, input, output } from '@angular/core';

import { DoNothingDirective } from '../shared/directives/do-nothing.directive';
import { FirstUpperPipe } from '../shared/pipes/first-upper.pipe';

/**
 * The footer component
 */
@Component({
    selector: 'app-footer',
    imports: [DoNothingDirective, FirstUpperPipe],
    template: '<footer donothing>{{ shownProperty | firstUpper }}</footer>',
    host: {
        '[style.color]': 'color',
        '(mouseup)': 'onMouseup($event.clientX, $event.clientY)'
    }
})
export class FooterComponent implements OnInit {
    private _title = '';

    /**
     * A documented property
     */
    shownProperty = 'footer';

    /**
     * @ignore
     */
    ignoredProperty: string;

    /**
     * @ignore
     */
    ignoredInput = input<string>();

    /**
     * A documented input
     */
    shownInput = input<string>();

    /**
     * @ignore
     */
    ignoredOutput = output<string>();

    /**
     * @ignore
     */
    ignoredFunction() {}

    /**
     * @ignore
     */
    color: string;

    /**
     * @ignore
     */
    onMouseup(mouseX: number, mouseY: number): void {}

    /**
     * @ignore
     */
    get title() {
        return this._title;
    }
    /**
     * @ignore
     */
    set title(value: string) {
        this._title = value.trim();
    }

    ngOnInit() {}
}
