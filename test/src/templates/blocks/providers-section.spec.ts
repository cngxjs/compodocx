import { describe, expect, it } from 'vitest';
import { ProvidersSection } from '../../../../src/templates/blocks/ProvidersSection';

const render = (entries: any[]) => ProvidersSection({ title: 'Providers', entries });

describe('providers section', () => {
    it('renders an unknown provider call as code, callee and feature calls, without a strategy label', () => {
        const html = render([
            {
                name: 'provideUnknownFoo(withUnknownMode())',
                kind: 'class',
                call: { callee: 'provideUnknownFoo', args: ['withUnknownMode'] }
            }
        ]);
        expect(html).toContain('<code>provideUnknownFoo</code>(<code>withUnknownMode</code>(…))');
        expect(html).not.toContain('useClass');
    });

    it('renders a call without feature calls with empty parentheses', () => {
        const html = render([
            {
                name: 'provideUnknownLimit()',
                kind: 'class',
                call: { callee: 'provideUnknownLimit', args: [] }
            }
        ]);
        expect(html).toContain('<code>provideUnknownLimit</code>()</dt>');
    });

    it('keeps the strategy label of a class provider', () => {
        const html = render([{ name: 'UnknownService', kind: 'class' }]);
        expect(html).toContain('UnknownService');
        expect(html).toContain('<span class="cdx-provider-strategy">useClass</span>');
    });
});
