import { describe, expect, it } from 'vitest';
import type {
    ExportClass,
    ExportComponent,
    ExportDirective,
    ExportEnumeration,
    ExportFunction,
    ExportGuard,
    ExportInjectable,
    ExportInterceptor,
    ExportInterface,
    ExportModule,
    ExportPipe,
    ExportTypeAlias,
    ExportVariable
} from '../../../src/app/interfaces/export-data.interface';
import {
    emitClass,
    emitComponent,
    emitDirective,
    emitEnumeration,
    emitFunction,
    emitGuard,
    emitInjectable,
    emitInterceptor,
    emitInterface,
    emitModule,
    emitPipe,
    emitTypeAlias,
    emitVariable
} from '../../../src/llm-md/emit';

describe('llm-md/emit — emitComponent', () => {
    const base: ExportComponent = {
        name: 'FooComponent',
        file: 'src/app/foo.component.ts',
        selector: 'app-foo',
        standalone: true,
        description: 'Renders a foo widget.',
        inputsClass: [
            {
                name: 'name',
                type: 'string',
                description: 'Required display name'
            },
            {
                name: 'disabled',
                type: 'boolean',
                optional: true,
                defaultValue: 'false',
                description: 'When true, blocks interaction'
            }
        ],
        outputsClass: [{ name: 'selected', type: 'EventEmitter<FooEvent>' }],
        methodsClass: [
            {
                name: 'refresh',
                returnType: 'Promise<void>',
                description: 'Reload from upstream'
            }
        ]
    };

    it('emits hero, file path, selector and standalone marker', () => {
        const out = emitComponent(base);
        expect(out).toContain('### FooComponent');
        expect(out).toContain('File: `src/app/foo.component.ts`');
        expect(out).toContain('Selector: `app-foo`');
        expect(out).toContain('Standalone: yes');
    });

    it('emits inputs as a bulleted list with type and description', () => {
        const out = emitComponent(base);
        expect(out).toContain('Inputs:');
        expect(out).toContain('`name: string`');
        expect(out).toContain('— Required display name');
        expect(out).toContain('`disabled?: boolean = false`');
    });

    it('emits outputs and methods sections when present', () => {
        const out = emitComponent(base);
        expect(out).toContain('Outputs:');
        expect(out).toContain('Methods:');
        expect(out).toContain('`refresh(): Promise<void>`');
    });

    it('does NOT emit source code, template, or styles', () => {
        const withSource: ExportComponent = {
            ...base,
            sourceCode: 'export class FooComponent {}',
            template: '<div></div>',
            styles: ['.foo {}']
        };
        const out = emitComponent(withSource);
        expect(out).not.toContain('FooComponent {}');
        expect(out).not.toContain('<div></div>');
        expect(out).not.toContain('.foo {}');
    });

    it('renders a deprecated tail when entity is deprecated', () => {
        const out = emitComponent({
            ...base,
            deprecated: true,
            deprecationMessage: 'use BarComponent'
        });
        expect(out).toContain('Deprecated: (deprecated: use BarComponent)');
    });

    it('filters signal/input/output kinds out of the Properties section', () => {
        const withSignals: ExportComponent = {
            ...base,
            propertiesClass: [
                { name: 'count', type: 'Signal<number>', kind: 'signal' },
                { name: 'plain', type: 'string', kind: 'class-property' },
                { name: 'derived', type: 'Signal<number>', kind: 'computed' }
            ]
        };
        const out = emitComponent(withSignals);
        // signals/computed move to dedicated derived-state output (out of scope for v0.3.0);
        // here we only assert the Properties section keeps the plain prop.
        expect(out).toMatch(/Properties:[\s\S]*`plain: string`/);
        expect(out).not.toMatch(/Properties:[\s\S]*`count: Signal<number>`/);
    });
});

describe('llm-md/emit — emitDirective', () => {
    it('emits selector and standalone, no theme tokens', () => {
        const dir: ExportDirective = {
            name: 'BorderDirective',
            file: 'src/app/border.directive.ts',
            selector: '[appBorder]',
            standalone: true,
            description: 'Adds a border'
        };
        const out = emitDirective(dir);
        expect(out).toContain('### BorderDirective');
        expect(out).toContain('Selector: `[appBorder]`');
        expect(out).toContain('Standalone: yes');
        expect(out).toContain('Description: Adds a border');
    });
});

describe('llm-md/emit — emitPipe', () => {
    it('renders pipe name and pure flag', () => {
        const pipe: ExportPipe = {
            name: 'CapitalizePipe',
            file: 'src/app/capitalize.pipe.ts',
            ngname: 'capitalize',
            standalone: false,
            pure: 'true',
            description: 'Capitalizes the first letter'
        };
        const out = emitPipe(pipe);
        expect(out).toContain('### CapitalizePipe');
        expect(out).toContain('Pipe name: `capitalize`');
        expect(out).toContain('Pure: `true`');
        expect(out).toContain('Description: Capitalizes the first letter');
    });
});

describe('llm-md/emit — emitInjectable / emitInterceptor / emitGuard', () => {
    it('emitInjectable renders providedIn and token type', () => {
        const inj: ExportInjectable = {
            name: 'AuthService',
            file: 'src/app/auth.service.ts',
            providedIn: 'root',
            isToken: true,
            tokenType: 'AuthService'
        };
        const out = emitInjectable(inj);
        expect(out).toContain('providedIn: `root`');
        expect(out).toContain('Kind: InjectionToken');
        expect(out).toContain('Token type: `AuthService`');
    });

    it('emitInjectable names HttpContextToken as the token kind', () => {
        const out = emitInjectable({
            name: 'CACHE_ENABLED',
            file: 'src/app/tokens.ts',
            isToken: true,
            tokenClass: 'HttpContextToken',
            tokenType: 'boolean'
        });
        expect(out).toContain('Kind: HttpContextToken');
    });

    it('emitInterceptor renders the basic shape', () => {
        const inc: ExportInterceptor = {
            name: 'AuthInterceptor',
            file: 'src/app/auth.interceptor.ts',
            description: 'Adds bearer tokens',
            methods: [{ name: 'intercept', returnType: 'Observable<HttpEvent<unknown>>' }]
        };
        const out = emitInterceptor(inc);
        expect(out).toContain('### AuthInterceptor');
        expect(out).toContain('Methods:');
        expect(out).toContain('`intercept(): Observable<HttpEvent<unknown>>`');
    });

    it('emitGuard renders implements list', () => {
        const guard: ExportGuard = {
            name: 'AuthGuard',
            file: 'src/app/auth.guard.ts',
            implements: ['CanActivate']
        };
        const out = emitGuard(guard);
        expect(out).toContain('Implements: `CanActivate`');
    });
});

describe('llm-md/emit — emitClass / emitInterface', () => {
    it('emitClass renders extends list and properties', () => {
        const cls: ExportClass = {
            name: 'TodoStore',
            file: 'src/app/todo.store.ts',
            extends: 'BaseStore',
            properties: [{ name: 'todos', type: 'Todo[]' }]
        };
        const out = emitClass(cls);
        expect(out).toContain('### TodoStore');
        expect(out).toContain('Extends: `BaseStore`');
        expect(out).toContain('`todos: Todo[]`');
    });

    it('emitInterface renders extends and methods', () => {
        const iface: ExportInterface = {
            name: 'Foo',
            file: 'src/app/foo.ts',
            extends: ['Base', 'Other'],
            methods: [{ name: 'tick', returnType: 'void' }]
        };
        const out = emitInterface(iface);
        expect(out).toContain('### Foo');
        expect(out).toContain('Extends: `Base`, `Other`');
        expect(out).toContain('`tick(): void`');
    });
});

describe('llm-md/emit — emitModule', () => {
    it('renders declarations / imports / providers groups', () => {
        const mod: ExportModule = {
            name: 'AppModule',
            file: 'src/app/app.module.ts',
            description: 'Bootstrap module',
            children: [
                { type: 'providers', elements: [{ name: 'TodoStore' }] },
                { type: 'declarations', elements: [{ name: 'AppComponent' }] },
                { type: 'imports', elements: [{ name: 'BrowserModule' }] },
                { type: 'exports', elements: [] },
                { type: 'bootstrap', elements: [{ name: 'AppComponent' }] },
                { type: 'classes', elements: [] }
            ]
        };
        const out = emitModule(mod);
        expect(out).toContain('### AppModule');
        expect(out).toContain('declarations: `AppComponent`');
        expect(out).toContain('imports: `BrowserModule`');
        expect(out).toContain('providers: `TodoStore`');
        expect(out).toContain('bootstrap: `AppComponent`');
        // empty buckets are skipped
        expect(out).not.toContain('exports:');
        expect(out).not.toContain('classes:');
    });
});

describe('llm-md/emit — miscellaneous emitters', () => {
    it('emitFunction renders signature and description', () => {
        const fn: ExportFunction = {
            name: 'createId',
            file: 'src/app/id.util.ts',
            args: [{ name: 'prefix', type: 'string' }],
            returnType: 'string',
            description: 'Builds a unique id'
        };
        const out = emitFunction(fn);
        expect(out).toContain('`createId(prefix: string): string`');
        expect(out).toContain('— Builds a unique id');
        expect(out).toContain('Defined in `src/app/id.util.ts`');
    });

    it('emitTypeAlias renders the rhs', () => {
        const ta: ExportTypeAlias = {
            name: 'TodoId',
            file: 'src/app/todo.types.ts',
            rawtype: 'string | number'
        };
        const out = emitTypeAlias(ta);
        expect(out).toContain('`type TodoId = string | number`');
    });

    it('emitEnumeration renders members on indented sub-bullets', () => {
        const en: ExportEnumeration = {
            name: 'Status',
            file: 'src/app/status.ts',
            childs: [
                { name: 'Active', value: 'active' },
                { name: 'Inactive', value: 'inactive' }
            ]
        };
        const out = emitEnumeration(en);
        expect(out).toContain('`enum Status`');
        expect(out).toContain('  - `Active = active`');
        expect(out).toContain('  - `Inactive = inactive`');
    });

    it('emitVariable renders signature with type and default', () => {
        const v: ExportVariable = {
            name: 'PI',
            file: 'src/app/math.ts',
            type: 'number',
            defaultValue: '3.14159'
        };
        const out = emitVariable(v);
        expect(out).toContain('`PI: number = 3.14159`');
        expect(out).toContain('Defined in `src/app/math.ts`');
    });
});

describe('llm-md/emit — escaping (security: untrusted strings)', () => {
    it('escapes asterisks and backticks in component descriptions', () => {
        const c: ExportComponent = {
            name: 'WeirdComponent',
            description: 'Use *bold* and `code` carefully'
        };
        const out = emitComponent(c);
        expect(out).toContain('Description: Use \\*bold\\* and \\`code\\` carefully');
    });

    it('widens the fence when an inline value contains a backtick', () => {
        const c: ExportComponent = {
            name: 'X',
            inputsClass: [{ name: 'tag', type: 'string', defaultValue: '`hi`' }]
        };
        const out = emitComponent(c);
        expect(out).toMatch(/`` tag: string = `hi` ``/);
    });
});
