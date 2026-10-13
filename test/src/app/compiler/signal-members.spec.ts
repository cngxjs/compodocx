import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AngularDependencies } from '../../../../src/app/compiler/angular-dependencies';

/** Signal inputs, outputs and models are recognised from the call, not from the initializer text. */
describe('signal member detection', () => {
    let tmpDir: string;
    let component: any;

    beforeAll(() => {
        tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-signal-members-')));
        const file = path.join(tmpDir, 'panel.component.ts');
        fs.writeFileSync(
            file,
            `import { Component, booleanAttribute, computed, input, model, output } from '@angular/core';

@Component({ selector: 'app-panel', template: '' })
export class PanelComponent {
    readonly title = input<string>('Untitled');
    readonly open = input(false, { transform: booleanAttribute, alias: 'expanded' });
    readonly id = input.required<string>();
    readonly onClose = input<(() => void) | undefined>(undefined);
    readonly closed = output<void>({ alias: 'panelClosed' });
    readonly size = model<number>(1);
    readonly copy = '<code>input</code> appears in this text';
    readonly label = computed(() => this.title());
}
`
        );
        component = new AngularDependencies([file], { tsconfigDirectory: tmpDir })
            .getDependencies()
            .components.find((c: any) => c.name === 'PanelComponent');
    });

    afterAll(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    const names = (list: any[]) => list.map((p: any) => p.name);
    const inputNamed = (name: string) => component.inputsClass.find((p: any) => p.name === name);

    it('writes required, type and default value of an input', () => {
        expect(inputNamed('title')).toMatchObject({
            signalKind: 'input-signal',
            required: false,
            type: 'string',
            defaultValue: "'Untitled'"
        });
        expect(inputNamed('title')).not.toHaveProperty('alias');
        expect(inputNamed('id')).toMatchObject({ required: true, type: 'string' });
        expect(inputNamed('id').defaultValue).toBeUndefined();
    });

    it('writes the alias and keeps options out of the default value', () => {
        const open = inputNamed('open');
        expect(open).toMatchObject({
            name: 'open',
            alias: 'expanded',
            required: false,
            defaultValue: 'false'
        });
        expect(open.type).toBeUndefined();
        expect(component.outputsClass.find((p: any) => p.name === 'closed')).toMatchObject({
            signalKind: 'output-signal',
            alias: 'panelClosed',
            type: 'void'
        });
    });

    it('detects a function type argument and lists a model on both sides', () => {
        expect(inputNamed('onClose')).toMatchObject({
            type: '(() => void) | undefined',
            defaultValue: 'undefined'
        });
        expect(names(component.inputsClass)).toContain('size');
        expect(names(component.outputsClass)).toContain('size');
        expect(inputNamed('size')).toMatchObject({ signalKind: 'model', defaultValue: '1' });
    });

    it('keeps strings that mention input and computed values as properties', () => {
        expect(names(component.propertiesClass)).toEqual(['copy', 'label']);
        expect(names(component.inputsClass)).not.toContain('label');
        expect(names(component.outputsClass)).toEqual(['closed', 'size']);
    });
});
