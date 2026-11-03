import { hasStderrError, read, shell, temporaryDir } from '../helpers';
import { pagesIn } from '../helpers/pages';

const tmp = temporaryDir();
const FIXTURE = './test/fixtures/ai-generated';

/** The README panel of a rendered page, up to the next panel. */
const readmePanel = (html: string): string => {
    const start = html.indexOf('id="readme"');
    expect(start).to.be.greaterThan(-1);
    const next = html.indexOf('class="cdx-tab-panel', start);
    return html.slice(start, next === -1 ? undefined : next);
};

/**
 * `<!-- @aiGenerated [value] -->` as the first line of a neighbour README
 * (`marked-card.component.md`, `marked-store.service.md`) shows the banner
 * in the README tab; `plain-card.component.md` has no marker.
 */
describe('CLI @aiGenerated in the neighbour README', () => {
    const distFolder = `${tmp.name}-ai-readme`;
    const pages = pagesIn(distFolder);
    let markedCard: string;
    let plainCard: string;
    let markedStore: string;

    beforeAll(() => {
        tmp.create(distFolder);
        const ls = shell('node', [
            './bin/index-cli.js',
            '--no-multiVersion',
            '--disableSearch',
            '-p',
            `${FIXTURE}/tsconfig.json`,
            '-d',
            distFolder
        ]);
        if (hasStderrError(ls.stderr.toString())) {
            console.error(`shell error: ${ls.stderr.toString()}`);
            throw new Error('error');
        }
        markedCard = read(`${distFolder}/${pages.of('component', 'MarkedCardComponent')}`);
        plainCard = read(`${distFolder}/${pages.of('component', 'PlainCardComponent')}`);
        markedStore = read(`${distFolder}/${pages.of('injectable', 'MarkedStore')}`);
    });
    afterAll(() => tmp.clean(distFolder));

    it('shows the banner with the value in the README tab of a component', () => {
        const panel = readmePanel(markedCard);
        expect(panel).to.contain('cdx-ai-generated-banner');
        expect(panel).to.contain(
            '<p class="cdx-ai-generated-note">Drafted with AI assistance (2026-11).</p>'
        );
    });

    it('shows the banner in the README tab of an injectable', () => {
        const panel = readmePanel(markedStore);
        expect(panel).to.contain('cdx-ai-generated-banner');
        expect(panel).to.contain(
            '<p class="cdx-ai-generated-note">Drafted with AI assistance.</p>'
        );
    });

    it('renders no banner for a README without the marker', () => {
        expect(readmePanel(plainCard)).to.contain('Usage notes written for the plain card.');
        expect(plainCard).not.to.contain('cdx-ai-generated-banner');
    });

    it('keeps the hero free of the chip when only the README is marked', () => {
        const hero = markedCard.slice(0, markedCard.indexOf('cdx-tab-bar'));
        expect(hero).not.to.contain('cdx-badge--ai-generated');
    });
});
