import { Component, input } from '@angular/core';

/** A chip with a themable surface. */
@Component({
    selector: 'tk-chip',
    template: '<span><ng-content /></span>',
    styleUrls: ['./tk-chip.css', './tk-chip.theme.css']
})
export class TkChip {
    /** Text shown inside the chip. */
    readonly label = input('');
}
