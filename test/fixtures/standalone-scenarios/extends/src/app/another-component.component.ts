import { Component, OnInit, input, output } from '@angular/core';

/**
 * The main component
 */
@Component({
    selector: 'app-yo',
    template: 'YO'
})
export class AnotherComponent implements OnInit {
    public itisme = input<string>();

    public myoutput = output();

    public myprop;

    ngOnInit() {}
}
