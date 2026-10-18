import { afterEach, describe, expect, it } from 'vitest';
import Configuration from '../../../../src/app/configuration';
import { isApiSection, isInfoSection } from '../../../../src/templates/helpers/tab-helpers';

describe('tab section helpers', () => {
    afterEach(() => {
        Configuration.mainData.infoTabSections = [];
        Configuration.mainData.apiTabSections = [];
    });

    it('keeps the default API sections when only infoTabSections is set', () => {
        Configuration.mainData.infoTabSections = ['description'];
        expect(isInfoSection('description')).toBe(true);
        expect(isInfoSection('metadata')).toBe(false);
        expect(isApiSection('inputs')).toBe(true);
        expect(isApiSection('methods')).toBe(true);
    });

    it('uses the configured API sections when apiTabSections is set', () => {
        Configuration.mainData.apiTabSections = ['inputs'];
        expect(isApiSection('inputs')).toBe(true);
        expect(isApiSection('methods')).toBe(false);
    });
});
