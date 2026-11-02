import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signalCallOf } from '../../../../src/app/compiler/angular/deps/helpers/class-helper/member-visitor';
import { AngularDependencies } from '../../../../src/app/compiler/angular-dependencies';

describe('signalCallOf', () => {
    it('reads nested type arguments', () => {
        expect(signalCallOf("contentChild<TemplateRef<unknown>>('slot')", 'contentChild')).toEqual({
            type: 'TemplateRef<unknown>',
            required: false
        });
    });

    it('reads .required before the type arguments', () => {
        expect(signalCallOf("viewChild.required<ElementRef>('el')", 'viewChild')).toEqual({
            type: 'ElementRef',
            required: true
        });
    });

    it('keeps an arrow inside the type arguments', () => {
        expect(signalCallOf('signal<() => void>(noop)', 'signal')?.type).toBe('() => void');
    });

    it('matches only the exact callee', () => {
        expect(signalCallOf('viewChildren(Item)', 'viewChild')).toBeUndefined();
        expect(signalCallOf('signalStore()', 'signal')).toBeUndefined();
        expect(signalCallOf('computed(() => 1)', 'computed')).toEqual({
            type: undefined,
            required: false
        });
    });
});

/** Signal queries with generic or `.required` calls get their kind and type. */
describe('signal query detection', () => {
    let tmpDir: string;
    let component: any;

    beforeAll(() => {
        tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-signal-queries-')));
        const file = path.join(tmpDir, 'card.component.ts');
        fs.writeFileSync(
            file,
            `import { Component, ElementRef, TemplateRef, contentChild, contentChildren, viewChild } from '@angular/core';
import { outputFromObservable } from '@angular/core/rxjs-interop';

@Component({ selector: 'app-card', template: '' })
export class CardComponent {
    readonly header = contentChild<TemplateRef<unknown>>('header');
    readonly actions = contentChildren<TemplateRef<unknown>>('action');
    readonly root = viewChild.required<ElementRef>('root');
    readonly tick = outputFromObservable(source, { alias: 'ticked' });
}
`
        );
        component = new AngularDependencies([file], { tsconfigDirectory: tmpDir })
            .getDependencies()
            .components.find((c: any) => c.name === 'CardComponent');
    });

    afterAll(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    const member = (name: string) => component.propertiesClass.find((p: any) => p.name === name);

    it('recognises generic content queries', () => {
        expect(member('header')).toMatchObject({ signalKind: 'content-child' });
        expect(member('actions')).toMatchObject({ signalKind: 'content-children' });
    });

    it('recognises a required view query', () => {
        expect(member('root')).toMatchObject({ signalKind: 'view-child', required: true });
    });

    it('lists outputFromObservable as an output with its alias', () => {
        const tick = component.outputsClass.find((p: any) => p.name === 'tick');
        expect(tick).toMatchObject({ alias: 'ticked' });
        expect(member('tick')).toBeUndefined();
    });
});
