import * as os from 'node:os';

import { hasStderrError, path, read, shell, temporaryDir } from '../helpers';

const tmp = temporaryDir();

/**
 * Exports are committed and diffed across machines, so every path in them
 * must be relative. Any absolute prefix of the run (the working directory,
 * the output folder, the temp or home directory) in raw, forward-slash or
 * JSON-escaped form fails the run.
 */
const absolutePrefixes = (output: string): string[] => {
    const roots = [process.cwd(), path.resolve(output), os.tmpdir(), os.homedir()];
    return [
        ...new Set(
            roots.flatMap(root => [
                root,
                root.replaceAll('\\', '/'),
                JSON.stringify(root).slice(1, -1)
            ])
        )
    ];
};

const generate = (output: string, args: string[]): void => {
    tmp.create(output);
    const ls = shell('node', ['./bin/index-cli.js', ...args, '-d', output]);
    if (hasStderrError(ls.stderr.toString())) {
        console.error(`shell error: ${ls.stderr.toString()}`);
        throw new Error('error');
    }
};

const leakedPrefixes = (output: string, file: string): string[] => {
    const content = read(path.join(output, file), 'utf8');
    return absolutePrefixes(output).filter(prefix => content.includes(prefix));
};

describe('CLI exports without absolute paths', () => {
    const app = 'test/fixtures/standalone-app/src/tsconfig.json';
    const styles = 'test/fixtures/style-library';
    const jsonOut = `${tmp.name}-paths-json`;
    const llmOut = `${tmp.name}-paths-llm`;
    const stylesOut = `${tmp.name}-paths-styles`;

    beforeAll(() => {
        generate(jsonOut, ['-p', app, '-e', 'json']);
        generate(llmOut, ['-p', app, '-e', 'llm-md']);
        generate(stylesOut, [
            '-c',
            `${styles}/.compodocxrc.json`,
            '-p',
            `${styles}/tsconfig.json`,
            '-e',
            'json'
        ]);
    });
    afterAll(() => {
        tmp.clean(jsonOut);
        tmp.clean(llmOut);
        tmp.clean(stylesOut);
    });

    it('keeps the JSON export relative', () => {
        expect(leakedPrefixes(jsonOut, 'documentation.json')).toEqual([]);
    });

    it('keeps the llm-md export relative', () => {
        expect(leakedPrefixes(llmOut, 'llm-context.md')).toEqual([]);
    });

    it('keeps the style fields of the JSON export relative', () => {
        expect(leakedPrefixes(stylesOut, 'documentation.json')).toEqual([]);
    });
});
