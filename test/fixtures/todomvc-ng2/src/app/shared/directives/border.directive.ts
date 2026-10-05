import { Directive, ElementRef, inject, input, OnInit } from '@angular/core';

@Directive({
    selector: '[appBorder]',
    host: {
        '(mouseenter)': 'onMouseEnter()',
        '(mouseleave)': 'onMouseLeave()'
    }
})
export class BorderDirective implements OnInit {
    color = input<string>('red');

    private el = inject(ElementRef);

    ngOnInit() {
        this.border('');
    }

    onMouseEnter() {
        this.border(this.color());
    }

    onMouseLeave() {
        this.border('');
    }

    private border(color: string) {
        this.el.nativeElement.style.border = `2px solid ${color || 'transparent'}`;
    }
}
