import {
    type FsReader,
    readFileRef,
    readPlaygroundConfig
} from '../../../../../src/app/engines/stackblitz/read-file-ref';

const fsFor = (files: Record<string, string>): FsReader => ({
    readFile: (path: string) => (path in files ? files[path] : null),
    exists: (path: string) => path in files
});

const HOST = '/repo/src/app/button.component.ts';

describe('readFileRef — HTML mode', () => {
    it('returns the file body as htmlSnippet without walking imports', () => {
        const fs = fsFor({
            '/repo/src/app/examples/inline.html': '<my-button>X</my-button>'
        });
        const result = readFileRef('./examples/inline.html', HOST, fs);
        expect(result.ok).to.be.true;
        if (result.ok === false) {
            return;
        }
        expect(result.value.htmlSnippet).to.equal('<my-button>X</my-button>');
        expect(result.value.replacesAppComponent).to.be.false;
        expect(result.value.files).to.deep.equal({});
        expect(result.value.bareSpecifiers.size).to.equal(0);
        expect(result.value.entry).to.equal('/repo/src/app/examples/inline.html');
    });

    it('returns Result.err when the .html file is missing', () => {
        const fs = fsFor({});
        const result = readFileRef('./missing.html', HOST, fs);
        expect(result.ok).to.be.false;
        if (result.ok === true) {
            return;
        }
        expect(result.message).to.contain('./missing.html');
    });
});

describe('readFileRef — TS mode', () => {
    const ENTRY_PATH = '/repo/src/app/examples/full/full.component.ts';
    const ENTRY_SOURCE = `
import { Component } from '@angular/core';
import { Helper } from '../../helpers/util';
import { MyButton } from '../../button.component';
@Component({
    selector: 'app-root',
    standalone: true,
    imports: [MyButton],
    templateUrl: './full.component.html',
    styleUrl: './full.component.css'
})
export class FullExample {}
`.trim();

    it('packs entry as src/app/app.component.ts and reads decorator siblings', () => {
        const fs = fsFor({
            [ENTRY_PATH]: ENTRY_SOURCE,
            '/repo/src/app/examples/full/full.component.html': '<my-button></my-button>',
            '/repo/src/app/examples/full/full.component.css': 'h1 { color: red; }',
            '/repo/src/app/helpers/util.ts': "export const Helper = 'h';\n",
            '/repo/src/app/button.component.ts': 'export class MyButton {}\n'
        });
        const result = readFileRef('./examples/full/full.component.ts', HOST, fs);
        expect(result.ok).to.be.true;
        if (result.ok === false) {
            return;
        }
        expect(result.value.replacesAppComponent).to.be.true;
        expect(result.value.entry).to.equal(ENTRY_PATH);
        expect(result.value.files['src/app/app.component.ts']).to.contain(
            'export class FullExample'
        );
        expect(result.value.files['src/app/full.component.html']).to.equal(
            '<my-button></my-button>'
        );
        expect(result.value.files['src/app/full.component.css']).to.equal('h1 { color: red; }');
        expect(result.value.files['src/app/util.ts']).to.contain("Helper = 'h'");
        expect(result.value.files['src/app/button.component.ts']).to.contain(
            'export class MyButton'
        );
        expect(result.value.bareSpecifiers.has('@angular/core')).to.be.true;
    });

    it('rewrites the entry decorator urls to flat basenames', () => {
        const ENTRY = '/repo/src/app/x/y/deep.component.ts';
        const SRC = `
import { Component } from '@angular/core';
@Component({
    selector: 'app-root',
    templateUrl: '../tpl/deep.component.html',
    styleUrls: ['../tpl/a.css', './b.css']
})
export class Deep {}
`.trim();
        const fs = fsFor({
            [ENTRY]: SRC,
            '/repo/src/app/x/tpl/deep.component.html': '<p>hi</p>',
            '/repo/src/app/x/tpl/a.css': 'a {}',
            '/repo/src/app/x/y/b.css': 'b {}'
        });
        const result = readFileRef('./x/y/deep.component.ts', '/repo/src/app/host.ts', fs);
        expect(result.ok).to.be.true;
        if (result.ok === false) {
            return;
        }
        const app = result.value.files['src/app/app.component.ts'];
        expect(app).to.contain("templateUrl: './deep.component.html'");
        expect(app).to.contain("styleUrls: ['./a.css', './b.css']");
        expect(result.value.files).to.have.property('src/app/deep.component.html');
        expect(result.value.files).to.have.property('src/app/a.css');
        expect(result.value.files).to.have.property('src/app/b.css');
    });

    it('rewrites relative imports inside the entry source', () => {
        const ENTRY = '/repo/src/app/examples/x.component.ts';
        const SRC = `
import { Helper } from '../helpers/util';
import { Y } from './y';
export class X {}
`.trim();
        const fs = fsFor({
            [ENTRY]: SRC,
            '/repo/src/app/helpers/util.ts': 'export const Helper = 1;',
            '/repo/src/app/examples/y.ts': 'export const Y = 2;'
        });
        const result = readFileRef('./examples/x.component.ts', '/repo/src/app/host.ts', fs);
        expect(result.ok).to.be.true;
        if (result.ok === false) {
            return;
        }
        const app = result.value.files['src/app/app.component.ts'];
        expect(app).to.contain("from './util'");
        expect(app).to.contain("from './y'");
    });

    it('walks transitive imports BFS-style with cycle protection', () => {
        const ENTRY = '/repo/src/app/a.component.ts';
        const fs = fsFor({
            [ENTRY]: "import { B } from './b';\nexport class A {}",
            '/repo/src/app/b.ts': "import { A } from './a.component';\nexport class B {}",
            '/repo/src/app/host.ts': '// host'
        });
        const result = readFileRef('./a.component.ts', '/repo/src/app/host.ts', fs);
        expect(result.ok).to.be.true;
        if (result.ok === false) {
            return;
        }
        expect(result.value.files).to.have.property('src/app/b.ts');
    });

    it('returns Result.err when the templateUrl sibling is missing', () => {
        const ENTRY = '/repo/src/app/x.component.ts';
        const fs = fsFor({
            [ENTRY]: `
import { Component } from '@angular/core';
@Component({ templateUrl: './missing.html' })
export class X {}
`.trim()
        });
        const result = readFileRef('./x.component.ts', '/repo/src/app/host.ts', fs);
        expect(result.ok).to.be.false;
        if (result.ok === true) {
            return;
        }
        expect(result.message).to.contain('templateUrl');
        expect(result.message).to.contain('missing.html');
    });

    it('returns Result.err when the entry file is missing', () => {
        const fs = fsFor({});
        const result = readFileRef('./not-here.ts', HOST, fs);
        expect(result.ok).to.be.false;
        if (result.ok === true) {
            return;
        }
        expect(result.message).to.contain('./not-here.ts');
    });

    it('returns Result.err when the file walk exceeds maxFiles', () => {
        const fs = fsFor({
            '/repo/src/app/a.ts': "import './b';\nexport const A = 1;",
            '/repo/src/app/b.ts': "import './c';\nexport const B = 1;",
            '/repo/src/app/c.ts': "import './d';\nexport const C = 1;",
            '/repo/src/app/d.ts': 'export const D = 1;'
        });
        const result = readFileRef('./a.ts', '/repo/src/app/host.ts', fs, { maxFiles: 2 });
        expect(result.ok).to.be.false;
        if (result.ok === true) {
            return;
        }
        expect(result.message).to.contain('2-file cap');
        expect(result.message).to.contain('playgroundFileCountCap');
        expect(result.message).to.contain('Walked:');
    });

    it('rejects unsupported extensions', () => {
        const fs = fsFor({ '/repo/src/app/x.css': 'body {}' });
        const result = readFileRef('./x.css', HOST, fs);
        expect(result.ok).to.be.false;
        if (result.ok === true) {
            return;
        }
        expect(result.message).to.contain('.html or .ts');
    });

    it('supports a plain template-literal templateUrl/styleUrl (no interpolation)', () => {
        const ENTRY = '/repo/src/app/x.component.ts';
        const fs = fsFor({
            [ENTRY]: [
                "import { Component } from '@angular/core';",
                '@Component({',
                '    templateUrl: `./x.component.html`,',
                '    styleUrls: [`./x.component.css`]',
                '})',
                'export class X {}'
            ].join('\n'),
            '/repo/src/app/x.component.html': '<p>hi</p>',
            '/repo/src/app/x.component.css': 'p { color: red; }'
        });
        const result = readFileRef('./x.component.ts', '/repo/src/app/host.ts', fs);
        expect(result.ok).to.be.true;
        if (result.ok === false) {
            return;
        }
        expect(result.value.files['src/app/x.component.html']).to.equal('<p>hi</p>');
        expect(result.value.files['src/app/x.component.css']).to.equal('p { color: red; }');
    });

    it('reports an interpolated templateUrl instead of silently dropping it', () => {
        const ENTRY = '/repo/src/app/x.component.ts';
        const fs = fsFor({
            [ENTRY]: [
                "import { Component } from '@angular/core';",
                'const variant = "dark";',
                '@Component({',
                '    templateUrl: `./x.${variant}.component.html`',
                '})',
                'export class X {}'
            ].join('\n')
        });
        const result = readFileRef('./x.component.ts', '/repo/src/app/host.ts', fs);
        expect(result.ok).to.be.false;
        if (result.ok === true) {
            return;
        }
        expect(result.message).to.contain('templateUrl');
        expect(result.message).to.contain('non-literal');
    });

    it('reports a computed (identifier) styleUrls instead of silently dropping it', () => {
        const ENTRY = '/repo/src/app/x.component.ts';
        const fs = fsFor({
            [ENTRY]: [
                "import { Component } from '@angular/core';",
                'const STYLES = ["./x.css"];',
                '@Component({',
                '    styleUrls: STYLES',
                '})',
                'export class X {}'
            ].join('\n')
        });
        const result = readFileRef('./x.component.ts', '/repo/src/app/host.ts', fs);
        expect(result.ok).to.be.false;
        if (result.ok === true) {
            return;
        }
        expect(result.message).to.contain('styleUrls');
        expect(result.message).to.contain('non-literal');
    });

    it('appends an AppComponent alias when the entry class has a different name', () => {
        const ENTRY = '/repo/src/app/x/sample.component.ts';
        const SRC = `
import { Component } from '@angular/core';
@Component({ selector: 'app-root', standalone: true, template: '' })
export class FullComponentExample {}
`.trim();
        const fs = fsFor({ [ENTRY]: SRC });
        const result = readFileRef('./x/sample.component.ts', '/repo/src/app/host.ts', fs);
        expect(result.ok).to.be.true;
        if (result.ok === false) {
            return;
        }
        const app = result.value.files['src/app/app.component.ts'];
        expect(app).to.contain('export { FullComponentExample as AppComponent }');
    });

    it('does not append an alias when the entry already exports AppComponent', () => {
        const ENTRY = '/repo/src/app/x/sample.component.ts';
        const SRC = `
import { Component } from '@angular/core';
@Component({ selector: 'app-root', standalone: true, template: '' })
export class AppComponent {}
`.trim();
        const fs = fsFor({ [ENTRY]: SRC });
        const result = readFileRef('./x/sample.component.ts', '/repo/src/app/host.ts', fs);
        expect(result.ok).to.be.true;
        if (result.ok === false) {
            return;
        }
        const app = result.value.files['src/app/app.component.ts'];
        const aliasMatches = app.match(/as AppComponent/g) ?? [];
        expect(aliasMatches.length).to.equal(0);
    });

    it('reads styleUrls array entries', () => {
        const ENTRY = '/repo/src/app/x.component.ts';
        const fs = fsFor({
            [ENTRY]: `
import { Component } from '@angular/core';
@Component({ styleUrls: ['./a.css', './b.css'] })
export class X {}
`.trim(),
            '/repo/src/app/a.css': 'a {}',
            '/repo/src/app/b.css': 'b {}'
        });
        const result = readFileRef('./x.component.ts', '/repo/src/app/host.ts', fs);
        expect(result.ok).to.be.true;
        if (result.ok === false) {
            return;
        }
        expect(result.value.files['src/app/a.css']).to.equal('a {}');
        expect(result.value.files['src/app/b.css']).to.equal('b {}');
    });
});

describe('readPlaygroundConfig', () => {
    it('places the config at src/app/app.config.ts and rewrites relative imports', () => {
        const fs = fsFor({
            '/repo/src/app/playground/app.config.ts':
                "import { provideRouter } from '@angular/router';\n" +
                "import { routes } from './routes';\n" +
                'export const appConfig = { providers: [provideRouter(routes)] };\n',
            '/repo/src/app/playground/routes.ts': 'export const routes = [];\n'
        });
        const result = readPlaygroundConfig('./playground/app.config.ts', HOST, fs);
        expect(result.ok).to.be.true;
        if (result.ok === false) {
            return;
        }
        expect(result.value.files['src/app/app.config.ts']).to.contain('appConfig');
        // Relative import flattened to './routes'.
        expect(result.value.files['src/app/app.config.ts']).to.contain("from './routes'");
        // Transitive relative import walked in.
        expect(result.value.files['src/app/routes.ts']).to.equal('export const routes = [];\n');
        // Bare specifier surfaced for dep auto-forward.
        expect(result.value.bareSpecifiers.has('@angular/router')).to.be.true;
    });

    it('errors on a non-.ts config path', () => {
        const fs = fsFor({});
        const result = readPlaygroundConfig('./app.config.json', HOST, fs);
        expect(result.ok).to.be.false;
        if (result.ok === true) {
            return;
        }
        expect(result.message).to.contain('.ts');
    });

    it('errors when the config file is missing', () => {
        const fs = fsFor({});
        const result = readPlaygroundConfig('./playground/app.config.ts', HOST, fs);
        expect(result.ok).to.be.false;
        if (result.ok === true) {
            return;
        }
        expect(result.message).to.contain('Cannot find playground config');
    });

    it('errors when a transitively imported file is missing', () => {
        const fs = fsFor({
            '/repo/src/app/app.config.ts': "import './missing';\nexport const appConfig = {};\n"
        });
        const result = readPlaygroundConfig('./app.config.ts', HOST, fs);
        expect(result.ok).to.be.false;
        if (result.ok === true) {
            return;
        }
        expect(result.message).to.contain('Cannot find imported file');
    });
});
