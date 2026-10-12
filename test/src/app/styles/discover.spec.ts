import { describe, expect, it } from 'vitest';
import { discoverStyleFiles, expandBraces, type StyleFs } from '../../../../src/app/styles';

/** A file system from a list of base-relative file paths. */
const fsOf = (files: readonly string[]): StyleFs & { readonly listed: string[] } => {
    const listed: string[] = [];
    return {
        listed,
        list: dir => {
            listed.push(dir);
            const prefix = dir ? `${dir}/` : '';
            const names = new Map<string, boolean>();
            for (const file of files.filter(f => f.startsWith(prefix))) {
                const rest = file.slice(prefix.length).split('/');
                names.set(rest[0], rest.length > 1 || names.get(rest[0]) === true);
            }
            return [...names].map(([name, dir]) => ({ name, dir }));
        }
    };
};

describe('discoverStyleFiles', () => {
    it('matches globs relative to the base, braces expanded, sorted', () => {
        const fs = fsOf([
            'projects/kit/theming/tokens.css',
            'projects/kit/theming/components/a.css',
            'projects/kit/src/button.css',
            'projects/themes/material/card.scss',
            'projects/themes/material/card.css'
        ]);
        const found = discoverStyleFiles(
            ['projects/*/theming/**/*.css', 'projects/themes/**/*.{css,scss}'],
            [],
            fs
        );
        expect(found.files).toEqual([
            'projects/kit/theming/components/a.css',
            'projects/kit/theming/tokens.css',
            'projects/themes/material/card.css',
            'projects/themes/material/card.scss'
        ]);
        expect(expandBraces('a/*.{css,scss}')).toEqual(['a/*.css', 'a/*.scss']);
    });

    it('never enters node_modules, dist, .git or an excluded folder', () => {
        const fs = fsOf([
            'node_modules/pkg/a.css',
            'dist/kit/a.css',
            'docs/styles/a.css',
            '.git/a.css',
            'src/a.css'
        ]);
        const found = discoverStyleFiles(['**/*.css'], ['docs'], fs);
        expect(found.files).toEqual(['src/a.css']);
        expect(fs.listed).not.toContain('node_modules');
        expect(fs.listed).not.toContain('docs');
    });

    it('returns matches that are not .css or .scss apart', () => {
        const found = discoverStyleFiles(
            ['theming/*'],
            [],
            fsOf(['theming/a.css', 'theming/README.md'])
        );
        expect(found.files).toEqual(['theming/a.css']);
        expect(found.ignored).toEqual(['theming/README.md']);
    });

    it('walks each static glob prefix once and tolerates a missing folder', () => {
        const fs = fsOf(['projects/themes/a.scss']);
        const found = discoverStyleFiles(
            ['projects/**/*.scss', 'projects/themes/*.scss', 'missing/*.css'],
            [],
            fs
        );
        expect(found.files).toEqual(['projects/themes/a.scss']);
        expect(fs.listed.filter(dir => dir === 'projects/themes')).toHaveLength(1);
    });
});
