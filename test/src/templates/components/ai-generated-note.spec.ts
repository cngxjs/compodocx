import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import Configuration from '../../../../src/app/configuration';
import I18nEngine from '../../../../src/app/engines/i18n.engine';
import * as locales from '../../../../src/locales';
import {
    AiGeneratedBadge,
    AiGeneratedNote
} from '../../../../src/templates/components/AiGeneratedBadge';
import { aiGeneratedNoteText } from '../../../../src/templates/helpers/ai-generated-note';
import { t } from '../../../../src/templates/helpers/i18n';
import { AdditionalPage } from '../../../../src/templates/pages/AdditionalPage';

/**
 * An `@aiGenerated` marker shows a visible sentence next to its chip: the
 * `aiGeneratedNote` config text, or the translated default with the marker
 * value. Nothing about the marker lives only in the `title` tooltip.
 */
describe('aiGeneratedNoteText', () => {
    beforeAll(() => {
        I18nEngine.init('en-US');
    });

    it('uses the default text for a bare marker', () => {
        expect(aiGeneratedNoteText(true, '', t)).toBe('Drafted with AI assistance.');
    });

    it('puts the marker value into the default text', () => {
        expect(aiGeneratedNoteText('Claude', '', t)).toBe('Drafted with AI assistance (Claude).');
    });

    it('uses the configured text and fills {value}', () => {
        expect(
            aiGeneratedNoteText(
                'Claude',
                'Drafted with AI assistance ({value}) and reviewed by a maintainer.',
                t
            )
        ).toBe('Drafted with AI assistance (Claude) and reviewed by a maintainer.');
    });

    it('fills {value} with nothing for a bare marker', () => {
        expect(aiGeneratedNoteText(true, 'AI draft{value}.', t)).toBe('AI draft.');
    });

    it('has both texts in every locale, the second with the value', () => {
        for (const [name, locale] of Object.entries(locales)) {
            const strings = locale as Record<string, string>;
            expect(strings['ai-generated-note'], name).toBeTruthy();
            expect(strings['ai-generated-note-value'], name).toContain('{{value}}');
        }
    });
});

describe('AiGeneratedBadge / AiGeneratedNote', () => {
    const original = Configuration.mainData.aiGeneratedNote;

    beforeAll(() => {
        I18nEngine.init('en-US');
    });

    afterEach(() => {
        Configuration.mainData.aiGeneratedNote = original;
    });

    it('renders nothing without a marker', () => {
        expect(AiGeneratedBadge({ aiGenerated: false })).toBe('');
        expect(AiGeneratedNote({ aiGenerated: false, class: 'x' })).toBe('');
    });

    it('keeps the chip without the marker value or a dash in its tooltip', () => {
        const chip = AiGeneratedBadge({ aiGenerated: 'Claude' });
        expect(chip).toContain('>AI generated</span>');
        expect(chip).not.toContain('Claude');
        expect(chip).not.toContain(String.fromCodePoint(0x2014));
    });

    it('renders the sentence as visible text', () => {
        const note = AiGeneratedNote({ aiGenerated: 'Claude', class: 'cdx-ai-generated-note' });
        expect(note).toMatch(/^<p class="cdx-ai-generated-note"/);
        expect(note).toContain('>Drafted with AI assistance (Claude).</p>');
    });

    it('renders the configured text with the value escaped', () => {
        Configuration.mainData.aiGeneratedNote = 'Reviewed: {value}';
        expect(AiGeneratedNote({ aiGenerated: '<b>&', class: 'n' })).toContain(
            '>Reviewed: &lt;b&gt;&amp;</p>'
        );
    });

    it('shows chip and sentence in the banner of an additional page', () => {
        const html = AdditionalPage({ additionalPage: '<p>Body</p>', aiGenerated: 'Claude' });
        expect(html).toContain('cdx-ai-generated-banner');
        expect(html).toContain('cdx-badge--ai-generated');
        expect(html).toContain('class="cdx-ai-generated-note"');
        expect(html).toContain('>Drafted with AI assistance (Claude).</p>');
    });
});
