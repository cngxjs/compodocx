export const DoNothingDirectiveSchema = {
    selector: '[donothing]',
    exportAs: 'donothing',
    standalone: true,
    hostDirectives: [BorderDirective],
    host: {
        '[style.color]': 'color',
        '(mouseup)': 'onMouseup($event.clientX, $event.clientY)',
        '(mousedown)': 'onMousedown($event.clientX, $event.clientY)',
        '(focus)': 'onClick($event)',
        '(click)': 'onClick($event)'
    }
};
