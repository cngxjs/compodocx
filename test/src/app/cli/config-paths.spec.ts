import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fromConfigFile, isThemePath } from '../../../../src/app/cli/config-paths';

const cwd = path.resolve('/tmp/project');
const elsewhere = { cwd, configDir: path.resolve('/tmp/project/conf') };

describe('fromConfigFile', () => {
    it('resolves a relative value against the config folder', () => {
        expect(fromConfigFile('docs/extra', elsewhere)).toBe(
            path.resolve('/tmp/project/conf/docs/extra')
        );
    });

    it('keeps an absolute value', () => {
        const absolute = path.resolve('/opt/assets');
        expect(fromConfigFile(absolute, elsewhere)).toBe(absolute);
    });

    it('keeps the value without a config folder', () => {
        expect(fromConfigFile('docs/extra', { cwd })).toBe('docs/extra');
    });

    it('keeps the value byte-identical when the config folder is the cwd', () => {
        const here = { cwd, configDir: `${cwd}${path.sep}` };
        expect(fromConfigFile('docs/extra', here)).toBe('docs/extra');
        expect(fromConfigFile('./x/', here)).toBe('./x/');
    });

    it('keeps an empty string', () => {
        expect(fromConfigFile('', elsewhere)).toBe('');
    });
});

describe('isThemePath', () => {
    it('is true for a path or a .css file and false for a theme name', () => {
        expect(isThemePath('a/b.css')).toBe(true);
        expect(isThemePath('x.css')).toBe(true);
        expect(isThemePath('themes/custom')).toBe(true);
        expect(isThemePath('nord')).toBe(false);
    });
});
