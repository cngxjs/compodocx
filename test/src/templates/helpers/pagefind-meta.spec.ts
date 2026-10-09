import { describe, expect, it } from 'vitest';
import {
    deriveLibFromBucket,
    firstSentence,
    KIND_LABELS,
    pagefindFilterBlock,
    pagefindMetaBlock
} from '../../../../src/templates/helpers/pagefind-meta';

describe('firstSentence', () => {
    it('returns undefined for empty / nullish / non-string input', () => {
        expect(firstSentence(undefined)).toBeUndefined();
        expect(firstSentence(null)).toBeUndefined();
        expect(firstSentence('')).toBeUndefined();
        expect(firstSentence(42)).toBeUndefined();
    });

    it('returns undefined when input is whitespace-only after HTML strip', () => {
        expect(firstSentence('   ')).toBeUndefined();
        expect(firstSentence('<p>  </p>')).toBeUndefined();
        expect(firstSentence('<br/><br/>')).toBeUndefined();
    });

    it('strips HTML tags from rendered descriptions', () => {
        expect(firstSentence('<p>Hello <strong>world</strong>.</p>')).toBe('Hello world');
        expect(firstSentence('<code>Foo</code> bar baz')).toBe('Foo bar baz');
    });

    it('returns the first sentence when terminated by `.`, `!`, or `?`', () => {
        expect(firstSentence('First. Second.')).toBe('First');
        expect(firstSentence('Hey! World.')).toBe('Hey');
        expect(firstSentence('What? Then.')).toBe('What');
    });

    it('returns the entire stripped string when no sentence terminator exists', () => {
        expect(firstSentence('A clause with no terminator')).toBe('A clause with no terminator');
    });

    it('truncates over-long sentences at ~120 chars with ellipsis', () => {
        const long = `${'word '.repeat(40).trim()}.`;
        const result = firstSentence(long) as string;
        expect(result.length).toBeLessThanOrEqual(120);
        expect(result.endsWith('...')).toBe(true);
    });

    it('collapses whitespace runs and ignores tag boundaries', () => {
        expect(firstSentence('<p>Line\n  one.</p>\n<p>Line two.</p>')).toBe('Line one');
    });
});

describe('KIND_LABELS', () => {
    it('maps every EntityKind to a user-facing string', () => {
        expect(KIND_LABELS.component).toBe('Component');
        expect(KIND_LABELS.directive).toBe('Directive');
        expect(KIND_LABELS.pipe).toBe('Pipe');
        expect(KIND_LABELS.injectable).toBe('Injectable');
        expect(KIND_LABELS.class).toBe('Class');
        expect(KIND_LABELS.interface).toBe('Interface');
        expect(KIND_LABELS.guard).toBe('Guard');
        expect(KIND_LABELS.interceptor).toBe('Interceptor');
        expect(KIND_LABELS.entity).toBe('Entity');
        expect(KIND_LABELS.function).toBe('Function');
        expect(KIND_LABELS.variable).toBe('Variable');
        expect(KIND_LABELS.typealias).toBe('Type Alias');
        expect(KIND_LABELS.enumeration).toBe('Enumeration');
    });
});

describe('pagefindMetaBlock', () => {
    it('returns an empty string when no fields are set', () => {
        expect(pagefindMetaBlock({})).toBe('');
    });

    it('omits the kind span when kind is unknown', () => {
        const out = pagefindMetaBlock({ kind: 'mystery' as any });
        expect(out).not.toContain('data-pagefind-meta="kind:');
    });

    it('emits the kind label in literal `key:value` form for a valid EntityKind', () => {
        expect(pagefindMetaBlock({ kind: 'component' })).toBe(
            '<span hidden data-pagefind-meta="kind:Component"></span>'
        );
    });

    it('emits typealias label with space ("Type Alias") attribute-safe', () => {
        const out = pagefindMetaBlock({ kind: 'typealias' });
        expect(out).toContain('data-pagefind-meta="kind:Type Alias"');
    });

    it('omits category span when empty or whitespace-only', () => {
        expect(pagefindMetaBlock({ kind: 'component', category: '' })).toBe(
            '<span hidden data-pagefind-meta="kind:Component"></span>'
        );
        expect(pagefindMetaBlock({ kind: 'component', category: '   ' })).toBe(
            '<span hidden data-pagefind-meta="kind:Component"></span>'
        );
    });

    it('emits a trimmed category in literal `key:value` form when set', () => {
        expect(
            pagefindMetaBlock({
                kind: 'component',
                category: '  ui/feedback/toast  '
            })
        ).toBe(
            '<span hidden data-pagefind-meta="kind:Component"></span>' +
                '<span hidden data-pagefind-meta="category:ui/feedback/toast"></span>'
        );
    });

    it('omits the description span when stripped content is empty', () => {
        expect(pagefindMetaBlock({ kind: 'component', description: '<p>  </p>' })).toBe(
            '<span hidden data-pagefind-meta="kind:Component"></span>'
        );
    });

    it('emits description via inner-text form so commas / colons survive', () => {
        expect(
            pagefindMetaBlock({
                kind: 'interface',
                description: '<p>Options, including: timeout. More details.</p>'
            })
        ).toBe(
            '<span hidden data-pagefind-meta="kind:Interface"></span>' +
                '<span hidden data-pagefind-meta="description">Options, including: timeout</span>'
        );
    });

    it('escapes HTML special chars in description inner text', () => {
        // `firstSentence` strips tags then collapses whitespace runs, so
        // `<b>bar</b>` reduces to ` bar ` → `bar` after collapse + trim.
        // Inner-text escaping handles the `&` and angle brackets; quotes
        // need no escaping inside element text content.
        expect(
            pagefindMetaBlock({
                kind: 'class',
                description: 'Foo <b>bar</b> & "baz"'
            })
        ).toContain('<span hidden data-pagefind-meta="description">Foo bar &amp; "baz"</span>');
    });

    it('escapes attribute quotes in kind / category values', () => {
        expect(pagefindMetaBlock({ kind: 'component', category: 'a"b' })).toContain(
            'data-pagefind-meta="category:a&quot;b"'
        );
    });

    it('emits all three spans in stable order when every field is populated', () => {
        expect(
            pagefindMetaBlock({
                kind: 'component',
                category: 'ui/feedback/toast',
                description: '<p>Toast component.</p>'
            })
        ).toBe(
            '<span hidden data-pagefind-meta="kind:Component"></span>' +
                '<span hidden data-pagefind-meta="category:ui/feedback/toast"></span>' +
                '<span hidden data-pagefind-meta="description">Toast component</span>'
        );
    });
});

describe('deriveLibFromBucket', () => {
    it('returns undefined for empty / whitespace / nullish inputs', () => {
        expect(deriveLibFromBucket(undefined)).toBeUndefined();
        expect(deriveLibFromBucket('')).toBeUndefined();
        expect(deriveLibFromBucket('   ')).toBeUndefined();
    });

    it('returns the first segment of a nested bucket path', () => {
        expect(deriveLibFromBucket('ui/feedback/toast')).toBe('ui');
        expect(deriveLibFromBucket('common/data/async-state')).toBe('common');
    });

    it('returns the single segment when bucket has no nesting', () => {
        expect(deriveLibFromBucket('Providers')).toBe('Providers');
    });

    it('handles Windows-style separators by normalising to forward slash', () => {
        expect(deriveLibFromBucket('ui\\feedback\\toast')).toBe('ui');
    });
});

describe('pagefindFilterBlock', () => {
    it('returns an empty string when no inputs are provided', () => {
        expect(pagefindFilterBlock({})).toBe('');
    });

    it('emits the canonical `dim:value` form for kind so Pagefind 1.x registers it', () => {
        expect(pagefindFilterBlock({ kind: 'component' })).toBe(
            '<span hidden data-pagefind-filter="kind:Component"></span>'
        );
    });

    it('passes through non-EntityKind labels (Module, Provider) verbatim', () => {
        expect(pagefindFilterBlock({ kind: 'Provider' })).toContain(
            'data-pagefind-filter="kind:Provider"'
        );
        expect(pagefindFilterBlock({ kind: 'Module' })).toContain(
            'data-pagefind-filter="kind:Module"'
        );
    });

    it('omits whitespace-only lib / feature dimensions', () => {
        const out = pagefindFilterBlock({ kind: 'pipe', lib: '   ', feature: '' });
        expect(out).not.toContain('lib:');
        expect(out).not.toContain('feature:');
        expect(out).toContain('kind:Pipe');
    });

    it('emits the feature and the entry point as facet dimensions', () => {
        const out = pagefindFilterBlock({ feature: 'select', entryPoint: '@x/forms/select' });
        expect(out).toBe(
            '<span hidden data-pagefind-filter="feature:select"></span>' +
                '<span hidden data-pagefind-filter="entryPoint:@x/forms/select"></span>'
        );
        expect(out).not.toContain('tier:');
    });

    it('escapes attribute-significant characters in values', () => {
        const out = pagefindFilterBlock({ lib: 'a"b' });
        expect(out).toContain('data-pagefind-filter="lib:a&quot;b"');
    });

    it('emits one span per dimension when every field is populated', () => {
        const out = pagefindFilterBlock({
            kind: 'interface',
            lib: 'ui',
            feature: 'toast',
            entryPoint: '@x/ui/feedback',
            wcag: 'AA'
        });
        expect(out).toBe(
            '<span hidden data-pagefind-filter="kind:Interface"></span>' +
                '<span hidden data-pagefind-filter="lib:ui"></span>' +
                '<span hidden data-pagefind-filter="feature:toast"></span>' +
                '<span hidden data-pagefind-filter="entryPoint:@x/ui/feedback"></span>' +
                '<span hidden data-pagefind-filter="wcag:AA"></span>'
        );
    });

    it('does NOT emit the per-suffix attribute variants (Pagefind 1.x ignores them)', () => {
        const out = pagefindFilterBlock({
            kind: 'interface',
            lib: 'ui',
            feature: 'toast',
            entryPoint: '@x/ui/feedback',
            wcag: 'AA'
        });
        expect(out).not.toContain('data-pagefind-filter-kind=');
        expect(out).not.toContain('data-pagefind-filter-lib=');
        expect(out).not.toContain('data-pagefind-filter-feature=');
        expect(out).not.toContain('data-pagefind-filter-entryPoint=');
        expect(out).not.toContain('data-pagefind-filter-wcag=');
    });
});

describe('feature type pages in search', () => {
    it('marks a feature type page with the cluster kind and the Provider filter', () => {
        expect(pagefindMetaBlock({ kind: 'cluster' })).toBe(
            '<span hidden data-pagefind-meta="kind:Cluster"></span>'
        );
        expect(pagefindFilterBlock({ kind: 'Provider' })).toContain(
            'data-pagefind-filter="kind:Provider"'
        );
    });
});
