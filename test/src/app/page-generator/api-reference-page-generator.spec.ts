import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeatureModel } from '../../../../src/app/compiler/semantic/features';
import { emptyModel } from '../../../../src/app/compiler/semantic/model';
import Configuration from '../../../../src/app/configuration';
import { ApiReferencePageGenerator } from '../../../../src/app/page-generator/api-reference-page-generator';

const withFeatures = (features: FeatureModel['features']) => {
    Configuration.mainData.semantic = {
        ...emptyModel(),
        features: { features, featureOf: new Map(), families: [] }
    };
};

const TOAST = {
    id: '@x/ui#toast',
    entryPoint: '@x/ui',
    key: 'toast',
    label: 'toast',
    root: 'ui/toast',
    detector: 'cohesion' as const
};

/**
 * ApiReferencePageGenerator emits exactly one root-level
 * `references.html` page under `menuLayout: 'feature'`. No-ops under
 * `menuLayout: 'type'` and when no feature was derived.
 */
describe('ApiReferencePageGenerator', () => {
    let addPageSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        addPageSpy = vi.spyOn(Configuration, 'addPage').mockImplementation(() => undefined);
    });

    afterEach(() => {
        addPageSpy.mockRestore();
        Configuration.mainData.semantic = undefined;
        Configuration.mainData.menuLayout = 'type';
    });

    it('emits nothing under menuLayout: "type"', async () => {
        Configuration.mainData.menuLayout = 'type';
        withFeatures([TOAST]);
        await new ApiReferencePageGenerator().prepare();
        expect(addPageSpy).not.toHaveBeenCalled();
    });

    it('emits nothing without features', async () => {
        Configuration.mainData.menuLayout = 'feature';
        withFeatures([]);
        await new ApiReferencePageGenerator().prepare();
        expect(addPageSpy).not.toHaveBeenCalled();
    });

    it('emits exactly one root-level references.html page in feature mode', async () => {
        Configuration.mainData.menuLayout = 'feature';
        withFeatures([TOAST, { ...TOAST, id: '@x/ui#', key: '', label: 'ui' }]);
        await new ApiReferencePageGenerator().prepare();
        expect(addPageSpy).toHaveBeenCalledTimes(1);
        const page = addPageSpy.mock.calls[0][0] as any;
        expect(page).toMatchObject({
            name: 'references',
            filename: 'references',
            context: 'api-reference',
            depth: 0,
            path: ''
        });
    });

    it('uses the "api-reference" context (overridable via --templates)', async () => {
        Configuration.mainData.menuLayout = 'feature';
        withFeatures([TOAST]);
        await new ApiReferencePageGenerator().prepare();
        const page = addPageSpy.mock.calls[0][0] as any;
        expect(page.context).toBe('api-reference');
    });
});
