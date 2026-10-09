import { Command } from 'commander';
import { describe, expect, it } from 'vitest';

import { defineFlags, stripRemovedFlags } from '../../../../src/app/cli/flags';

const makeProgram = (): Command => {
    const program = new Command();
    // Suppress commander's default exit-on-help/exit-on-error so test runs
    // stay quiet even if a flag accidentally calls help.
    program.exitOverride();
    return program;
};

describe('defineFlags', () => {
    it('returns the same program instance for chaining', () => {
        const program = makeProgram();
        expect(defineFlags(program)).toBe(program);
    });

    it('does not invoke parse internally', () => {
        const program = makeProgram();
        defineFlags(program);
        // Commander sets `program.args` only after `.parse(...)`; before
        // parse it is the empty array. If `defineFlags` had called parse,
        // `program.args` would reflect the test process argv.
        expect(program.args).toEqual([]);
    });

    it('registers every long-form flag', () => {
        const program = makeProgram();
        defineFlags(program);
        const longs = program.options.map(o => o.long).filter(Boolean);

        const expected = [
            '--config',
            '--tsconfig',
            '--output',
            '--extTheme',
            '--name',
            '--assetsFolder',
            '--open',
            '--silent',
            '--serve',
            '--host',
            '--port',
            '--watch',
            '--exportFormat',
            '--jsonIndent',
            '--multiVersion',
            '--no-multiVersion',
            '--versionLabel',
            '--versionsRoot',
            '--maxVersionsShown',
            '--files',
            '--language',
            '--theme',
            '--shikiTheme',
            '--hideGenerator',
            '--hideDarkModeToggle',
            '--toggleMenuItems',
            '--navTabConfig',
            '--templates',
            '--includes',
            '--includesName',
            '--coverageTest',
            '--coverageMinimumPerFile',
            '--coverageTestThresholdFail',
            '--coverageTestShowOnlyFailed',
            '--unitTestCoverage',
            '--disableSourceCode',
            '--disableDomTree',
            '--disableTemplateTab',
            '--disableStyleTab',
            '--disableGraph',
            '--disableCoverage',
            '--disablePrivate',
            '--disableProtected',
            '--disableInternal',
            '--disableLifeCycleHooks',
            '--disableConstructors',
            '--disableRoutesGraph',
            '--disableSearch',
            '--disableDependencies',
            '--disableDependenciesTab',
            '--disablePlaygroundTab',
            '--disableProperties',
            '--disableFilePath',
            '--disableOverview',
            '--showEffects',
            '--minimal',
            '--customFavicon',
            '--customLogo',
            '--gaID',
            '--publicApiOnly',
            '--maxSearchResults',
            '--stackblitz',
            '--stackblitzTemplate'
        ];

        for (const flag of expected) {
            expect(longs).toContain(flag);
        }
    });

    it('registers every short-form alias', () => {
        const program = makeProgram();
        defineFlags(program);
        const shorts = program.options.map(o => o.short).filter(Boolean);

        const expected = ['-c', '-p', '-d', '-y', '-n', '-a', '-o', '-t', '-s', '-r', '-w', '-e'];
        for (const flag of expected) {
            expect(shorts).toContain(flag);
        }
    });

    it('registers at least 50 options', () => {
        const program = makeProgram();
        defineFlags(program);
        expect(program.options.length).toBeGreaterThanOrEqual(50);
    });

    it('--toggleMenuItems uses a comma-list parser', () => {
        const program = makeProgram();
        defineFlags(program);
        program.parse(['node', 'compodocx', '--toggleMenuItems', 'modules,classes,pipes']);
        expect(program.opts().toggleMenuItems).toEqual(['modules', 'classes', 'pipes']);
    });

    it('--port default is the stringified COMPODOC_DEFAULTS.port', () => {
        const program = makeProgram();
        defineFlags(program);
        program.parse(['node', 'compodocx']);
        expect(program.opts().port).toBe('8080');
    });

    it('--multiVersion is true by default and --no-multiVersion flips it to false', () => {
        const programDefault = makeProgram();
        defineFlags(programDefault);
        programDefault.parse(['node', 'compodocx']);
        expect(programDefault.opts().multiVersion).toBe(true);

        const programNo = makeProgram();
        defineFlags(programNo);
        programNo.parse(['node', 'compodocx', '--no-multiVersion']);
        expect(programNo.opts().multiVersion).toBe(false);
    });

    it('exposes the program version from package.json', () => {
        const program = makeProgram();
        defineFlags(program);
        // commander stores the version on the private `_version` field; the
        // public way to read it back is `program.version()` with no args.
        expect(program.version()).toBeTypeOf('string');
        expect(program.version()).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('drops the removed grouping flags and their values', () => {
        expect(
            stripRemovedFlags([
                'node',
                'compodocx',
                '--groupBy',
                'folder',
                '-p',
                'tsconfig.json',
                '--groupDepth=3',
                '--disableSearch'
            ])
        ).toEqual({
            argv: ['node', 'compodocx', '-p', 'tsconfig.json', '--disableSearch'],
            removed: ['--groupBy', '--groupDepth']
        });
        expect(stripRemovedFlags(['node', 'compodocx', '--groupBy', '-s']).argv).toEqual([
            'node',
            'compodocx',
            '-s'
        ]);
    });

    it('source tracking marks user-provided flags as "cli"', () => {
        const program = makeProgram();
        defineFlags(program);
        program.parse(['node', 'compodocx', '--jsonIndent', '4']);
        expect(program.getOptionValueSource('jsonIndent')).toBe('cli');
        expect(program.getOptionValueSource('output')).toBe('default');
    });
});
