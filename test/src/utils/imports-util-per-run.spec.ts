import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import ts from 'typescript';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import ImportsUtil from '../../../src/utils/imports.util';

/**
 * Import lookups read files through a ts-morph project that starts fresh on
 * each crawl, so a rebuild (watch) sees an imported file edited in between.
 */
describe('ImportsUtil - one project per run', () => {
    let tmpDir: string;
    let host: ts.SourceFile;
    const meta = () => path.join(tmpDir, 'meta.ts');

    const keysOf = (): string[] => {
        const props = ImportsUtil.findValueInImportOrLocalVariables('META', host) as any;
        return Array.from(props ?? []).map((p: any) => p.name.getText());
    };

    beforeAll(() => {
        tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-imports-')));
        const hostFile = path.join(tmpDir, 'host.ts');
        const hostText = "import { META } from './meta';\nexport const used = META;\n";
        fs.writeFileSync(hostFile, hostText);
        host = ts.createSourceFile(hostFile, hostText, ts.ScriptTarget.Latest, true);
    });

    afterAll(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('sees the edited value of an imported file after a new run', () => {
        fs.writeFileSync(meta(), 'export const META = { before: 1 };\n');
        ImportsUtil.resetProject();
        expect(keysOf()).toEqual(['before']);

        fs.writeFileSync(meta(), 'export const META = { after: 2 };\n');
        ImportsUtil.resetProject();
        expect(keysOf()).toEqual(['after']);
    });

    it('finds a value imported through a re-exporting file', () => {
        const barrelHost = path.join(tmpDir, 'barrel-host.ts');
        const text = "import { SHARED } from './barrel';\nexport const used = SHARED;\n";
        fs.writeFileSync(barrelHost, text);
        fs.writeFileSync(path.join(tmpDir, 'barrel.ts'), "export * from './shared';\n");
        fs.writeFileSync(
            path.join(tmpDir, 'shared.ts'),
            'export const SHARED = { viaExport: 1 };\n'
        );
        ImportsUtil.resetProject();
        const sf = ts.createSourceFile(barrelHost, text, ts.ScriptTarget.Latest, true);
        const props = ImportsUtil.findValueInImportOrLocalVariables('SHARED', sf) as any;
        expect(Array.from(props ?? []).map((p: any) => p.name.getText())).toEqual(['viaExport']);
    });
});
