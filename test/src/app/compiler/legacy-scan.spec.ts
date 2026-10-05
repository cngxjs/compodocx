import { ts } from 'ts-morph';
import { describe, expect, it } from 'vitest';
import {
    formatLegacyNotice,
    type LegacyFinding,
    scanLegacy,
    sortLegacyFindings
} from '../../../../src/app/compiler/legacy-scan';

const CWD = '/project';

const scan = (source: string, file = 'src/app/sample.ts'): readonly LegacyFinding[] =>
    scanLegacy(ts.createSourceFile(`${CWD}/${file}`, source, ts.ScriptTarget.Latest, true), CWD);

const kinds = (source: string): readonly string[] => scan(source).map(finding => finding.kind);

describe('legacy scan', () => {
    it('reports an NgModule class', () => {
        expect(scan(`@NgModule({ declarations: [] })\nexport class AppModule {}`)).toEqual([
            { kind: 'ng-module', name: 'AppModule', file: 'src/app/sample.ts', line: 1 }
        ]);
    });

    it('reports a method returning ModuleWithProviders', () => {
        const findings = scan(`export class SharedModule {
    static forRoot(): ModuleWithProviders<SharedModule> { return { ngModule: SharedModule }; }
}`);
        expect(findings).toEqual([
            {
                kind: 'module-with-providers',
                name: 'SharedModule.forRoot',
                file: 'src/app/sample.ts',
                line: 2
            }
        ]);
    });

    it('reports a bootstrapModule call', () => {
        const findings = scan(`platformBrowserDynamic().bootstrapModule(AppModule);`);
        expect(findings.map(f => [f.kind, f.name])).toEqual([['bootstrap-module', 'AppModule']]);
    });

    it('reports entryComponents in decorator metadata', () => {
        expect(
            kinds(`@NgModule({ entryComponents: [DialogComponent] })\nexport class AppModule {}`)
        ).toEqual(['ng-module', 'entry-components']);
    });

    it('reports RouterModule.forRoot', () => {
        expect(kinds(`const routing = RouterModule.forRoot([]);`)).toEqual(['router-for-root']);
    });

    it('reports RouterModule.forChild', () => {
        expect(kinds(`const routing = RouterModule.forChild([]);`)).toEqual(['router-for-child']);
    });

    it('reports a string loadChildren', () => {
        const findings = scan(
            `const routes = [{ path: 'a', loadChildren: './a/a.module#AModule' }];`
        );
        expect(findings.map(f => [f.kind, f.name])).toEqual([
            ['string-load-children', './a/a.module#AModule']
        ]);
    });

    it('reports an @Input member', () => {
        const findings = scan(`@Component({ selector: 'x', template: '' })
export class XComponent {
    @Input() value: string;
}`);
        expect(findings.map(f => [f.kind, f.name, f.line])).toEqual([
            ['input-decorator', 'XComponent.value', 3]
        ]);
    });

    it('reports an @Output member', () => {
        expect(
            kinds(`@Directive({ selector: '[x]' })
export class XDirective {
    @Output() changed = new EventEmitter<string>();
}`)
        ).toEqual(['output-decorator']);
    });

    it('reports a @HostBinding member', () => {
        expect(
            kinds(`@Directive({ selector: '[x]' })
export class XDirective {
    @HostBinding('class.active') active = true;
}`)
        ).toEqual(['host-binding-decorator']);
    });

    it('reports a @HostListener member', () => {
        expect(
            kinds(`@Directive({ selector: '[x]' })
export class XDirective {
    @HostListener('click') onClick() {}
}`)
        ).toEqual(['host-listener-decorator']);
    });

    it('reports constructor injection on decorated classes only', () => {
        const findings = scan(`@Injectable()
export class DataService {
    constructor(private http: HttpClient) {}
}
export class Plain {
    constructor(public value: number) {}
}`);
        expect(findings.map(f => [f.kind, f.name, f.line])).toEqual([
            ['constructor-injection', 'DataService', 3]
        ]);
    });

    it('reports a class guard once per class', () => {
        expect(
            kinds(`@Injectable()
export class AuthGuard implements CanActivate, CanDeactivate<Page> {
    canActivate() { return true; }
    canDeactivate() { return true; }
}`)
        ).toEqual(['class-guard']);
    });

    it('reports a class interceptor', () => {
        expect(
            kinds(`@Injectable()
export class TokenInterceptor implements HttpInterceptor {
    intercept() {}
}`)
        ).toEqual(['class-interceptor']);
    });

    it('reports a class resolver', () => {
        expect(
            kinds(`@Injectable()
export class UserResolver implements Resolve<User> {
    resolve() {}
}`)
        ).toEqual(['class-resolver']);
    });

    it('reports standalone: false on a declarable only', () => {
        expect(
            kinds(`@Component({ selector: 'x', template: '', standalone: false })
export class XComponent {}
@Component({ selector: 'y', template: '', standalone: true })
export class YComponent {}
@Component({ selector: 'z', template: '' })
export class ZComponent {}`)
        ).toEqual(['standalone-false']);
    });

    it('sorts findings by file, then line', () => {
        const sorted = sortLegacyFindings([
            { kind: 'ng-module', name: 'B', file: 'src/b.ts', line: 3 },
            { kind: 'ng-module', name: 'A2', file: 'src/a.ts', line: 9 },
            { kind: 'ng-module', name: 'A1', file: 'src/a.ts', line: 2 }
        ]);
        expect(sorted.map(f => f.name)).toEqual(['A1', 'A2', 'B']);
    });

    it('groups the notice by kind and caps the locations at 10', () => {
        const inputs: LegacyFinding[] = Array.from({ length: 12 }, (_, i) => ({
            kind: 'input-decorator',
            name: `X.v${i + 1}`,
            file: 'src/x.ts',
            line: i + 1
        }));
        const lines = formatLegacyNotice([
            ...inputs,
            { kind: 'ng-module', name: 'AppModule', file: 'src/app.module.ts', line: 4 }
        ]);
        expect(formatLegacyNotice([])).toEqual([]);
        expect(lines).toHaveLength(3);
        expect(lines[0]).toBe('Angular 21+ only: 13 legacy constructs are not documented');
        expect(lines[1]).toBe('  ng-module (1): src/app.module.ts:4 AppModule');
        expect(lines[2]).toMatch(/^ {2}input-decorator \(12\): src\/x\.ts:1 X\.v1, /);
        expect(lines[2]).toContain('src/x.ts:10 X.v10, ... and 2 more');
        expect(lines[2]).not.toContain('X.v11');
    });
});
