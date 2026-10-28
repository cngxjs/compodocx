import * as fs from 'node:fs';
import * as path from 'node:path';
import { hasStderrError, read, shell, temporaryDir } from '../helpers';
import { pagesIn } from '../helpers/pages';

const tmp = temporaryDir();
const FIXTURE = './test/fixtures/kitchen-sink-standalone';

/**
 * `@aiGenerated` markers show a visible sentence: on the additional page
 * marked `<!-- @aiGenerated 2026-05 -->` and on the hero of `SignalCardComponent`
 * (`@aiGenerated claude-opus-4.7`). `aiGeneratedNote` replaces the text.
 */
const generate = (distFolder: string, extra: string[] = []): void => {
    tmp.create(distFolder);
    const ls = shell('node', [
        './bin/index-cli.js',
        '--no-multiVersion',
        '--disableSearch',
        '-p',
        `${FIXTURE}/tsconfig.json`,
        '--includes',
        `${FIXTURE}/additional-doc`,
        '-d',
        distFolder,
        ...extra
    ]);
    if (hasStderrError(ls.stderr.toString())) {
        console.error(`shell error: ${ls.stderr.toString()}`);
        throw new Error('error');
    }
};

describe('CLI @aiGenerated note', () => {
    describe('default text', () => {
        const distFolder = `${tmp.name}-ai-note`;
        const pages = pagesIn(distFolder);
        let additionalPage: string;
        let componentPage: string;

        beforeAll(() => {
            generate(distFolder);
            additionalPage = read(`${distFolder}/additional-documentation/getting-started.html`);
            componentPage = read(`${distFolder}/${pages.of('component', 'SignalCardComponent')}`);
        });
        afterAll(() => tmp.clean(distFolder));

        it('shows chip and sentence with the marker value on the additional page', () => {
            expect(additionalPage).to.contain('cdx-ai-generated-banner');
            expect(additionalPage).to.contain('cdx-badge--ai-generated');
            expect(additionalPage).to.contain(
                '<p class="cdx-ai-generated-note">Drafted with AI assistance (2026-05).</p>'
            );
        });

        it('shows the sentence below the hero badges of a marked component', () => {
            expect(componentPage).to.contain(
                '<p class="cdx-entity-hero-ai-note">Drafted with AI assistance (claude-opus-4.7).</p>'
            );
        });

        it('keeps the marker value out of the chip tooltip', () => {
            expect(componentPage).to.contain(
                'title="This content was generated with AI assistance">'
            );
            expect(componentPage).not.to.contain(String.fromCodePoint(0x2014) + ' claude');
        });
    });

    describe('aiGeneratedNote', () => {
        const distFolder = `${tmp.name}-ai-note-config`;
        const configFolder = `${tmp.name}-ai-note-rc`;
        const pages = pagesIn(distFolder);
        let additionalPage: string;
        let componentPage: string;

        beforeAll(() => {
            tmp.create(configFolder);
            const config = path.join(configFolder, '.compodocxrc.json');
            fs.writeFileSync(
                config,
                JSON.stringify({
                    aiGeneratedNote: 'Drafted with AI assistance ({value}) and reviewed.'
                })
            );
            generate(distFolder, ['-c', config]);
            additionalPage = read(`${distFolder}/additional-documentation/getting-started.html`);
            componentPage = read(`${distFolder}/${pages.of('component', 'SignalCardComponent')}`);
        });
        afterAll(() => {
            tmp.clean(distFolder);
            tmp.clean(configFolder);
        });

        it('uses the configured text on additional pages and symbol pages', () => {
            expect(additionalPage).to.contain(
                '>Drafted with AI assistance (2026-05) and reviewed.</p>'
            );
            expect(componentPage).to.contain(
                '>Drafted with AI assistance (claude-opus-4.7) and reviewed.</p>'
            );
        });
    });
});
