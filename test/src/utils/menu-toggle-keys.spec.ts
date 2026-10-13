import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Command } from 'commander';
import { describe, expect, it } from 'vitest';

import { defineFlags } from '../../../src/app/cli/flags';
import { MENU_TOGGLE_KEYS } from '../../../src/utils/constants';

const root = resolve(__dirname, '../../..');
const read = (file: string): string => readFileSync(resolve(root, file), 'utf-8');

/** Every `toggleMenuItems` description names exactly the chapter keys the sidebar reads. */
describe('MENU_TOGGLE_KEYS', () => {
    it('is the set of chapter keys the sidebar checks', () => {
        const menu = read('src/templates/components/Menu.tsx');
        for (const key of MENU_TOGGLE_KEYS) {
            expect(menu, key).toContain(`'${key}'`);
        }
    });

    it('is listed in the CLI help', () => {
        const program = new Command();
        program.exitOverride();
        defineFlags(program);
        const option = program.options.find(o => o.long === '--toggleMenuItems');
        expect(option?.description).toContain(MENU_TOGGLE_KEYS.join(', '));
    });

    it('is listed in the schema title', () => {
        const schema = JSON.parse(read('src/config/schema.json'));
        const title: string = schema.properties.toggleMenuItems.items.title;
        expect(title).toContain(MENU_TOGGLE_KEYS.join(', '));
        expect(title).toContain('start open');
    });

    it('is listed in the docs row', () => {
        const row =
            read('docs/configuration.md')
                .split('\n')
                .find(line => line.startsWith('| toggleMenuItems |')) ?? '';
        expect(row).toContain('start open');
        const listed = [...row.matchAll(/`([A-Za-z-]+)`/g)].map(m => m[1]);
        for (const key of MENU_TOGGLE_KEYS) {
            expect(listed, key).toContain(key);
        }
        for (const removed of ['modules', 'miscellaneous', 'tokens']) {
            expect(listed, removed).toContain(removed);
        }
    });
});
