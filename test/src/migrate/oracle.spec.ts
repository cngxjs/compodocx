/**
 * Fidelity oracle: render the same input through the legacy Handlebars engine
 * AND through the converted JS module, then assert the outputs match.
 *
 * The legacy engine uses ad-hoc helper stubs that mirror the canonical compodoc
 * helpers — full registration would pull in the entire Configuration singleton.
 * Each headline conversion rule has its own oracle case below.
 */

import Handlebars from 'handlebars';
import { convertBody, wrapModule } from '../../../src/migrate/emit';

interface OracleHelpers {
    readonly t: (key: string) => string;
    readonly capitalize: (str: string) => string;
    readonly linkTypeHtml: (name: string, options: { depth: number }) => string;
    readonly relativeUrl: (depth: number, p?: string) => string;
    readonly parseDescription: (str: string) => string;
}

const oracleModernHelpers: OracleHelpers = {
    t: (key: string) => key.toUpperCase(),
    capitalize: (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : ''),
    linkTypeHtml: (name: string) => `<a class="link">${name}</a>`,
    relativeUrl: (depth: number, p = '') => '../'.repeat(depth) + p,
    parseDescription: (s: string) => `<p>${s ?? ''}</p>`
};

const renderConverted = (source: string, data: any): string => {
    const { body } = convertBody(source);
    const moduleSource = wrapModule(body);
    const factory = new Function('module', `${moduleSource}; return module.exports;`);
    const stubModule = { exports: () => '' as any };
    const fn = factory(stubModule);
    return fn(data, oracleModernHelpers);
};

const buildLegacyHandlebars = (): typeof Handlebars => {
    // Each oracle test gets a private Handlebars instance so helper bindings
    // can't leak across cases. `Handlebars.create()` returns a fresh runtime
    // with no helpers / partials registered.
    const hbs = Handlebars.create();

    // SafeString wraps HTML so Handlebars does not double-escape it, the way
    // the legacy compodoc helpers returned `new Handlebars.SafeString(...)`.
    const safe = (html: string) => new Handlebars.SafeString(html);
    hbs.registerHelper('t', (key: string) => oracleModernHelpers.t(key));
    hbs.registerHelper('capitalize', (s: string) => oracleModernHelpers.capitalize(s));
    hbs.registerHelper('linkType', (name: string) =>
        safe(oracleModernHelpers.linkTypeHtml(name, { depth: 1 }))
    );
    hbs.registerHelper('relativeURL', (depth: number) => oracleModernHelpers.relativeUrl(depth));
    hbs.registerHelper('parseDescription', (s: string) =>
        safe(oracleModernHelpers.parseDescription(s))
    );
    hbs.registerHelper('compare', function (this: any, a: any, op: string, b: any, options: any) {
        const ok =
            op === '==='
                ? a === b
                : op === '!=='
                  ? a !== b
                  : op === '>'
                    ? a > b
                    : op === '<'
                      ? a < b
                      : false;
        return ok ? options.fn(this) : options.inverse(this);
    });
    hbs.registerHelper('or', function (this: any, ...args: any[]) {
        const options = args[args.length - 1];
        const values = args.slice(0, -1);
        return values.some(Boolean) ? options.fn(this) : options.inverse(this);
    });
    return hbs;
};

const renderLegacy = (source: string, data: any): string => {
    const hbs = buildLegacyHandlebars();
    return hbs.compile(source)(data);
};

const stripWhitespace = (s: string): string => s.replaceAll(/\s+/g, ' ').trim();

const cases: ReadonlyArray<{
    label: string;
    source: string;
    data: any;
}> = [
    {
        label: 'plain identifier',
        source: '<h1>{{title}}</h1>',
        data: { title: 'Hello' }
    },
    {
        label: 'dotted access',
        source: '<p>{{user.profile.name}}</p>',
        data: { user: { profile: { name: 'Alice' } } }
    },
    {
        label: 'helper invocation (rename)',
        source: '<span>{{linkType returnType}}</span>',
        data: { returnType: 'Observable<User>' }
    },
    {
        label: '#if truthy',
        source: '{{#if deprecated}}<s>{{message}}</s>{{/if}}',
        data: { deprecated: true, message: 'gone' }
    },
    {
        label: '#if falsy',
        source: '{{#if deprecated}}<s>{{message}}</s>{{else}}<i>active</i>{{/if}}',
        data: { deprecated: false, message: 'gone' }
    },
    {
        label: '#each iteration',
        source: '<ul>{{#each items}}<li>{{name}}</li>{{/each}}</ul>',
        data: { items: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] }
    },
    {
        label: '#each with parent context',
        source: '{{#each items}}<li>{{../title}}: {{name}}</li>{{/each}}',
        data: { title: 'Section', items: [{ name: 'a' }, { name: 'b' }] }
    },
    {
        label: '#compare block',
        source: '{{#compare a "===" b}}<eq/>{{else}}<ne/>{{/compare}}',
        data: { a: 1, b: 1 }
    },
    {
        label: 'helper with string literal arg',
        source: '<i>{{t "info"}}</i>',
        data: {}
    }
];

describe('migrate/oracle — converted JS matches legacy Handlebars output', () => {
    for (const c of cases) {
        it(c.label, () => {
            const legacy = renderLegacy(c.source, c.data);
            const converted = renderConverted(c.source, c.data);
            expect(stripWhitespace(converted)).toBe(stripWhitespace(legacy));
        });
    }
});
