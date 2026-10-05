import { Component, OnInit, input } from '@angular/core';
import { BarService } from './bar.service';

/**
 * BarComponent description
 *
 * see {@link http://www.google.fr}
 * see {@link http://www.google.fr|Second link}
 * see {@link http://www.google.uk Third link}
 * see [Last link]{@link http://www.google.jp}
 *
 * Watch [The BarComponent]{@link BarComponent}
 */
@Component({
    selector: 'app-bar',
    templateUrl: `bar.template.html`,
    styleUrls: ['bar.style.scss', 'bar2.style.scss'],
    providers: [BarService]
})
export class BarComponent implements OnInit {
    /**
     * foo method
     */
    normalMethod() {}

    /**
     * bar method
     * @internal
     */
    internalMethod() {}

    /**
     * @hidden
     */
    hiddenMethod() {}

    /**
     * @internal
     */
    internalInput = input<string>();

    /**
     * @private
     */
    privateCommentMethod() {}

    private privateMethod() {}

    protected varprotected: string;

    /**
     * @internal
     */
    public internalConstructorProp: string = '';

    ngOnInit() {}

    public showTab(index) {
        // TOTO
    }
}
