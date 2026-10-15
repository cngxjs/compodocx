import { buildPlaygroundManifest } from '../../../../../src/app/engines/stackblitz/build-playground-manifest';
import {
    STACKBLITZ_FILE_CAP,
    STACKBLITZ_TEMPLATE
} from '../../../../../src/app/engines/stackblitz/constants';
import type { DepGraphNode } from '../../../../../src/app/engines/stackblitz/walk-dep-graph';
import type { ComponentPlaygroundBlock } from '../../../../../src/templates/helpers/jsdoc';

const block: ComponentPlaygroundBlock = {
    title: 'Default state',
    snippet: '<my-button label="Click me" />',
    language: 'html',
    line: 0
};

const rootNode: DepGraphNode = {
    name: 'MyButton',
    file: 'src/app/my-button/my-button.component.ts',
    sourceCode: 'export class MyButton {}\n',
    imports: []
};

const resolverFor = (nodes: DepGraphNode[]) => {
    const map = new Map(nodes.map(n => [n.name, n]));
    return (name: string) => map.get(name) ?? null;
};

const consumerPkg = {
    dependencies: {
        '@angular/core': '^21.0.0',
        '@angular/common': '^21.0.0',
        'random-other-pkg': '^1.0.0'
    }
};

describe('buildPlaygroundManifest', () => {
    it('emits a complete Angular CLI 21 standalone project', () => {
        const result = buildPlaygroundManifest(
            'MyButton',
            block,
            resolverFor([rootNode]),
            consumerPkg
        );
        expect(result.ok).to.be.true;
        if (result.ok === false) {
            return;
        }
        expect(result.value.template).to.equal(STACKBLITZ_TEMPLATE);
        expect(result.value.title).to.equal('Default state');
        expect(result.value.files).to.have.property('package.json');
        expect(result.value.files).to.have.property('angular.json');
        expect(result.value.files).to.have.property('tsconfig.json');
        expect(result.value.files).to.have.property('tsconfig.app.json');
        expect(result.value.files).to.have.property('src/index.html');
        expect(result.value.files).to.have.property('src/styles.css');
        expect(result.value.files).to.have.property('src/main.ts');
        expect(result.value.files).to.have.property('src/app/app.config.ts');
        expect(result.value.files).to.have.property('src/app/app.component.ts');

        const pkg = JSON.parse(result.value.files['package.json']);
        expect(pkg.scripts.start).to.equal('ng serve');
        expect(pkg.dependencies['@angular/core']).to.match(/^\^?\d/);
        expect(pkg.devDependencies['@angular/cli']).to.match(/^\^?\d/);
        expect(pkg.devDependencies['@angular/build']).to.match(/^\^?\d/);
        expect(pkg.devDependencies['@angular/compiler-cli']).to.match(/^\^?\d/);
        expect(pkg.devDependencies.typescript).to.match(/^[~^]?\d/);

        const ng = JSON.parse(result.value.files['angular.json']);
        const proj = ng.projects['compodocx-playground'];
        expect(proj.architect.build.builder).to.equal('@angular/build:application');
        expect(proj.architect.build.options.polyfills).to.deep.equal(['zone.js']);
        expect(proj.architect.build.options.browser).to.equal('src/main.ts');
        expect(proj.architect.serve.builder).to.equal('@angular/build:dev-server');

        expect(result.value.files['src/main.ts']).to.contain('bootstrapApplication(AppComponent');
        expect(result.value.files['src/index.html']).to.contain('<app-root>');
        expect(result.value.files['src/app/app.config.ts']).to.contain(
            'provideZoneChangeDetection'
        );
        expect(result.value.files['src/app/app.component.ts']).to.contain("selector: 'app-root'");

        // SDK options: WebContainer needs startScript='start' to actually run.
        expect(result.value.template).to.equal('node');
        expect(result.value.startScript).to.equal('start');
        expect(result.value.openFile).to.equal('src/app/app.component.ts');
    });

    it("imports the component from the root node's actual file basename, not its class name", () => {
        const result = buildPlaygroundManifest(
            'MyButton',
            block,
            resolverFor([rootNode]),
            consumerPkg
        );
        expect(result.ok).to.be.true;
        if (result.ok === false) {
            return;
        }
        // Root file is `src/app/my-button/my-button.component.ts` — the
        // AppComponent must `import { MyButton } from './my-button.component'`,
        // not `'./MyButton'`.
        const appComponent = result.value.files['src/app/app.component.ts'];
        expect(appComponent).to.contain("from './my-button.component'");
        expect(appComponent).not.to.contain("from './MyButton'");
        expect(appComponent).to.contain('imports: [MyButton]');
    });

    it('respects the dep walker depth cap', () => {
        const nodes: DepGraphNode[] = [
            { ...rootNode, imports: ['DepA'] },
            {
                name: 'DepA',
                file: 'src/app/dep-a.ts',
                sourceCode: 'export class DepA {}',
                imports: ['DepB']
            },
            {
                name: 'DepB',
                file: 'src/app/dep-b.ts',
                sourceCode: 'export class DepB {}',
                imports: []
            }
        ];
        const result = buildPlaygroundManifest('MyButton', block, resolverFor(nodes), consumerPkg, {
            depth: 1
        });
        expect(result.ok).to.be.true;
        if (result.ok === false) {
            return;
        }
        expect(Object.keys(result.value.files)).to.contain('src/app/dep-a.ts');
        expect(Object.keys(result.value.files)).not.to.contain('src/app/dep-b.ts');
    });

    it('returns Result.err when the file-count cap aborts the walk', () => {
        const many = Array.from({ length: 30 }, (_, i) => `Dep${i}`);
        const nodes: DepGraphNode[] = [
            { ...rootNode, imports: many },
            ...many.map(name => ({
                name,
                file: `src/app/${name.toLowerCase()}.ts`,
                sourceCode: `export const ${name} = 1;`,
                imports: []
            }))
        ];
        const result = buildPlaygroundManifest('MyButton', block, resolverFor(nodes), consumerPkg);
        expect(result.ok).to.be.false;
    });

    it('falls back to a known-good Angular major when the consumer omits all peers', () => {
        const result = buildPlaygroundManifest('MyButton', block, resolverFor([rootNode]), {});
        expect(result.ok).to.be.true;
        if (result.ok === false) {
            return;
        }
        // Default fallback bumps with the toolchain. Whatever it is, every
        // Angular peer must share the same version.
        const fallback = result.value.dependencies['@angular/core'];
        expect(fallback).to.match(/^\^?\d/);
        expect(result.value.dependencies['@angular/common']).to.equal(fallback);
        expect(result.value.dependencies['@angular/forms']).to.equal(fallback);
        expect(result.value.dependencies['@angular/compiler']).to.equal(fallback);
    });

    it('aligns every @angular/* peer on the consumer @angular/core version', () => {
        const pkg = { dependencies: { '@angular/core': '^21.0.0' } };
        const result = buildPlaygroundManifest('MyButton', block, resolverFor([rootNode]), pkg);
        expect(result.ok).to.be.true;
        if (result.ok === false) {
            return;
        }
        // None of the other Angular peers were declared by the consumer;
        // they must inherit the @angular/core spec, not fall back independently.
        expect(result.value.dependencies['@angular/common']).to.equal('^21.0.0');
        expect(result.value.dependencies['@angular/router']).to.equal('^21.0.0');
        expect(result.value.dependencies['@angular/platform-browser']).to.equal('^21.0.0');
        expect(result.value.dependencies['@angular/compiler']).to.equal('^21.0.0');
    });

    it('always emits zone.js, rxjs, and tslib peers required for an ng-cli boot', () => {
        const result = buildPlaygroundManifest('MyButton', block, resolverFor([rootNode]), {});
        expect(result.ok).to.be.true;
        if (result.ok === false) {
            return;
        }
        expect(result.value.dependencies).to.have.property('zone.js');
        expect(result.value.dependencies).to.have.property('rxjs');
        expect(result.value.dependencies).to.have.property('tslib');
    });

    it('forwards @angular/material and @angular/cdk only when the consumer declares them', () => {
        const pkg = {
            dependencies: {
                '@angular/core': '^21.0.0',
                '@angular/material': '^21.0.0',
                '@angular/cdk': '^21.0.0'
            }
        };
        const result = buildPlaygroundManifest('MyButton', block, resolverFor([rootNode]), pkg);
        expect(result.ok).to.be.true;
        if (result.ok === false) {
            return;
        }
        expect(result.value.dependencies['@angular/material']).to.equal('^21.0.0');
        expect(result.value.dependencies['@angular/cdk']).to.equal('^21.0.0');
    });

    it('omits @angular/material and @angular/cdk when the consumer does not declare them', () => {
        const result = buildPlaygroundManifest('MyButton', block, resolverFor([rootNode]), {});
        expect(result.ok).to.be.true;
        if (result.ok === false) {
            return;
        }
        expect(result.value.dependencies).not.to.have.property('@angular/material');
        expect(result.value.dependencies).not.to.have.property('@angular/cdk');
    });

    it('auto-detects Material modules in the snippet and wires imports + theme', () => {
        const matBlock: ComponentPlaygroundBlock = {
            ...block,
            snippet:
                '<mat-card><mat-card-content>Hi</mat-card-content></mat-card>' +
                '<button mat-raised-button>Save</button>'
        };
        const result = buildPlaygroundManifest(
            'MyButton',
            matBlock,
            resolverFor([rootNode]),
            consumerPkg
        );
        expect(result.ok).to.be.true;
        if (result.ok === false) {
            return;
        }
        // Auto-pinned because the snippet referenced mat-* tags.
        expect(result.value.dependencies).to.have.property('@angular/material');
        expect(result.value.dependencies).to.have.property('@angular/cdk');

        const appComponent = result.value.files['src/app/app.component.ts'];
        expect(appComponent).to.contain("import { MatCardModule } from '@angular/material/card'");
        expect(appComponent).to.contain(
            "import { MatButtonModule } from '@angular/material/button'"
        );
        expect(appComponent).to.contain('imports: [MyButton, MatButtonModule, MatCardModule]');

        // Prebuilt theme threaded into angular.json's styles list.
        const ng = JSON.parse(result.value.files['angular.json']);
        const styles = ng.projects['compodocx-playground'].architect.build.options.styles;
        expect(styles).to.contain('@angular/material/prebuilt-themes/azure-blue.css');
    });

    it('does not pull Material into the manifest when the snippet is plain HTML', () => {
        const result = buildPlaygroundManifest(
            'MyButton',
            block,
            resolverFor([rootNode]),
            consumerPkg
        );
        expect(result.ok).to.be.true;
        if (result.ok === false) {
            return;
        }
        const appComponent = result.value.files['src/app/app.component.ts'];
        expect(appComponent).not.to.contain('@angular/material');
        const ng = JSON.parse(result.value.files['angular.json']);
        const styles = ng.projects['compodocx-playground'].architect.build.options.styles;
        expect(styles).not.to.contain('@angular/material/prebuilt-themes/azure-blue.css');

        const indexHtml = result.value.files['src/index.html'];
        expect(indexHtml).not.to.contain('mat-typography');
        expect(indexHtml).not.to.contain('Roboto');
    });

    it('injects Roboto/Icons fonts and mat-typography classes when Material is detected', () => {
        const matBlock: ComponentPlaygroundBlock = {
            ...block,
            snippet: '<mat-card>Hi</mat-card>'
        };
        const result = buildPlaygroundManifest(
            'MyButton',
            matBlock,
            resolverFor([rootNode]),
            consumerPkg
        );
        expect(result.ok).to.be.true;
        if (result.ok === false) {
            return;
        }
        const indexHtml = result.value.files['src/index.html'];
        expect(indexHtml).to.contain('fonts.googleapis.com/css2?family=Roboto');
        expect(indexHtml).to.contain('Material+Icons');
        expect(indexHtml).to.contain('<body class="mat-typography mat-app-background">');
    });

    describe('Material shell (decoupled from module wiring)', () => {
        const scssBundle = (scss: string) => ({
            entry: '/repo/src/app/my-button/my-button.component.ts',
            files: { 'src/app/my-button.component.scss': scss },
            bareSpecifiers: new Set<string>(),
            replacesAppComponent: false
        });

        it('emits the shell when a bundled file @use-s a Material theme bridge, without pulling @angular/material', () => {
            // `block` is plain `<my-button .../>` — no `<mat-*>`, so the
            // element/directive auto-detect never fires. The heuristic does.
            const result = buildPlaygroundManifest(
                'MyButton',
                block,
                resolverFor([rootNode]),
                consumerPkg,
                {},
                scssBundle("@use '@cngx/themes/material/azure-theme';\n:host { display: block; }\n")
            );
            expect(result.ok).to.be.true;
            if (result.ok === false) {
                return;
            }
            const indexHtml = result.value.files['src/index.html'];
            expect(indexHtml).to.contain(
                '<link rel="preconnect" href="https://fonts.googleapis.com">'
            );
            expect(indexHtml).to.contain('https://fonts.googleapis.com/css2?family=Roboto');
            expect(indexHtml).to.contain('Material+Icons');
            expect(indexHtml).to.contain('<body class="mat-typography mat-app-background">');
            // Shell only — NOT the Material module wiring.
            expect(result.value.dependencies).not.to.have.property('@angular/material');
            expect(result.value.dependencies).not.to.have.property('@angular/cdk');
            const ng = JSON.parse(result.value.files['angular.json']);
            const styles = ng.projects['compodocx-playground'].architect.build.options.styles;
            expect(styles).not.to.contain('@angular/material/prebuilt-themes/azure-blue.css');
        });

        it('forces the shell on a plain non-Material playground when materialShell is set', () => {
            const result = buildPlaygroundManifest(
                'MyButton',
                block,
                resolverFor([rootNode]),
                consumerPkg,
                { materialShell: true }
            );
            expect(result.ok).to.be.true;
            if (result.ok === false) {
                return;
            }
            const indexHtml = result.value.files['src/index.html'];
            expect(indexHtml).to.contain('css2?family=Roboto');
            expect(indexHtml).to.contain('<body class="mat-typography mat-app-background">');
            expect(result.value.dependencies).not.to.have.property('@angular/material');
            expect(result.value.dependencies).not.to.have.property('@angular/cdk');
        });

        it('leaves index.html bare for a plain non-Material playground (no heuristic, no flag)', () => {
            const result = buildPlaygroundManifest(
                'MyButton',
                block,
                resolverFor([rootNode]),
                consumerPkg,
                {},
                scssBundle(':host { color: rebeccapurple; }\n')
            );
            expect(result.ok).to.be.true;
            if (result.ok === false) {
                return;
            }
            const indexHtml = result.value.files['src/index.html'];
            expect(indexHtml).not.to.contain('mat-typography');
            expect(indexHtml).not.to.contain('Roboto');
            expect(result.value.dependencies).not.to.have.property('@angular/material');
        });

        it('never emits the shell twice when both <mat-*> auto-detect and the theme-bridge heuristic match', () => {
            const matBlock: ComponentPlaygroundBlock = {
                ...block,
                snippet: '<mat-card>Hi</mat-card>'
            };
            const result = buildPlaygroundManifest(
                'MyButton',
                matBlock,
                resolverFor([rootNode]),
                consumerPkg,
                { materialShell: true },
                scssBundle("@use './material/brand-theme';\n")
            );
            expect(result.ok).to.be.true;
            if (result.ok === false) {
                return;
            }
            const indexHtml = result.value.files['src/index.html'];
            expect(indexHtml.split('css2?family=Roboto').length - 1).to.equal(1);
            expect(indexHtml.split('mat-typography mat-app-background').length - 1).to.equal(1);
            // Real auto-detect fired → module wiring IS present.
            expect(result.value.dependencies).to.have.property('@angular/material');
        });
    });

    describe('@playgroundConfig bundle (P1)', () => {
        it('a config-only bundle overrides the scaffold app.config.ts on an inline block', () => {
            // What PlaygroundFileResolver produces for an inline block carrying
            // `@playgroundConfig`: no htmlSnippet, replacesAppComponent false,
            // files carry the author's app.config.ts (+ deps).
            const configBundle = {
                entry: '/repo/src/app/playground/app.config.ts',
                files: {
                    'src/app/app.config.ts':
                        "import { provideRouter } from '@angular/router';\n" +
                        "import { routes } from './routes';\n" +
                        'export const appConfig = { providers: [provideRouter(routes)] };\n',
                    'src/app/routes.ts': 'export const routes = [];\n'
                },
                bareSpecifiers: new Set<string>(['@angular/router']),
                replacesAppComponent: false
            };
            const result = buildPlaygroundManifest(
                'MyButton',
                block,
                resolverFor([rootNode]),
                { dependencies: { '@angular/core': '^21.0.0', '@angular/router': '^21.0.0' } },
                {},
                configBundle
            );
            expect(result.ok).to.be.true;
            if (result.ok === false) {
                return;
            }
            // Author config wins over the default scaffold config.
            expect(result.value.files['src/app/app.config.ts']).to.contain('provideRouter');
            expect(result.value.files['src/app/app.config.ts']).not.to.contain(
                'provideZoneChangeDetection'
            );
            // Its relative dep ships too.
            expect(result.value.files['src/app/routes.ts']).to.equal('export const routes = [];\n');
            // main.ts still wires bootstrapApplication(AppComponent, appConfig).
            expect(result.value.files['src/main.ts']).to.contain(
                'bootstrapApplication(AppComponent, appConfig)'
            );
            // Inline block still drives the AppComponent (config-only bundle).
            expect(result.value.files['src/app/app.component.ts']).to.contain('@Component');
        });
    });

    describe('custom <head> and global styles (P1)', () => {
        it('appends playgroundHead entries into index.html <head>', () => {
            const result = buildPlaygroundManifest(
                'MyButton',
                block,
                resolverFor([rootNode]),
                consumerPkg,
                {
                    head: [
                        '<link rel="stylesheet" href="https://example.com/font.css">',
                        '<meta name="x" content="y">'
                    ]
                }
            );
            expect(result.ok).to.be.true;
            if (result.ok === false) {
                return;
            }
            const indexHtml = result.value.files['src/index.html'];
            expect(indexHtml).to.contain('https://example.com/font.css');
            expect(indexHtml).to.contain('<meta name="x" content="y">');
            // Inserted inside <head>, before the closing tag.
            expect(indexHtml.indexOf('example.com/font.css')).to.be.lessThan(
                indexHtml.indexOf('</head>')
            );
        });

        it('appends playgroundGlobalStyles verbatim after the body reset in styles.css', () => {
            const result = buildPlaygroundManifest(
                'MyButton',
                block,
                resolverFor([rootNode]),
                consumerPkg,
                { globalStyles: ':root { --brand: #06f; }' }
            );
            expect(result.ok).to.be.true;
            if (result.ok === false) {
                return;
            }
            const styles = result.value.files['src/styles.css'];
            expect(styles).to.contain('--brand: #06f;');
            // After the default body reset, not replacing it.
            expect(styles).to.contain('font-family: system-ui');
            expect(styles.indexOf('font-family')).to.be.lessThan(styles.indexOf('--brand'));
        });

        it('hoists a leading @import ABOVE the body reset (CSS drops preludes after a rule)', () => {
            const result = buildPlaygroundManifest(
                'MyButton',
                block,
                resolverFor([rootNode]),
                consumerPkg,
                { globalStyles: "@import 'https://fonts.example/x.css';\n:root { --brand: #06f; }" }
            );
            expect(result.ok).to.be.true;
            if (result.ok === false) {
                return;
            }
            const styles = result.value.files['src/styles.css'];
            expect(styles.indexOf('@import')).to.be.lessThan(styles.indexOf('font-family'));
            expect(styles.indexOf('font-family')).to.be.lessThan(styles.indexOf('--brand'));
            // @import is valid CSS — the sheet stays .css, no .scss is emitted.
            expect(result.value.files).to.not.have.property('src/styles.scss');
        });

        it('ships styles as .scss and wires angular.json when globalStyles carry a Sass @use', () => {
            const result = buildPlaygroundManifest(
                'MyButton',
                block,
                resolverFor([rootNode]),
                consumerPkg,
                {
                    globalStyles:
                        "@use '@cngx/themes/material/azure-theme' as t;\nbody { background: #fff; }"
                }
            );
            expect(result.ok).to.be.true;
            if (result.ok === false) {
                return;
            }
            // Sass-only prelude ⇒ the global sheet must be .scss so the Angular
            // builder actually compiles it; the .css variant is gone.
            expect(result.value.files).to.have.property('src/styles.scss');
            expect(result.value.files).to.not.have.property('src/styles.css');
            const styles = result.value.files['src/styles.scss'];
            // @use hoisted to the very top (Sass errors if it follows any rule).
            expect(styles.indexOf('@use')).to.be.lessThan(styles.indexOf('font-family'));
            expect(styles.indexOf('font-family')).to.be.lessThan(styles.indexOf('background'));
            // angular.json points the styles entry at the .scss file.
            const angularJson = result.value.files['angular.json'];
            expect(angularJson).to.contain('src/styles.scss');
            expect(angularJson).to.not.contain('src/styles.css');
        });

        it('composes custom head with the Material shell (shell links first)', () => {
            const result = buildPlaygroundManifest(
                'MyButton',
                block,
                resolverFor([rootNode]),
                consumerPkg,
                { materialShell: true, head: ['<meta name="after-shell" content="1">'] }
            );
            expect(result.ok).to.be.true;
            if (result.ok === false) {
                return;
            }
            const indexHtml = result.value.files['src/index.html'];
            expect(indexHtml.indexOf('css2?family=Roboto')).to.be.lessThan(
                indexHtml.indexOf('after-shell')
            );
        });

        it('drops blank head entries and leaves output unchanged for empty inputs', () => {
            const result = buildPlaygroundManifest(
                'MyButton',
                block,
                resolverFor([rootNode]),
                consumerPkg,
                { head: ['', '   '], globalStyles: '   ' }
            );
            expect(result.ok).to.be.true;
            if (result.ok === false) {
                return;
            }
            const base = buildPlaygroundManifest(
                'MyButton',
                block,
                resolverFor([rootNode]),
                consumerPkg
            );
            if (base.ok === false) {
                return;
            }
            expect(result.value.files['src/index.html']).to.equal(
                base.value.files['src/index.html']
            );
            expect(result.value.files['src/styles.css']).to.equal(
                base.value.files['src/styles.css']
            );
        });
    });

    it('preserves the snippet language inside the demo component template', () => {
        const tsBlock: ComponentPlaygroundBlock = {
            ...block,
            snippet: 'const x = 1;',
            language: 'typescript'
        };
        const result = buildPlaygroundManifest(
            'MyButton',
            tsBlock,
            resolverFor([rootNode]),
            consumerPkg
        );
        expect(result.ok).to.be.true;
        if (result.ok === false) {
            return;
        }
        const appComponent = result.value.files['src/app/app.component.ts'];
        expect(appComponent).to.contain('<pre><code>const x = 1;</code></pre>');
    });

    it('caps oversized source files at STACKBLITZ_FILE_CAP via the file emitter (F23/F24)', () => {
        const fat: DepGraphNode = {
            ...rootNode,
            sourceCode: 'a'.repeat(STACKBLITZ_FILE_CAP * 2)
        };
        const result = buildPlaygroundManifest('MyButton', block, resolverFor([fat]), consumerPkg);
        expect(result.ok).to.be.true;
        if (result.ok === false) {
            return;
        }
        const fileBody = result.value.files['src/app/my-button.component.ts'];
        expect(fileBody.length).to.be.lessThan(STACKBLITZ_FILE_CAP * 2);
        expect(fileBody).to.contain('truncated by compodocx');
    });

    it('honours a custom fileCap (playgroundFileCap) at the emitter', () => {
        const fat: DepGraphNode = {
            ...rootNode,
            sourceCode: 'a'.repeat(2000)
        };
        const result = buildPlaygroundManifest('MyButton', block, resolverFor([fat]), consumerPkg, {
            fileCap: 500
        });
        expect(result.ok).to.be.true;
        if (result.ok === false) {
            return;
        }
        const fileBody = result.value.files['src/app/my-button.component.ts'];
        // Truncated at the custom 500-char cap (+ footer), not the 8000 default.
        expect(fileBody).to.contain('truncated by compodocx');
        expect(fileBody.length).to.be.lessThan(1000);
    });

    it('surfaces the file-count cap error naming the playground component', () => {
        const many = Array.from({ length: 30 }, (_, i) => `Dep${i}`);
        const nodes: DepGraphNode[] = [
            { ...rootNode, imports: many },
            ...many.map(name => ({
                name,
                file: `src/app/${name.toLowerCase()}.ts`,
                sourceCode: `export const ${name} = 1;`,
                imports: []
            }))
        ];
        const result = buildPlaygroundManifest('MyButton', block, resolverFor(nodes), consumerPkg, {
            maxFiles: 5
        });
        expect(result.ok).to.be.false;
        if (result.ok === true) {
            return;
        }
        expect(result.message).to.contain('"MyButton"');
        expect(result.message).to.contain('playgroundFileCountCap');
        expect(result.message).to.contain('Walked:');
    });

    it('produces byte-equal manifests for the same input (idempotency)', () => {
        const a = buildPlaygroundManifest('MyButton', block, resolverFor([rootNode]), consumerPkg);
        const b = buildPlaygroundManifest('MyButton', block, resolverFor([rootNode]), consumerPkg);
        expect(a.ok && b.ok).to.be.true;
        if (a.ok && b.ok) {
            expect(JSON.stringify(a.value)).to.equal(JSON.stringify(b.value));
        }
    });

    it('auto-forwards a third-party library imported by the inlined component source', () => {
        const node: DepGraphNode = {
            ...rootNode,
            sourceCode:
                "import { CngxButton } from '@my-org/ui-kit';\n" +
                "import { fmt } from 'date-helper';\n" +
                'export class MyButton {}\n',
            imports: []
        };
        const pkg = {
            dependencies: {
                '@angular/core': '^21.0.0',
                '@my-org/ui-kit': '^2.5.0',
                'date-helper': '~1.0.3'
            }
        };
        const result = buildPlaygroundManifest('MyButton', block, resolverFor([node]), pkg);
        expect(result.ok).to.be.true;
        if (result.ok === false) {
            return;
        }
        expect(result.value.dependencies['@my-org/ui-kit']).to.equal('^2.5.0');
        expect(result.value.dependencies['date-helper']).to.equal('~1.0.3');
    });

    it('skips auto-forwarded libraries the consumer does not declare', () => {
        const node: DepGraphNode = {
            ...rootNode,
            sourceCode: "import { X } from '@unknown/lib';\nexport class MyButton {}\n",
            imports: []
        };
        const result = buildPlaygroundManifest('MyButton', block, resolverFor([node]), consumerPkg);
        expect(result.ok).to.be.true;
        if (result.ok === false) {
            return;
        }
        expect(result.value.dependencies).not.to.have.property('@unknown/lib');
    });

    it('also picks up third-party packages referenced in the snippet itself', () => {
        const tsBlock: ComponentPlaygroundBlock = {
            title: 'Snippet import',
            snippet: "import { thing } from '@my-org/icons';\nconst x = thing();",
            language: 'typescript',
            line: 0
        };
        const pkg = {
            dependencies: {
                '@angular/core': '^21.0.0',
                '@my-org/icons': '^4.0.0'
            }
        };
        const result = buildPlaygroundManifest('MyButton', tsBlock, resolverFor([rootNode]), pkg);
        expect(result.ok).to.be.true;
        if (result.ok === false) {
            return;
        }
        expect(result.value.dependencies['@my-org/icons']).to.equal('^4.0.0');
    });

    it('resolves deep imports back to the package root for the lookup', () => {
        const node: DepGraphNode = {
            ...rootNode,
            sourceCode:
                "import { cloneDeep } from 'lodash-es/cloneDeep';\n" +
                "import { Sub } from '@my-org/ui-kit/button';\n" +
                'export class MyButton {}\n',
            imports: []
        };
        const pkg = {
            dependencies: {
                '@angular/core': '^21.0.0',
                'lodash-es': '^4.17.21',
                '@my-org/ui-kit': '^2.0.0'
            }
        };
        const result = buildPlaygroundManifest('MyButton', block, resolverFor([node]), pkg);
        expect(result.ok).to.be.true;
        if (result.ok === false) {
            return;
        }
        expect(result.value.dependencies['lodash-es']).to.equal('^4.17.21');
        expect(result.value.dependencies['@my-org/ui-kit']).to.equal('^2.0.0');
    });

    it('does not auto-forward Angular peers as third-party packages (already handled)', () => {
        const node: DepGraphNode = {
            ...rootNode,
            sourceCode: "import { Component } from '@angular/core';\nexport class MyButton {}\n",
            imports: []
        };
        const result = buildPlaygroundManifest('MyButton', block, resolverFor([node]), consumerPkg);
        expect(result.ok).to.be.true;
        if (result.ok === false) {
            return;
        }
        // Already pinned via ANGULAR_PEERS at consumer's @angular/core spec.
        expect(result.value.dependencies['@angular/core']).to.equal('^21.0.0');
    });

    it('honours extraDependencies as the final override (wins over consumer-pkg lookup)', () => {
        const node: DepGraphNode = {
            ...rootNode,
            sourceCode: "import { CngxButton } from '@my-org/ui-kit';\nexport class MyButton {}\n",
            imports: []
        };
        const pkg = {
            dependencies: { '@angular/core': '^21.0.0', '@my-org/ui-kit': '^2.5.0' }
        };
        const result = buildPlaygroundManifest('MyButton', block, resolverFor([node]), pkg, {
            extraDependencies: { '@my-org/ui-kit': '^3.0.0-next.1', '@my-org/themes': '*' }
        });
        expect(result.ok).to.be.true;
        if (result.ok === false) {
            return;
        }
        // Override beats consumer-declared version.
        expect(result.value.dependencies['@my-org/ui-kit']).to.equal('^3.0.0-next.1');
        // Extra dep with no consumer entry still gets pinned.
        expect(result.value.dependencies['@my-org/themes']).to.equal('*');
    });

    describe('non-registry dependency sources (P0a)', () => {
        // `playgroundDependencies` (→ extraDependencies) and the consumer-pkg
        // auto-forward path both thread version SPECIFIERS through verbatim:
        // no semver coercion, no `latest`-pinning. So anything npm understands
        // as a dependency value works — exact prereleases, dist-tags, tarball
        // URLs, and git refs — letting a playground pin an unpublished build
        // without waiting for a registry release.
        const NON_REGISTRY_SOURCES: Record<string, string> = {
            '@my-org/exact-prerelease': '0.1.0-rc.2',
            '@my-org/dist-tag': 'next',
            '@my-org/tarball': 'https://example.com/pkg/my-org-ui-1.2.3.tgz',
            '@my-org/git-ref': 'git+https://github.com/my-org/ui.git#feature/tabs'
        };

        it('threads every non-registry source through extraDependencies unchanged', () => {
            const result = buildPlaygroundManifest(
                'MyButton',
                block,
                resolverFor([rootNode]),
                {
                    dependencies: { '@angular/core': '^21.0.0' }
                },
                { extraDependencies: NON_REGISTRY_SOURCES }
            );
            expect(result.ok).to.be.true;
            if (result.ok === false) {
                return;
            }
            const pkg = JSON.parse(result.value.files['package.json']);
            for (const [name, spec] of Object.entries(NON_REGISTRY_SOURCES)) {
                expect(result.value.dependencies[name]).to.equal(spec);
                // Must survive JSON serialisation into the emitted package.json.
                expect(pkg.dependencies[name]).to.equal(spec);
            }
        });

        it('forwards a non-registry source declared in the consumer package.json verbatim', () => {
            const node: DepGraphNode = {
                ...rootNode,
                sourceCode:
                    "import { CngxButton } from '@my-org/ui-kit';\nexport class MyButton {}\n",
                imports: []
            };
            const pkg = {
                dependencies: {
                    '@angular/core': '^21.0.0',
                    '@my-org/ui-kit': 'git+https://github.com/my-org/ui.git#next'
                }
            };
            const result = buildPlaygroundManifest('MyButton', block, resolverFor([node]), pkg);
            expect(result.ok).to.be.true;
            if (result.ok === false) {
                return;
            }
            expect(result.value.dependencies['@my-org/ui-kit']).to.equal(
                'git+https://github.com/my-org/ui.git#next'
            );
        });
    });

    describe('vendoring (P0b)', () => {
        const vendorPackages = {
            '@cngx/ui': {
                name: '@cngx/ui',
                files: {
                    'package.json': '{"name":"@cngx/ui"}',
                    'fesm2022/cngx-ui.mjs': 'export const Ui = 1;',
                    // Secondary entry point — must ship so `@cngx/ui/tabs` resolves.
                    'tabs/package.json': '{"name":"@cngx/ui/tabs"}'
                },
                vendorDeps: ['@cngx/common'],
                byteSize: 60
            },
            '@cngx/common': {
                name: '@cngx/common',
                files: {
                    'package.json': '{"name":"@cngx/common"}',
                    'fesm2022/cngx-common.mjs': 'export const C = 1;'
                },
                vendorDeps: [],
                byteSize: 40
            },
            '@cngx/unused': {
                name: '@cngx/unused',
                files: { 'package.json': '{"name":"@cngx/unused"}' },
                vendorDeps: [],
                byteSize: 20
            }
        };
        // Imports a SECONDARY entry of a vendored package — the bare-spec scan
        // resolves it back to the `@cngx/ui` root for the closure seed.
        const importingNode: DepGraphNode = {
            ...rootNode,
            sourceCode: "import { Tabs } from '@cngx/ui/tabs';\nexport class MyButton {}\n",
            imports: []
        };

        it('embeds the import closure as file: deps and drops the registry version', () => {
            const pkg = {
                dependencies: { '@angular/core': '^21.0.0', '@cngx/ui': '^1.0.0' }
            };
            const result = buildPlaygroundManifest(
                'MyButton',
                block,
                resolverFor([importingNode]),
                pkg,
                { vendor: { packages: vendorPackages } }
            );
            expect(result.ok).to.be.true;
            if (result.ok === false) {
                return;
            }
            // file: entry is authoritative — the auto-forwarded ^1.0.0 is gone.
            expect(result.value.dependencies['@cngx/ui']).to.equal('file:vendor/@cngx/ui');
            // Transitive vendor closure is wired too — never pulled from npm.
            expect(result.value.dependencies['@cngx/common']).to.equal('file:vendor/@cngx/common');
            // Files embedded under vendor/<pkg>/, secondary entry preserved.
            expect(result.value.files).to.have.property('vendor/@cngx/ui/fesm2022/cngx-ui.mjs');
            expect(result.value.files).to.have.property('vendor/@cngx/ui/tabs/package.json');
            expect(result.value.files).to.have.property(
                'vendor/@cngx/common/fesm2022/cngx-common.mjs'
            );
            // A vendored package nothing imports is neither wired nor shipped.
            expect(result.value.dependencies).not.to.have.property('@cngx/unused');
            expect(result.value.files).not.to.have.property('vendor/@cngx/unused/package.json');
            // The emitted package.json carries the file: dep.
            const rootPkg = JSON.parse(result.value.files['package.json']);
            expect(rootPkg.dependencies['@cngx/ui']).to.equal('file:vendor/@cngx/ui');
        });

        it('is a no-op when the playground imports nothing vendored', () => {
            const pkg = { dependencies: { '@angular/core': '^21.0.0' } };
            const result = buildPlaygroundManifest(
                'MyButton',
                block,
                resolverFor([rootNode]),
                pkg,
                { vendor: { packages: vendorPackages } }
            );
            expect(result.ok).to.be.true;
            if (result.ok === false) {
                return;
            }
            expect(result.value.dependencies).not.to.have.property('@cngx/ui');
            expect(Object.keys(result.value.files).some(p => p.startsWith('vendor/'))).to.be.false;
        });

        it('ships vendored files raw — bypasses the per-file truncation cap', () => {
            const big = 'x'.repeat(STACKBLITZ_FILE_CAP + 5000);
            const vp = {
                '@cngx/ui': {
                    name: '@cngx/ui',
                    files: {
                        'package.json': '{"name":"@cngx/ui"}',
                        'fesm2022/big.mjs': big
                    },
                    vendorDeps: [],
                    byteSize: big.length + 20
                }
            };
            const pkg = { dependencies: { '@angular/core': '^21.0.0' } };
            const result = buildPlaygroundManifest(
                'MyButton',
                block,
                resolverFor([importingNode]),
                pkg,
                { vendor: { packages: vp } }
            );
            expect(result.ok).to.be.true;
            if (result.ok === false) {
                return;
            }
            // Full FESM body survives — a truncated bundle would be broken.
            expect(result.value.files['vendor/@cngx/ui/fesm2022/big.mjs'].length).to.equal(
                big.length
            );
        });

        it('fails with a named per-package breakdown when the closure blows the cap', () => {
            const pkg = { dependencies: { '@angular/core': '^21.0.0' } };
            const result = buildPlaygroundManifest(
                'MyButton',
                block,
                resolverFor([importingNode]),
                pkg,
                { vendor: { packages: vendorPackages, totalCap: 50 } }
            );
            // Closure @cngx/ui (60) + @cngx/common (40) = 100 B > 50 B cap.
            expect(result.ok).to.be.false;
            if (result.ok === true) {
                return;
            }
            expect(result.message).to.contain('@cngx/ui');
            expect(result.message).to.contain('over the 50');
        });

        it('seeds the vendor closure from an SCSS @use specifier', () => {
            const themesPkg = {
                '@cngx/themes': {
                    name: '@cngx/themes',
                    files: {
                        'package.json': '{"name":"@cngx/themes"}',
                        'material/x-theme.scss': '/* theme */'
                    },
                    vendorDeps: [],
                    byteSize: 50
                }
            };
            // No TS import of @cngx/themes — only an SCSS @use in the styles.
            const node: DepGraphNode = {
                ...rootNode,
                sourceCode:
                    '@Component({ styles: ["@use \'@cngx/themes/material/x-theme\';"] })\n' +
                    'export class MyButton {}\n',
                imports: []
            };
            const result = buildPlaygroundManifest(
                'MyButton',
                block,
                resolverFor([node]),
                { dependencies: { '@angular/core': '^21.0.0' } },
                { vendor: { packages: themesPkg } }
            );
            expect(result.ok).to.be.true;
            if (result.ok === false) {
                return;
            }
            expect(result.value.dependencies['@cngx/themes']).to.equal('file:vendor/@cngx/themes');
            expect(result.value.files).to.have.property(
                'vendor/@cngx/themes/material/x-theme.scss'
            );
        });

        it('cap error names the StackBlitz POST limit when the closure exceeds it', () => {
            const huge = 'x'.repeat(2_100_000);
            const vp = {
                '@cngx/ui': {
                    name: '@cngx/ui',
                    files: { 'package.json': '{"name":"@cngx/ui"}', 'fesm2022/huge.mjs': huge },
                    vendorDeps: [],
                    byteSize: huge.length
                }
            };
            const result = buildPlaygroundManifest(
                'MyButton',
                block,
                resolverFor([importingNode]),
                { dependencies: { '@angular/core': '^21.0.0' } },
                { vendor: { packages: vp } } // default cap (1.5 MB) < 2.1 MB
            );
            expect(result.ok).to.be.false;
            if (result.ok === true) {
                return;
            }
            expect(result.message).to.contain('after slimming + pruning');
            expect(result.message).to.contain('413');
        });
    });

    it('emits POSIX paths only — never backslashes (F2)', () => {
        const winPath: DepGraphNode = {
            ...rootNode,
            file: 'src\\app\\my-button.component.ts'
        };
        const result = buildPlaygroundManifest(
            'MyButton',
            block,
            resolverFor([winPath]),
            consumerPkg
        );
        expect(result.ok).to.be.true;
        if (result.ok === false) {
            return;
        }
        for (const path of Object.keys(result.value.files)) {
            expect(path).not.to.contain('\\');
        }
    });

    describe('file-bundle modes', () => {
        const fileRefBlock: ComponentPlaygroundBlock = {
            title: 'External example',
            line: 0,
            fileRef: './examples/full.component.ts'
        };

        it('HTML-mode fileBundle: htmlSnippet becomes the AppComponent template', () => {
            const fileBundle = {
                entry: '/repo/src/app/examples/inline.html',
                files: {},
                bareSpecifiers: new Set<string>(),
                replacesAppComponent: false,
                htmlSnippet: '<mat-card>Hello</mat-card>'
            };
            const result = buildPlaygroundManifest(
                'MyButton',
                fileRefBlock,
                resolverFor([rootNode]),
                consumerPkg,
                {},
                fileBundle
            );
            expect(result.ok).to.be.true;
            if (result.ok === false) {
                return;
            }
            // The AppComponent template carries the html-mode body
            expect(result.value.files['src/app/app.component.ts']).to.contain(
                '<mat-card>Hello</mat-card>'
            );
            // Material auto-detected → @angular/material force-pinned
            expect(result.value.dependencies).to.have.property('@angular/material');
            expect(result.value.dependencies).to.have.property('@angular/cdk');
        });

        it('TS-mode fileBundle: entry source replaces the AppComponent verbatim', () => {
            const entrySource =
                "import { Component } from '@angular/core';\n" +
                "import { MyButton } from './my-button.component';\n" +
                '@Component({\n' +
                "    selector: 'app-root',\n" +
                '    standalone: true,\n' +
                '    imports: [MyButton],\n' +
                "    template: '<my-button>Hi</my-button>'\n" +
                '})\n' +
                'export class AppEntry {}\n';
            const fileBundle = {
                entry: '/repo/src/app/examples/full.component.ts',
                files: {
                    'src/app/app.component.ts': entrySource,
                    'src/app/extra.helper.ts': 'export const x = 1;\n'
                },
                bareSpecifiers: new Set<string>(['@angular/core']),
                replacesAppComponent: true
            };
            const result = buildPlaygroundManifest(
                'MyButton',
                fileRefBlock,
                resolverFor([rootNode]),
                consumerPkg,
                {},
                fileBundle
            );
            expect(result.ok).to.be.true;
            if (result.ok === false) {
                return;
            }
            expect(result.value.files['src/app/app.component.ts']).to.contain('class AppEntry');
            // BFS-walked sibling shipped flat
            expect(result.value.files['src/app/extra.helper.ts']).to.contain('export const x = 1');
        });

        it('TS-mode fileBundle: bareSpecifiers feed auto-forward', () => {
            const consumerWithUiKit = {
                dependencies: {
                    '@angular/core': '^21.0.0',
                    '@my-org/ui-kit': '^2.5.0'
                }
            };
            const fileBundle = {
                entry: '/repo/src/app/examples/full.component.ts',
                files: { 'src/app/app.component.ts': 'export class AppEntry {}' },
                bareSpecifiers: new Set<string>(['@my-org/ui-kit', '@angular/core']),
                replacesAppComponent: true
            };
            const result = buildPlaygroundManifest(
                'MyButton',
                fileRefBlock,
                resolverFor([rootNode]),
                consumerWithUiKit,
                {},
                fileBundle
            );
            expect(result.ok).to.be.true;
            if (result.ok === false) {
                return;
            }
            expect(result.value.dependencies['@my-org/ui-kit']).to.equal('^2.5.0');
        });

        it('TS-mode fileBundle: dep-graph walked nodes are NOT emitted', () => {
            // The entry source replaces AppComponent and imports the
            // documented component via bare specifier — the walked
            // `my-button.component.ts` source would be dead weight in the
            // StackBlitz file tree, so the emit loop is skipped entirely.
            const fileBundle = {
                entry: '/repo/src/app/examples/full.component.ts',
                files: {
                    'src/app/app.component.ts': 'export class AppEntry {}'
                },
                bareSpecifiers: new Set<string>(),
                replacesAppComponent: true
            };
            const result = buildPlaygroundManifest(
                'MyButton',
                fileRefBlock,
                resolverFor([rootNode]),
                consumerPkg,
                {},
                fileBundle
            );
            expect(result.ok).to.be.true;
            if (result.ok === false) {
                return;
            }
            expect(result.value.files).to.not.have.property('src/app/my-button.component.ts');
        });

        it('TS-mode fileBundle: a bundle file at the walked-node key still ships', () => {
            // Pre-fix the bundle copy "overrode" the walked copy on the same
            // key. Post-fix the walked emit is skipped, but a bundle entry
            // under the same path still lands in the output — when the
            // example happens to import the documented component via a
            // relative path that read-file-ref packed flat.
            const fileBundle = {
                entry: '/repo/src/app/examples/full.component.ts',
                files: {
                    'src/app/app.component.ts': 'export class AppEntry {}',
                    'src/app/my-button.component.ts': 'export class MyButton { /* rewritten */ }\n'
                },
                bareSpecifiers: new Set<string>(),
                replacesAppComponent: true
            };
            const result = buildPlaygroundManifest(
                'MyButton',
                fileRefBlock,
                resolverFor([rootNode]),
                consumerPkg,
                {},
                fileBundle
            );
            expect(result.ok).to.be.true;
            if (result.ok === false) {
                return;
            }
            expect(result.value.files['src/app/my-button.component.ts']).to.contain(
                '/* rewritten */'
            );
        });

        it('inline + HTML-mode still emit dep-graph walked nodes', () => {
            // Regression guard for the `!replacesAppComponent` branch — the
            // inline (no fileBundle) and HTML-mode paths must still inline
            // the documented component so the AppComponent's
            // `import { MyButton } from './my-button.component'` resolves.
            const inlineResult = buildPlaygroundManifest(
                'MyButton',
                block,
                resolverFor([rootNode]),
                consumerPkg
            );
            expect(inlineResult.ok).to.be.true;
            if (inlineResult.ok === false) {
                return;
            }
            expect(inlineResult.value.files).to.have.property('src/app/my-button.component.ts');

            const htmlBundle = {
                entry: '/repo/src/app/examples/inline.html',
                files: {},
                bareSpecifiers: new Set<string>(),
                replacesAppComponent: false,
                htmlSnippet: '<my-button>Hi</my-button>'
            };
            const htmlResult = buildPlaygroundManifest(
                'MyButton',
                fileRefBlock,
                resolverFor([rootNode]),
                consumerPkg,
                {},
                htmlBundle
            );
            expect(htmlResult.ok).to.be.true;
            if (htmlResult.ok === false) {
                return;
            }
            expect(htmlResult.value.files).to.have.property('src/app/my-button.component.ts');
        });

        it('HTML-mode + extraDependencies: override still wins', () => {
            const fileBundle = {
                entry: '/repo/src/app/examples/inline.html',
                files: {},
                bareSpecifiers: new Set<string>(),
                replacesAppComponent: false,
                htmlSnippet: '<my-button>Hi</my-button>'
            };
            const result = buildPlaygroundManifest(
                'MyButton',
                fileRefBlock,
                resolverFor([rootNode]),
                consumerPkg,
                { extraDependencies: { 'random-other-pkg': '^9.9.9' } },
                fileBundle
            );
            expect(result.ok).to.be.true;
            if (result.ok === false) {
                return;
            }
            expect(result.value.dependencies['random-other-pkg']).to.equal('^9.9.9');
        });

        it('TS-mode fileBundle: file-cap on individual files still applies', () => {
            const oversized = 'x'.repeat(STACKBLITZ_FILE_CAP + 200);
            const fileBundle = {
                entry: '/repo/src/app/examples/full.component.ts',
                files: {
                    'src/app/app.component.ts': 'export class AppEntry {}',
                    'src/app/big.helper.ts': oversized
                },
                bareSpecifiers: new Set<string>(),
                replacesAppComponent: true
            };
            const result = buildPlaygroundManifest(
                'MyButton',
                fileRefBlock,
                resolverFor([rootNode]),
                consumerPkg,
                {},
                fileBundle
            );
            expect(result.ok).to.be.true;
            if (result.ok === false) {
                return;
            }
            // emitFileContent applies the cap → truncated copy under file cap
            expect(result.value.files['src/app/big.helper.ts'].length).to.be.lessThan(
                oversized.length
            );
        });
    });
});
