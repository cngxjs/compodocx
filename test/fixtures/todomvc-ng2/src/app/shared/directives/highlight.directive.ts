import { Directive, ElementRef, inject, input } from '@angular/core';

@Directive({
    selector: '[appHighlight]',
    host: {
        '(mouseenter)': 'onMouseEnter()',
        '(mouseleave)': 'onMouseLeave()'
    }
})
export class HighlightDirective {
    color = input('yellow');

    private el = inject(ElementRef);

    onMouseEnter() {
        this.highlight(this.color());
    }

    onMouseLeave() {
        this.highlight('');
    }

    private highlight(color: string) {
        this.el.nativeElement.style.backgroundColor = color;
    }
}
