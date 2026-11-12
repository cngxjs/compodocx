import type { Feature } from '../../../../src/app/compiler/semantic/features';
import { featureFolders } from '../../../../src/app/page-generator/feature-page-generator';

const feature = (id: string, root: string, readme?: string): Feature => ({
    id,
    entryPoint: id.slice(0, id.indexOf('#')),
    key: id.slice(id.indexOf('#') + 1),
    label: id,
    root,
    detector: 'config',
    ...(readme ? { readme } : {})
});

describe('featureFolders', () => {
    const segments = new Map([
        ['@x/ui#', ['ui']],
        ['@x/ui#chips', ['ui', 'chips']],
        ['@x/ui#toast', ['ui', 'toast']]
    ]);

    it('gives a folder shared by several features to the root feature of the entry point', () => {
        const folders = featureFolders(
            [feature('@x/ui#chips', 'lib/ui'), feature('@x/ui#', 'lib/ui')],
            segments
        );
        expect(folders.get('lib/ui')).toEqual(['ui']);
    });

    it('lets a root win over the README folder of another feature', () => {
        const folders = featureFolders(
            [
                feature('@x/ui#chips', 'lib/ui/chips', 'lib/ui/toast/README.md'),
                feature('@x/ui#toast', 'lib/ui/toast')
            ],
            segments
        );
        expect(folders.get('lib/ui/toast')).toEqual(['ui', 'toast']);
    });

    it('maps the README folder of a feature that differs from its root', () => {
        const folders = featureFolders(
            [feature('@x/ui#toast', 'lib/ui/toast/src', 'lib/ui/toast/README.md')],
            segments
        );
        expect(folders.get('lib/ui/toast/src')).toEqual(['ui', 'toast']);
        expect(folders.get('lib/ui/toast')).toEqual(['ui', 'toast']);
    });

    it('keeps the model order among the other features', () => {
        const folders = featureFolders(
            [feature('@x/ui#chips', 'lib/ui/shared'), feature('@x/ui#toast', 'lib/ui/shared')],
            segments
        );
        expect(folders.get('lib/ui/shared')).toEqual(['ui', 'chips']);
    });
});
