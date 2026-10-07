import type { ExtractedManifest } from '../../../src/playground-validate/extract';
import {
    type BuildRunner,
    exitCodeFromResults,
    formatSummary,
    type RunOutcome,
    validateAll,
    validateOne
} from '../../../src/playground-validate/runner';
import { pageOf } from '../helpers/pages';

const entry = (id: string, title: string): ExtractedManifest => ({
    id,
    sourceFile: pageOf('component', title),
    manifest: {
        title,
        description: '',
        template: 'node',
        files: { 'package.json': '{}' },
        dependencies: {},
        tags: [],
        openFile: 'src/app/app.component.ts',
        startScript: 'start'
    }
});

const ok: RunOutcome = { ok: true, code: 0, output: '' };
const fail = (output: string): RunOutcome => ({ ok: false, code: 1, output });

const runnerOf = (install: RunOutcome, build: RunOutcome): BuildRunner => ({
    install: () => install,
    build: () => build
});

const deps = (runner: BuildRunner) => ({
    materialize: (e: ExtractedManifest) => `/tmp/${e.id}`,
    runner
});

describe('validateOne', () => {
    it('passes when install and build both succeed', () => {
        const r = validateOne(entry('pg-0', 'Default'), deps(runnerOf(ok, ok)));
        expect(r.status).to.equal('pass');
    });

    it('fails at install with the output tail', () => {
        const r = validateOne(entry('pg-0', 'Default'), deps(runnerOf(fail('npm ERR! 404'), ok)));
        expect(r.status).to.equal('fail');
        expect(r.phase).to.equal('install');
        expect(r.detail).to.contain('404');
    });

    it('fails at build and never reports a build pass', () => {
        const r = validateOne(
            entry('pg-0', 'Default'),
            deps(runnerOf(ok, fail('TS2305: no AppComponent')))
        );
        expect(r.status).to.equal('fail');
        expect(r.phase).to.equal('build');
        expect(r.detail).to.contain('TS2305');
    });

    it('fails gracefully when materialization throws', () => {
        const r = validateOne(entry('pg-0', 'Default'), {
            materialize: () => {
                throw new Error('disk full');
            },
            runner: runnerOf(ok, ok)
        });
        expect(r.status).to.equal('fail');
        expect(r.detail).to.contain('disk full');
    });
});

describe('validateAll + summary', () => {
    it('reports every playground and a 1 exit code when any fails', () => {
        const entries = [entry('pg-0', 'Good'), entry('pg-1', 'Bad')];
        let i = 0;
        const runner: BuildRunner = {
            install: () => ok,
            build: () => (i++ === 0 ? ok : fail('boom'))
        };
        const results = validateAll(entries, deps(runner));
        expect(results.map(r => r.status)).to.deep.equal(['pass', 'fail']);
        expect(exitCodeFromResults(results)).to.equal(1);

        const summary = formatSummary(results);
        expect(summary).to.contain('PASS Good');
        expect(summary).to.contain('FAIL Bad');
        expect(summary).to.contain('1 passed, 1 failed');
        expect(summary).to.contain('boom');
    });

    it('exit code 0 and no failure tails when all pass', () => {
        const results = validateAll([entry('pg-0', 'Good')], deps(runnerOf(ok, ok)));
        expect(exitCodeFromResults(results)).to.equal(0);
        expect(formatSummary(results)).to.contain('1 passed, 0 failed');
    });

    it('handles the empty set', () => {
        expect(exitCodeFromResults([])).to.equal(0);
        expect(formatSummary([])).to.contain('no @playground manifests');
    });
});
