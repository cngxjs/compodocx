import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ts } from 'ts-morph';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AngularDependencies } from '../../../../src/app/compiler/angular-dependencies';

const READONLY = ts.SyntaxKind.ReadonlyKeyword;
const PRIVATE = ts.SyntaxKind.PrivateKeyword;

const COMMON = {
    deprecated: false,
    deprecationMessage: '',
    indexKey: '',
    optional: false
};

/**
 * Signal APIs, `host: {}` and `inject()` fields feed the same documented
 * fields as the old decorator members did. Their extracted shape must not
 * move when the decorator-member paths go.
 */
describe('modern member extraction', () => {
    let tmpDir: string;
    let component: any;

    beforeAll(() => {
        tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-modern-members-')));
        const file = path.join(tmpDir, 'card.component.ts');
        fs.writeFileSync(
            file,
            `import { Component, ElementRef, inject, input, model, output, viewChild } from '@angular/core';
import { DataService } from './data.service';
@Component({
    selector: 'app-card',
    template: '<span #label></span>',
    host: { '[class.active]': 'active()', '(click)': 'onClick($event)' }
})
export class CardComponent {
    /** Card title */
    readonly title = input.required<string>();
    readonly size = input(3);
    /** Emits on select */
    readonly selected = output<string>();
    readonly open = model(false);
    readonly label = viewChild<ElementRef>('label');
    private readonly data = inject(DataService);
    onClick(event: MouseEvent): void {}
}
`
        );
        fs.writeFileSync(
            path.join(tmpDir, 'data.service.ts'),
            `import { Injectable } from '@angular/core';
@Injectable({ providedIn: 'root' })
export class DataService {}
`
        );
        const deps = new AngularDependencies([file], {
            tsconfigDirectory: tmpDir
        }).getDependencies();
        component = deps.components.find((c: any) => c.name === 'CardComponent');
    });

    afterAll(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    const byName = (list: any[], name: string) => list.find(item => item.name === name);

    it('extracts input() and input.required() as inputs', () => {
        expect(byName(component.inputsClass, 'title')).toEqual({
            ...COMMON,
            name: 'title',
            type: 'string',
            description: '<p>Card title</p>\n',
            rawdescription: '\nCard title',
            line: 10,
            signalKind: 'input-signal',
            required: true,
            modifierKind: [READONLY]
        });
        expect(byName(component.inputsClass, 'size')).toEqual({
            ...COMMON,
            name: 'size',
            defaultValue: '3',
            description: '',
            line: 11,
            signalKind: 'input-signal',
            required: false,
            modifierKind: [READONLY]
        });
    });

    it('extracts output() as an output', () => {
        expect(byName(component.outputsClass, 'selected')).toEqual({
            ...COMMON,
            name: 'selected',
            type: 'string',
            description: '<p>Emits on select</p>\n',
            rawdescription: '\nEmits on select',
            line: 13,
            signalKind: 'output-signal',
            required: false,
            modifierKind: [READONLY]
        });
    });

    it('extracts model() as both an input and an output', () => {
        const model = {
            ...COMMON,
            name: 'open',
            defaultValue: 'false',
            description: '',
            line: 14,
            signalKind: 'model',
            required: false,
            modifierKind: [READONLY]
        };
        expect(byName(component.inputsClass, 'open')).toEqual(model);
        expect(byName(component.outputsClass, 'open')).toEqual(model);
        expect(component.inputsClass.map((i: any) => i.name)).toEqual(['open', 'size', 'title']);
        expect(component.outputsClass.map((o: any) => o.name)).toEqual(['open', 'selected']);
    });

    it('extracts viewChild() as a property', () => {
        expect(byName(component.propertiesClass, 'label')).toEqual({
            ...COMMON,
            name: 'label',
            defaultValue: "viewChild<ElementRef>('label')",
            type: 'ElementRef',
            description: '',
            line: 15,
            signalKind: 'view-child',
            modifierKind: [READONLY]
        });
    });

    it('extracts host: {} bindings and listeners', () => {
        expect(component.hostBindings).toEqual([
            {
                name: 'class.active',
                defaultValue: 'active()',
                type: '',
                description: "host: { '[class.active]': 'active()' }",
                line: 0,
                signalKind: 'host-binding'
            }
        ]);
        expect(component.hostListeners).toEqual([
            {
                name: 'click',
                args: [],
                description: "host: { '(click)': 'onClick($event)' }",
                line: 0,
                signalKind: 'host-listener'
            }
        ]);
    });

    it('extracts inject() fields as properties and documents no constructor', () => {
        expect(byName(component.propertiesClass, 'data')).toEqual({
            ...COMMON,
            name: 'data',
            defaultValue: 'inject(DataService)',
            type: 'DataService',
            description: '',
            line: 16,
            signalKind: 'inject',
            modifierKind: [PRIVATE, READONLY]
        });
        expect(component.propertiesClass.map((p: any) => p.name)).toEqual(['data', 'label']);
        expect(component.constructorObj).toBeUndefined();
    });
});
