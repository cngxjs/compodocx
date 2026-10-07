import { extractManifestsFromHtml } from '../../../src/playground-validate/extract';
import { pageOf } from '../helpers/pages';

const scriptTag = (id: string, json: string): string =>
    `<script type="application/json" data-cdx-stackblitz-manifest-data="${id}">${json}</script>`;

describe('extractManifestsFromHtml', () => {
    it('pulls every manifest out of a page, keyed by id', () => {
        const html = [
            '<section>',
            scriptTag('pg-button-0', '{"title":"Default","files":{"src/main.ts":"a"}}'),
            scriptTag('pg-button-1', '{"title":"Toggle","files":{"src/main.ts":"b"}}'),
            '</section>'
        ].join('\n');
        const result = extractManifestsFromHtml(html, pageOf('component', 'Button'));
        expect(result.map(r => r.id)).to.deep.equal(['pg-button-0', 'pg-button-1']);
        expect(result[0].manifest.title).to.equal('Default');
        expect(result[0].sourceFile).to.equal(pageOf('component', 'Button'));
    });

    it('decodes the \\uXXXX escaping used for angle brackets in the payload', () => {
        // BlockPlayground escapes `<`/`>`/`&` as \uXXXX; JSON.parse decodes them.
        const json = '{"title":"T","files":{"src/app/app.component.ts":"\\u003cdiv\\u003e"}}';
        const result = extractManifestsFromHtml(scriptTag('pg-0', json));
        expect(result).to.have.length(1);
        expect(result[0].manifest.files['src/app/app.component.ts']).to.equal('<div>');
    });

    it('skips a malformed manifest without throwing', () => {
        const html =
            scriptTag('pg-0', '{not valid json') + scriptTag('pg-1', '{"title":"OK","files":{}}');
        const result = extractManifestsFromHtml(html);
        expect(result.map(r => r.id)).to.deep.equal(['pg-1']);
    });

    it('returns nothing for HTML without manifests', () => {
        expect(extractManifestsFromHtml('<html><body>no playgrounds</body></html>')).to.have.length(
            0
        );
        expect(extractManifestsFromHtml('')).to.have.length(0);
    });
});
