import * as path from 'node:path';
import fs from 'fs-extra';

import { exists, shell, temporaryDir } from '../helpers';

const tmp = temporaryDir();

const stripAnsi = (str: string): string => str.replace(/\u001b\[[0-9;]*m/g, '');

// An NgModule app whose route paths hold dots, plus signs, parentheses and
// template literals. RouterModule.forRoot is a legacy construct: it is reported
// in the legacy notice and not read into the route model, so the run succeeds
// without a routes page.
describe('CLI routes with special characters in an NgModule app', () => {
    const distFolder = `${tmp.name}-router-special-chars`;
    let stdout = '';
    let stderr = '';
    let status: number | null = null;

    beforeAll(() => {
        tmp.create(distFolder);

        const srcDir = path.join(distFolder, 'src');
        fs.ensureDirSync(srcDir);

        const testComponent = `
import { Component } from '@angular/core';

@Component({
  selector: 'test-component',
  template: '<div>Test component with special routes</div>',
  styles: ['.test { color: blue; }']
})
export class TestComponent {
  constructor() {}
}`;

        const moduleWithSpecialCharRoutes = `
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TestComponent } from './test.component';

const USER = 'user';
const CREATE = 'create';
const EDIT = 'edit';

const routes: Routes = [
  { path: 'admin.config', component: TestComponent },
  { path: 'route+with+plus', component: TestComponent },
  { path: 'user(profile)', component: TestComponent },
  { path: 'complex.path(with)+special/chars', component: TestComponent },
  { path: \`\${USER}/\${CREATE}\`, component: TestComponent },
  { path: \`\${USER}/\${EDIT}/:id\`, component: TestComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
  declarations: [TestComponent]
})
export class AppModule { }`;

        const tsconfig = `{
  "compilerOptions": {
    "target": "es2017",
    "lib": ["dom", "es6"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": false,
    "moduleResolution": "node",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src/**/*"]
}`;

        fs.writeFileSync(path.join(srcDir, 'test.component.ts'), testComponent);
        fs.writeFileSync(path.join(srcDir, 'app.module.ts'), moduleWithSpecialCharRoutes);
        fs.writeFileSync(path.join(distFolder, 'tsconfig.json'), tsconfig);

        const ls = shell('node', [
            './bin/index-cli.js',
            '--no-multiVersion',
            '-p',
            path.join(distFolder, 'tsconfig.json'),
            '-d',
            path.join(distFolder, 'docs'),
            '--disableSourceCode',
            '--disableCoverage'
        ]);
        stdout = stripAnsi(ls.stdout.toString());
        stderr = stripAnsi(ls.stderr.toString());
        status = ls.status;
    });

    afterAll(() => {
        tmp.clean(distFolder);
    });

    it('generates the documentation and exits 0', () => {
        expect(status).to.equal(0);
        expect(stderr).to.not.contain('Unhandled Rejection');
        expect(stdout).to.contain('Documentation generated');
        expect(exists(path.join(distFolder, 'docs/index.html'))).to.be.true;
    });

    it('reports RouterModule.forRoot and the NgModule in the legacy notice', () => {
        expect(stdout).to.contain('Angular 21+ only: 2 legacy constructs are not documented');
        expect(stdout).to.match(/ng-module \(1\): \S*src[\\/]app\.module\.ts:19 AppModule/);
        expect(stdout).to.match(
            /router-for-root \(1\): \S*src[\\/]app\.module\.ts:20 RouterModule\.forRoot/
        );
    });

    it('reads no routes from the module and writes no routes page', () => {
        expect(stdout).to.contain('Routes: 0 in 0 routers, 0 unmounted');
        expect(exists(path.join(distFolder, 'docs/routes.html'))).to.be.false;
    });
});
