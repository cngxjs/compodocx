import i18next from 'i18next';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import I18nEngine from '../../../../src/app/engines/i18n.engine';
import { t } from '../../../../src/templates/helpers';
import { COMPODOC_CONSTANTS } from '../../../../src/utils/constants';

const TAB_LABELS = COMPODOC_CONSTANTS.navTabDefinitions.map(tab => tab.label);

describe('t', () => {
    beforeAll(() => {
        I18nEngine.init('en-US');
    });

    afterEach(async () => {
        await i18next.changeLanguage('en-US');
    });

    it('translates tab labels written with capitals through their lowercase key', async () => {
        await i18next.changeLanguage('de-DE');
        expect(t('DOM Tree')).toBe('DOM-Baum');
        expect(t('Source')).toBe('Quelle');
        expect(t('Examples')).toBe('Beispiele');
        expect(t('Template')).toBe('Vorlage');
    });

    it('keeps the English tab labels', () => {
        expect(TAB_LABELS.map(label => t(label))).toEqual([
            'README',
            'Info',
            'API',
            'Source',
            'Template',
            'Styles',
            'Theming',
            'DOM Tree',
            'Examples',
            'Playground'
        ]);
    });

    it('returns a key without a translation unchanged', () => {
        expect(t('No Such Key')).toBe('No Such Key');
    });
});
