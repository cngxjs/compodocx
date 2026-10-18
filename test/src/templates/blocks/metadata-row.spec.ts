import { MetadataHostDirectivesRow } from '../../../../src/templates/blocks/MetadataRow';

/**
 * Unit tests for the host directives metadata row renderer.
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
});
