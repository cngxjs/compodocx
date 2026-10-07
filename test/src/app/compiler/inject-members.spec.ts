import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AngularDependencies } from '../../../../src/app/compiler/angular-dependencies';

/** `inject()` fields are recognised from the syntax tree, not from the initializer text. */
describe('inject() member detection', () => {
    let tmpDir: string;
    let service: any;

    beforeAll(() => {
        tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-inject-members-')));
        const file = path.join(tmpDir, 'store.service.ts');
        fs.writeFileSync(
            file,
            `import { ElementRef, Injectable, inject as use } from '@angular/core';
import { Store, STORE_LIMIT } from './store';

@Injectable({ providedIn: 'root' })
export class StoreService {
    readonly typed = use<Store>(Store);
    readonly chained = use(Store).snapshot;
    readonly limit = use(STORE_LIMIT, { optional: true })!;
    readonly plain = Store.create();
    readonly element = use(ElementRef<HTMLElement>);
}
`
        );
        service = new AngularDependencies([file], { tsconfigDirectory: tmpDir })
            .getDependencies()
            .injectables.find((i: any) => i.name === 'StoreService');
    });

    afterAll(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    const property = (name: string) => service.properties.find((p: any) => p.name === name);

    it('recognises a generic call through an aliased import', () => {
        expect(property('typed')).toMatchObject({ signalKind: 'inject', type: 'Store' });
    });

    it('recognises the call at the root of a chain', () => {
        expect(property('chained')).toMatchObject({ signalKind: 'inject', type: 'Store' });
        expect(property('limit')).toMatchObject({ signalKind: 'inject', type: 'STORE_LIMIT' });
        expect(property('element')).toMatchObject({ signalKind: 'inject', type: 'ElementRef' });
    });

    it('leaves other initializers alone', () => {
        expect(property('plain').signalKind).toBeUndefined();
    });
});
