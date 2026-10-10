import { convertBody, escapeForTemplateLiteral, wrapModule } from '../../../src/migrate/emit';

const convert = (source: string) => convertBody(source, { file: 'fixture.hbs' });

describe('migrate/emit — content + literal interpolation', () => {
    it('passes through plain text as a literal segment', () => {
        const { body, warnings } = convert('<p>Hello world</p>');
        expect(body).toBe('<p>Hello world</p>');
        expect(warnings).toEqual([]);
    });

    it('escapes backticks and ${ in literal text', () => {
        expect(escapeForTemplateLiteral('a `b` c ${d}')).toBe('a \\`b\\` c \\${d}');
    });
});

describe('migrate/emit — mustache expressions', () => {
    it("emits ${data.x ?? ''} for top-level identifier", () => {
        const { body } = convert('{{name}}');
        expect(body).toBe("${data.name ?? ''}");
    });

    it('walks dotted access with optional chaining', () => {
        const { body } = convert('{{a.b.c}}');
        expect(body).toBe("${data.a?.b?.c ?? ''}");
    });

    it('preserves bracket-numeric access', () => {
        const { body } = convert('{{items.[0].name}}');
        expect(body).toBe("${data.items?.[0]?.name ?? ''}");
    });

    it('quotes bracket-string keys with spaces', () => {
        const { body } = convert('{{a.[key with space]}}');
        expect(body).toBe('${data.a?.["key with space"] ?? \'\'}');
    });

    it('treats triple-stash identical to double-stash (JS API never escapes)', () => {
        const { body: doubleBody } = convert('{{rawHtml}}');
        const { body: tripleBody } = convert('{{{rawHtml}}}');
        expect(doubleBody).toBe(tripleBody);
    });
});

describe('migrate/emit — helper calls', () => {
    it('renames legacy → modern helper for direct invocation', () => {
        const { body, warnings } = convert('{{capitalize returnType}}');
        expect(body).toBe('${helpers.capitalize(data.returnType)}');
        expect(warnings).toEqual([]);
    });

    it('passes the page depth to the type-link helpers', () => {
        const { body, warnings } = convert('{{linkType returnType}} {{functionSignature method}}');
        expect(body).toBe(
            '${helpers.linkTypeHtml(data.returnType, { depth: data.depth })} ${helpers.functionSignature(data.method, data.depth)}'
        );
        expect(warnings).toEqual([]);
    });

    it('threads positional args through unchanged', () => {
        const { body } = convert('{{relativeURL data.depth}}');
        expect(body).toBe('${helpers.relativeUrl(data.data?.depth)}');
    });

    it('passes hash arguments as a trailing object literal', () => {
        const { body } = convert('{{t "key" foo=bar}}');
        expect(body).toBe('${helpers.t("key", { foo: data.bar })}');
    });

    it('inlines `compare` to a JS comparison expression', () => {
        const { body, warnings } = convert('{{compare a "===" b}}');
        expect(body).toBe('${(data.a === data.b)}');
        expect(warnings).toEqual([]);
    });

    it('inlines `or` to a JS short-circuit expression', () => {
        const { body } = convert('{{or a b}}');
        expect(body).toBe('${(data.a || data.b)}');
    });

    it('emits a warning for an unknown helper', () => {
        const { body, warnings } = convert('{{nope foo}}');
        expect(body).toMatch(/TODO\(migrate\): unknown helper "nope"/);
        expect(warnings).toHaveLength(1);
        expect(warnings[0].kind).toBe('unknown-helper');
    });

    it('warns and emits empty string for `removed` helpers', () => {
        const { body, warnings } = convert('{{debug a b}}');
        expect(body).toBe("${''}");
        expect(warnings[0].kind).toBe('removed-construct');
    });

    it('warns yellow on `lossy-rename` helpers but still emits a real call', () => {
        const { body, warnings } = convert('{{breaklines text}}');
        expect(body).toBe('${helpers.parseDescription(data.text)}');
        expect(warnings[0].kind).toBe('lossy-rename');
    });
});

describe('migrate/emit — sub-expressions', () => {
    it('recursively emits (helper x y) without template interpolation', () => {
        const { body } = convert('{{linkType (capitalize name)}}');
        expect(body).toBe(
            '${helpers.linkTypeHtml(helpers.capitalize(data.name), { depth: data.depth })}'
        );
    });
});

describe('migrate/emit — block helpers', () => {
    it('emits #if as a ternary', () => {
        const { body } = convert('{{#if x}}<b>yes</b>{{/if}}');
        expect(body).toBe("${data.x ? `<b>yes</b>` : ''}");
    });

    it('emits #if/else with both branches', () => {
        const { body } = convert('{{#if x}}A{{else}}B{{/if}}');
        expect(body).toBe('${data.x ? `A` : `B`}');
    });

    it('emits #unless as a negated ternary', () => {
        const { body } = convert('{{#unless x}}A{{/unless}}');
        expect(body).toBe("${!(data.x) ? `A` : ''}");
    });

    it('emits #each as map().join()', () => {
        const { body } = convert('{{#each methods}}<li>{{name}}</li>{{/each}}');
        expect(body).toBe(
            "${(data.methods ?? []).map((item, __hbs_index) => `<li>${item.name ?? ''}</li>`).join('')}"
        );
    });

    it('preserves block params for #each as |item index|', () => {
        const { body } = convert(
            '{{#each items as |row idx|}}<tr>{{row.name}} {{idx}}</tr>{{/each}}'
        );
        expect(body).toContain('(row, idx) =>');
        expect(body).toContain('row.name');
    });

    it('walks parent context inside #each via ../', () => {
        const { body } = convert('{{#each methods}}<li>{{../title}}: {{name}}</li>{{/each}}');
        expect(body).toContain('data.title');
        expect(body).toContain('item.name');
    });

    it('emits #each/else as a length-aware ternary', () => {
        const { body } = convert('{{#each items}}<li>{{name}}</li>{{else}}<i>empty</i>{{/each}}');
        expect(body).toContain('? (data.items ?? []).map');
        expect(body).toContain(': `<i>empty</i>`');
    });

    it('emits #compare as a ternary on the inline expression', () => {
        const { body } = convert('{{#compare a "===" b}}<eq/>{{else}}<neq/>{{/compare}}');
        expect(body).toBe('${((data.a === data.b)) ? `<eq/>` : `<neq/>`}');
    });

    it('flags an unsupported block helper with a TODO and warning', () => {
        const { body, warnings } = convert('{{#nope}}A{{/nope}}');
        expect(body).toMatch(/TODO\(migrate\): unknown block helper "#nope"/);
        expect(warnings.find(w => w.kind === 'unsupported-block')).toBeDefined();
    });
});

describe('migrate/emit — partials', () => {
    it('warns and emits a TODO comment for sub-partials with no slot', () => {
        const { body, warnings } = convert('{{> custom-thing data}}');
        expect(body).toMatch(/TODO\(migrate\): partial "custom-thing"/);
        expect(warnings[0].kind).toBe('partial-no-target');
    });
});

describe('migrate/emit — comments', () => {
    it('strips Handlebars comments from the output', () => {
        const { body } = convert('{{!-- developer note --}}hello');
        expect(body).toBe('hello');
    });
});

describe('migrate/emit — wrapModule', () => {
    it('wraps a body in a CommonJS function export', () => {
        const wrapped = wrapModule("hello ${data.name ?? ''}");
        expect(wrapped).toContain('module.exports = function (data, helpers)');
        expect(wrapped).toContain("return `hello ${data.name ?? ''}`;");
    });

    it('prepends an optional header line', () => {
        const wrapped = wrapModule('x', '/* generated */');
        expect(wrapped.startsWith('/* generated */\n')).toBe(true);
    });
});
