import { describe, expect, it } from 'vitest';
import { jsdocTagsReplacer, toExportJsdocTag } from '../../../../src/app/engines/export-jsdoc-tags';

const NODE_FIELDS = {
    pos: 10,
    end: 42,
    kind: 345,
    id: 7,
    flags: 0,
    modifierFlagsCache: 0,
    transformFlags: 0
};

describe('toExportJsdocTag', () => {
    it('writes a tagName node with only escapedText as { text }', () => {
        const tag = { tagName: { ...NODE_FIELDS, escapedText: 'returns' }, comment: 'The sum' };
        expect(toExportJsdocTag(tag)).toEqual({ tagName: { text: 'returns' }, comment: 'The sum' });
    });

    it('writes an identifier node name as a string', () => {
        const tag = {
            tagName: { text: 'param' },
            name: { ...NODE_FIELDS, escapedText: 'value' },
            comment: 'Input'
        };
        expect(toExportJsdocTag(tag).name).toBe('value');
    });

    it('keeps a string name', () => {
        const tag = { tagName: { text: 'param' }, name: 'count', type: 'number' };
        expect(toExportJsdocTag(tag)).toEqual({
            tagName: { text: 'param' },
            name: 'count',
            type: 'number'
        });
    });

    it('drops node fields at the top and inside tagName', () => {
        const tag = {
            ...NODE_FIELDS,
            tagName: { ...NODE_FIELDS, text: 'example', escapedText: 'example' },
            comment: 'x'
        };
        const out = toExportJsdocTag(tag);
        expect(out).toEqual({ tagName: { text: 'example' }, comment: 'x' });
    });

    it('drops unknown fields and non-string comments', () => {
        const tag = {
            tagName: { text: 'see' },
            parent: { kind: 1 },
            comment: [{ kind: 1, text: 'node array' }],
            somethingElse: true
        };
        expect(toExportJsdocTag(tag)).toEqual({ tagName: { text: 'see' } });
    });

    it('keeps and maps the function argument list', () => {
        const tag = {
            name: 'handler',
            type: 'function',
            optional: false,
            dotDotDotToken: false,
            deprecated: false,
            deprecationMessage: '',
            function: [
                {
                    name: { ...NODE_FIELDS, escapedText: 'data' },
                    type: 'TEvents',
                    optional: false,
                    dotDotDotToken: false,
                    deprecated: false,
                    deprecationMessage: '',
                    pos: 3
                }
            ],
            tagName: { text: 'param' }
        };
        expect(toExportJsdocTag(tag)).toEqual({
            tagName: { text: 'param' },
            name: 'handler',
            type: 'function',
            optional: false,
            deprecated: false,
            deprecationMessage: '',
            dotDotDotToken: false,
            function: [
                {
                    name: 'data',
                    type: 'TEvents',
                    optional: false,
                    dotDotDotToken: false,
                    deprecated: false,
                    deprecationMessage: ''
                }
            ]
        });
    });
});

describe('jsdocTagsReplacer', () => {
    it('maps jsdoctags at any depth and leaves the input unchanged', () => {
        const input = {
            name: 'Root',
            jsdoctags: [{ ...NODE_FIELDS, tagName: { escapedText: 'internal' } }],
            methodsClass: [
                {
                    name: 'run',
                    kind: 174,
                    jsdoctags: [{ tagName: { text: 'param' }, name: { escapedText: 'x' } }]
                }
            ]
        };
        const before = structuredClone(input);
        const out = JSON.parse(JSON.stringify(input, jsdocTagsReplacer));
        expect(out).toEqual({
            name: 'Root',
            jsdoctags: [{ tagName: { text: 'internal' } }],
            methodsClass: [
                {
                    name: 'run',
                    kind: 174,
                    jsdoctags: [{ tagName: { text: 'param' }, name: 'x' }]
                }
            ]
        });
        expect(input).toEqual(before);
    });
});
