import { describe, expect, it } from 'vitest';
import { type PackageManifest, styleImportLine } from '../../../../src/app/styles';

const manifests = (byDir: Record<string, PackageManifest>) => (dir: string) => byDir[dir];

describe('styleImportLine', () => {
    it('maps a file through a `*` export pattern, @import for CSS and @use for SCSS', () => {
        const read = manifests({
            'projects/kit': { name: '@sty/kit', exports: { './theming/*.css': './theming/*.css' } },
            'projects/themes': {
                name: '@sty/themes',
                exports: { './material/*': './material/*.scss' }
            }
        });
        expect(styleImportLine('projects/kit/theming/tokens.css', read)).toBe(
            "@import '@sty/kit/theming/tokens.css';"
        );
        expect(styleImportLine('projects/themes/material/card-theme.scss', read)).toBe(
            "@use '@sty/themes/material/card-theme';"
        );
    });

    it('maps an exact export key, also inside a condition object', () => {
        const read = manifests({
            lib: { name: 'lib', exports: { './reset': { style: './css/reset.css' } } }
        });
        expect(styleImportLine('lib/css/reset.css', read)).toBe("@import 'lib/reset';");
    });

    it('omits the line without a matching export or without exports', () => {
        expect(
            styleImportLine(
                'lib/css/other.css',
                manifests({ lib: { name: 'lib', exports: { './reset': './css/reset.css' } } })
            )
        ).toBeUndefined();
        expect(styleImportLine('lib/a.css', manifests({ lib: { name: 'lib' } }))).toBeUndefined();
        expect(styleImportLine('lib/a.css', manifests({}))).toBeUndefined();
    });

    it('stops at the nearest package.json with a name', () => {
        const read = manifests({
            'pkg/sub': { name: 'inner' },
            pkg: { name: 'outer', exports: { './*': './*' } }
        });
        expect(styleImportLine('pkg/sub/a.css', read)).toBeUndefined();
    });
});
