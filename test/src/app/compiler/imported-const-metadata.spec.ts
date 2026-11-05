import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ts } from 'ts-morph';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AngularDependencies } from '../../../../src/app/compiler/angular-dependencies';

/**
 * Consts imported from other project files are read in component metadata:
 * `hostDirectives` entries and `styles`, also through a barrel re-export.
 */
describe('AngularDependencies - imported consts in component metadata', () => {
    let tmpDir: string;
    let card: any;

    beforeAll(() => {
        tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-imported-const-')));
        const write = (name: string, source: string) =>
            fs.writeFileSync(path.join(tmpDir, name), source);
        write(
            'tooltip.ts',
            `import { Directive } from '@angular/core';
/** A tooltip. */
@Directive({ selector: '[appTooltip]' })
export class TooltipDirective {}
`
        );
        write(
            'shared.ts',
            `import { TooltipDirective } from './tooltip';
export const TOOLTIP_HOST = { directive: TooltipDirective, inputs: ['text: tooltip'] };
const BASE = [':host { display: block; }'];
export const CARD_STYLES = [...BASE, '.title { font-weight: 600; }'];
`
        );
        write('index.ts', `export { TOOLTIP_HOST, CARD_STYLES } from './shared';\n`);
        write(
            'card.ts',
            `import { Component } from '@angular/core';
import { TooltipDirective } from './tooltip';
import { TOOLTIP_HOST, CARD_STYLES } from './index';
/** A card. */
@Component({
    selector: 'app-card',
    template: '',
    hostDirectives: [TOOLTIP_HOST, TooltipDirective, MISSING],
    styles: CARD_STYLES
})
export class CardComponent {}
`
        );
        const files = ['tooltip.ts', 'shared.ts', 'index.ts', 'card.ts'].map(name =>
            path.join(tmpDir, name)
        );
        const deps = new AngularDependencies(files, {
            tsconfigDirectory: tmpDir,
            // As in a real run: imports between project files resolve.
            resolution: {
                moduleResolution: ts.ModuleResolutionKind.Bundler,
                module: ts.ModuleKind.ESNext
            }
        });
        card = deps.getDependencies().components.find(c => c.name === 'CardComponent');
    });

    afterAll(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('dereferences an imported hostDirectives const through a barrel', () => {
        expect(card.hostDirectives[0]).toEqual({
            name: 'TooltipDirective',
            inputs: ['text: tooltip'],
            outputs: [],
            refName: 'TOOLTIP_HOST'
        });
    });

    it('keeps a bare directive class and an unknown name as names', () => {
        expect(card.hostDirectives[1]).toEqual({ name: 'TooltipDirective', unresolved: true });
        expect(card.hostDirectives[2]).toEqual({ name: 'MISSING', unresolved: true });
    });

    it('reads imported styles with the spread of a const in their own file', () => {
        expect(card.styles).toEqual([':host { display: block; }', '.title { font-weight: 600; }']);
    });
});
