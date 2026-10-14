import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');
const read = (file: string): string => readFileSync(resolve(root, file), 'utf-8');

/** Config-file keys the CLI reads: `configFile.<key>` and `const { a, b } = configFile`. */
const readKeys = (): string[] => {
    const files = [
        'src/index-cli.ts',
        ...readdirSync(resolve(root, 'src/app/cli'))
            .filter(file => file.endsWith('.ts'))
            .map(file => `src/app/cli/${file}`)
    ];
    const keys = new Set<string>();
    for (const file of files) {
        const source = read(file);
        for (const match of source.matchAll(/configFile\.([A-Za-z]+)/g)) {
            keys.add(match[1]);
        }
        for (const match of source.matchAll(/const \{([^}]+)\} = configFile\b/g)) {
            for (const key of match[1].split(',')) {
                keys.add(key.trim());
            }
        }
    }
    return [...keys].sort();
};

describe('config schema drift', () => {
    it('declares every config-file key the CLI reads', () => {
        const schema = JSON.parse(read('src/config/schema.json'));
        const declared = new Set(Object.keys(schema.properties));
        const keys = readKeys();
        expect(keys.length).toBeGreaterThan(50);
        expect(keys.filter(key => !declared.has(key))).toEqual([]);
    });
});
