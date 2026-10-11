import {
    MetadataHostDirectivesRow,
    MetadataHostRow,
    MetadataProvidersRow
} from '../../../../src/templates/blocks/MetadataRow';

/**
 * Unit tests for the three structured metadata row renderers that share the
 * `cdx-host-dir-*` token grammar: host directives, host literal, providers.
 *
 * These tests run against the fallback "no link" path of `resolveType`
 * because the `DependenciesEngine` singleton is empty in isolation. The
 * end-to-end rendered-link path is covered by the fixture regeneration.
 */
describe('MetadataRow — structured renderers', () => {
    describe('MetadataHostDirectivesRow', () => {
        it('returns an empty string for an empty array', () => {
            expect(MetadataHostDirectivesRow([], 1)).to.equal('');
        });

        it('renders a directive with inputs and outputs', () => {
            const html = MetadataHostDirectivesRow(
                [{ name: 'HighlightDirective', inputs: ['color', 'hoverColor'], outputs: [] }],
                1
            );

            expect(html).to.include('cdx-host-dir-flat');
            expect(html).to.include('cdx-host-dir-entry');
            expect(html).to.include('HighlightDirective');
            expect(html).to.include('cdx-host-dir-label');
            expect(html).to.include('>color<');
            expect(html).to.include('>hoverColor<');
            // Empty outputs array should not render
            expect(html).to.not.include('>outputs<');
        });

        it('renders a bare directive without inputs or outputs', () => {
            const html = MetadataHostDirectivesRow(
                [{ name: 'TooltipDirective', inputs: [], outputs: [] }],
                1
            );

            expect(html).to.include('TooltipDirective');
            expect(html).to.not.include('>inputs:<');
            expect(html).to.not.include('>outputs:<');
        });

        it('preserves order across multiple directives', () => {
            const html = MetadataHostDirectivesRow(
                [
                    { name: 'First', inputs: [], outputs: [] },
                    { name: 'Second', inputs: [], outputs: [] }
                ],
                1
            );

            expect(html.indexOf('First')).to.be.lessThan(html.indexOf('Second'));
        });
    });

    describe('MetadataHostRow', () => {
        it('returns an empty string for an empty array', () => {
            expect(MetadataHostRow([])).to.equal('');
        });

        it('renders all entries wrapped in a single host-dir-object block', () => {
            const html = MetadataHostRow([
                { key: 'class', kind: 'static', value: 'my-class' },
                { key: 'role', kind: 'static', value: 'region' }
            ]);

            expect(html).to.include('cdx-host-dir-list');
            const blockCount = (html.match(/cdx-host-dir-object/g) || []).length;
            expect(blockCount).to.equal(1);
            expect(html).to.include('>class<');
            expect(html).to.include('>role<');
            expect(html).to.include('>my-class<');
            expect(html).to.include('>region<');
        });

        it('uses cdx-host-dir-key for all key kinds (static, binding, event)', () => {
            const html = MetadataHostRow([
                { key: 'class', kind: 'static', value: 'x' },
                {
                    key: '[attr.aria-label]',
                    kind: 'attr-binding',
                    value: '"A"',
                    target: 'aria-label'
                },
                {
                    key: '(click)',
                    kind: 'event',
                    value: 'onClick()',
                    target: 'click'
                }
            ]);

            // Every key — including event keys — must render as cdx-host-dir-key.
            // Event keys must NOT use cdx-host-dir-name (which would make them
            // visually indistinguishable from clickable links).
            expect(html).to.include('cdx-host-dir-key">class<');
            expect(html).to.include('cdx-host-dir-key">[attr.aria-label]<');
            expect(html).to.include('cdx-host-dir-key">(click)<');
            expect(html).to.not.include('cdx-host-dir-name">(click)<');
        });

        it('renders static attribute values as plain tokens (no anchor)', () => {
            const html = MetadataHostRow([{ key: 'role', kind: 'static', value: 'region' }]);

            // Static values must never be linked, even if they happen to look
            // like an identifier — they are content, not code symbols.
            expect(html).to.include('cdx-host-dir-token">region<');
            expect(html).to.not.include('href="#region"');
        });

        it('links a binding value identifier to its member card anchor', () => {
            const html = MetadataHostRow([
                {
                    key: '[class.is-dirty]',
                    kind: 'class-binding',
                    value: 'dirty()',
                    target: 'is-dirty'
                }
            ]);

            expect(html).to.include('href="#dirty"');
            expect(html).to.include('>dirty</a>');
            // The parens stay outside the anchor as plain text.
            expect(html).to.include('</a>()');
        });

        it('links an event listener identifier to its member card anchor', () => {
            const html = MetadataHostRow([
                {
                    key: '(document:keydown.escape)',
                    kind: 'event',
                    value: 'onEscape($event)',
                    target: 'document:keydown.escape'
                }
            ]);

            expect(html).to.include('href="#onEscape"');
            expect(html).to.include('>onEscape</a>');
            expect(html).to.include('($event)');
        });

        it('preserves a this. prefix as plain text outside the anchor', () => {
            const html = MetadataHostRow([
                {
                    key: '(submit)',
                    kind: 'event',
                    value: 'this.save($event)',
                    target: 'submit'
                }
            ]);

            // The this. prefix is escaped and placed before the anchor.
            expect(html).to.match(/this\..*href="#save"/);
            expect(html).to.include('>save</a>');
        });

        it('falls back to plain token when a binding value does not match the identifier pattern', () => {
            const html = MetadataHostRow([
                {
                    key: '[attr.aria-label]',
                    kind: 'attr-binding',
                    value: '"Admin settings"',
                    target: 'aria-label'
                }
            ]);

            // A double-quoted string literal is not a method call. It must
            // render as a plain token, not an anchor. escapeHtml in
            // MetadataRow only escapes `& < >`, so quotes pass through
            // verbatim in the rendered token.
            expect(html).to.include('cdx-host-dir-token">"Admin settings"<');
            expect(html).to.not.include('href="#');
        });
    });

    describe('MetadataProvidersRow', () => {
        it('returns an empty string for an empty array', () => {
            expect(MetadataProvidersRow('providers', [], 1)).to.equal('');
        });

        it('renders a bare class provider as a single-token block', () => {
            const html = MetadataProvidersRow(
                'providers',
                [{ name: 'ApiService', kind: 'class' }],
                1
            );

            // Bare class providers render as one cdx-host-dir-object with
            // just the class name — no object braces, no provide: prefix.
            expect(html).to.include('cdx-host-dir-object');
            expect(html).to.include('ApiService');
            expect(html).to.not.include('>provide:<');
        });

        it('renders a useClass provider with provide and useClass lines', () => {
            const html = MetadataProvidersRow(
                'providers',
                [
                    {
                        name: 'ThemeService',
                        kind: 'useClass',
                        provide: 'ThemeService',
                        useClass: 'AdminThemeService'
                    }
                ],
                1
            );

            expect(html).to.include('>provide:<');
            expect(html).to.include('>useClass:<');
            expect(html).to.include('ThemeService');
            expect(html).to.include('AdminThemeService');
        });

        it('renders a useValue literal provider with the value as a plain token', () => {
            const html = MetadataProvidersRow(
                'providers',
                [
                    {
                        name: 'APP_VERSION',
                        kind: 'useValue',
                        provide: 'APP_VERSION',
                        useValue: "'2.0.0'",
                        valueKind: 'literal'
                    }
                ],
                1
            );

            expect(html).to.include('>useValue:<');
            expect(html).to.include('cdx-host-dir-token">');
            expect(html).to.include('2.0.0');
        });

        it('renders a useValue identifier provider with the value as a name', () => {
            const html = MetadataProvidersRow(
                'providers',
                [
                    {
                        name: 'CONFIG',
                        kind: 'useValue',
                        provide: 'CONFIG',
                        useValue: 'DEFAULT_CONFIG',
                        valueKind: 'identifier'
                    }
                ],
                1
            );

            // Identifier values should use cdx-host-dir-name (linkable token)
            // rather than the plain cdx-host-dir-token used for literals.
            expect(html).to.include('cdx-host-dir-name');
            expect(html).to.include('DEFAULT_CONFIG');
        });

        it('renders a useFactory provider with factory and deps lines', () => {
            const html = MetadataProvidersRow(
                'providers',
                [
                    {
                        name: 'FEATURE_FLAGS',
                        kind: 'useFactory',
                        provide: 'FEATURE_FLAGS',
                        factory: 'adminFeatureFlagsFactory',
                        deps: ['API_BASE_URL', 'AUTH_CONFIG']
                    }
                ],
                1
            );

            expect(html).to.include('>useFactory:<');
            expect(html).to.include('adminFeatureFlagsFactory');
            expect(html).to.include('>deps:<');
            expect(html).to.include('API_BASE_URL');
            expect(html).to.include('AUTH_CONFIG');
        });

        it('renders a useFactory provider without deps omitting the deps line', () => {
            const html = MetadataProvidersRow(
                'providers',
                [
                    {
                        name: 'FEATURE_FLAGS',
                        kind: 'useFactory',
                        provide: 'FEATURE_FLAGS',
                        factory: 'buildFlags'
                    }
                ],
                1
            );

            expect(html).to.include('buildFlags');
            expect(html).to.not.include('>deps:<');
        });

        it('renders a useExisting provider aliasing to another token', () => {
            const html = MetadataProvidersRow(
                'providers',
                [
                    {
                        name: 'AuditToken',
                        kind: 'useExisting',
                        provide: 'AuditToken',
                        useExisting: 'ADMIN_AUDIT_CHANNEL'
                    }
                ],
                1
            );

            expect(html).to.include('>useExisting:<');
            expect(html).to.include('ADMIN_AUDIT_CHANNEL');
        });

        it('renders a multi: true flag on a useValue provider', () => {
            const html = MetadataProvidersRow(
                'providers',
                [
                    {
                        name: 'MAX_RETRIES',
                        kind: 'useValue',
                        provide: 'MAX_RETRIES',
                        useValue: '5',
                        valueKind: 'literal',
                        multi: true
                    }
                ],
                1
            );

            expect(html).to.include('>multi:<');
            expect(html).to.include('true');
        });

        it('renders a string-literal provide target verbatim without a link', () => {
            const html = MetadataProvidersRow(
                'providers',
                [
                    {
                        name: "'AuditToken'",
                        kind: 'useExisting',
                        provide: "'AuditToken'",
                        useExisting: 'ADMIN_AUDIT_CHANNEL'
                    }
                ],
                1
            );

            // String-literal names keep their surrounding quotes and render
            // as a plain token, not as a linkable cdx-host-dir-name anchor.
            // escapeHtml only escapes `& < >`, so single quotes pass
            // through verbatim.
            expect(html).to.include(`cdx-host-dir-token">'AuditToken'<`);
        });

        it('preserves source order across a mixed provider list', () => {
            const html = MetadataProvidersRow(
                'providers',
                [
                    { name: 'First', kind: 'class' },
                    {
                        name: 'Second',
                        kind: 'useClass',
                        provide: 'Second',
                        useClass: 'SecondImpl'
                    },
                    { name: 'Third', kind: 'class' }
                ],
                1
            );

            const firstIdx = html.indexOf('First');
            const secondIdx = html.indexOf('Second');
            const thirdIdx = html.indexOf('Third');
            expect(firstIdx).to.be.lessThan(secondIdx);
            expect(secondIdx).to.be.lessThan(thirdIdx);
        });

        it('accepts the viewProviders label and renders it through MetadataRow', () => {
            const html = MetadataProvidersRow(
                'viewProviders',
                [{ name: 'TodoStore', kind: 'class' }],
                1
            );

            // humanLabel(viewProviders) → "View providers"
            expect(html).to.include('View providers');
            expect(html).to.include('TodoStore');
        });
    });
});
