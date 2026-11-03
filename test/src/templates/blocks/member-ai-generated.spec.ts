import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
    clearCustomTemplates,
    registerCustomTemplate
} from '../../../../src/app/engines/custom-template.engine';
import I18nEngine from '../../../../src/app/engines/i18n.engine';
import { BlockAccessors } from '../../../../src/templates/blocks/BlockAccessors';
import { BlockInput } from '../../../../src/templates/blocks/BlockInput';
import { BlockMethod } from '../../../../src/templates/blocks/BlockMethod';
import { BlockOutput } from '../../../../src/templates/blocks/BlockOutput';
import { BlockProperty } from '../../../../src/templates/blocks/BlockProperty';

beforeAll(() => {
    I18nEngine.init('en-US');
});

const CHIP = 'cdx-badge--ai-generated';
const NOTE = '<p class="cdx-member-ai-note"';

/** Each member block, rendering one member with the given extra fields. */
const blocks: Record<string, (extra: Record<string, unknown>) => string> = {
    method: extra => BlockMethod({ depth: 1, file: 'f.ts', methods: [{ name: 'run', ...extra }] }),
    property: extra =>
        BlockProperty({ depth: 1, file: 'f.ts', properties: [{ name: 'size', ...extra }] }),
    input: extra =>
        BlockInput({
            depth: 1,
            file: 'f.ts',
            element: { file: 'f.ts', inputsClass: [{ name: 'label', type: 'string', ...extra }] }
        }),
    output: extra =>
        BlockOutput({
            depth: 1,
            file: 'f.ts',
            element: { file: 'f.ts', outputsClass: [{ name: 'changed', ...extra }] }
        }),
    accessor: extra =>
        BlockAccessors({
            depth: 1,
            file: 'f.ts',
            accessors: { value: { getSignature: { returnType: 'number', ...extra } } }
        })
};

describe('member @aiGenerated chip and note', () => {
    afterEach(() => {
        clearCustomTemplates();
    });

    for (const [kind, render] of Object.entries(blocks)) {
        it(`shows chip and note on a marked ${kind}`, () => {
            const html = render({ aiGenerated: 'claude-opus-4.7' });
            expect(html).toContain(CHIP);
            expect(html).toContain(NOTE);
            expect(html).toContain('Drafted with AI assistance (claude-opus-4.7).');
        });

        it(`shows nothing on an unmarked ${kind}`, () => {
            const html = render({});
            expect(html).not.toContain(CHIP);
            expect(html).not.toContain(NOTE);
        });
    }

    it('puts the chip into the badge row of the member head', () => {
        const html = blocks.method({ aiGenerated: true });
        const badges = html.slice(html.indexOf('cdx-io-member-badges'));
        expect(badges.indexOf(CHIP)).toBeGreaterThan(-1);
        expect(badges.indexOf(CHIP)).toBeLessThan(badges.indexOf(NOTE));
    });

    it('passes the marker to a block-method override', () => {
        registerCustomTemplate(
            'block-method',
            (data: any) => `<i>${data.methods.map((m: any) => m.aiGenerated).join(',')}</i>`
        );
        expect(blocks.method({ aiGenerated: '2026-05' })).toBe('<i>2026-05</i>');
    });
});
