import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pageOf } from '../helpers/pages';

// Characterises watch-mode rebuilds end to end: a real `-s -w` process on a
// temp copy of the kitchen-sink fixture, driven by file edits. Every wait is
// on a log line, never on a fixed sleep.

const REPO_ROOT = path.resolve(__dirname, '../../..');
const BIN = path.join(REPO_ROOT, 'bin/index-cli.js');
const FIXTURE = path.join(REPO_ROOT, 'test/fixtures/kitchen-sink-standalone');
const PORT = 4010;
const WAIT_TIMEOUT = 30000;
const IT_TIMEOUT = 60000;

const COMPONENT_FILE = 'src/app/features/dashboard/dashboard.component.ts';
const COMPONENT_PAGE = `${pageOf('component', 'DashboardComponent')}`;
const TS_MARKER = 'Watch spec marker sentence for the dashboard.';
const README_MARKER = 'Watch spec marker line for the readme.';

const stripAnsi = (str: string): string => str.replace(/\u001b\[[0-9;]*m/g, '');

const countMatches = (text: string, pattern: string): number => text.split(pattern).length - 1;

const normaliseTimestamps = (html: string): string =>
    html
        .replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d+Z/g, '<TS>')
        .replace(/Generated [A-Z][a-z]{2} \d{1,2}, \d{4}, \d{1,2}:\d\d [AP]M/g, 'Generated <TS>');

describe('CLI watch mode', () => {
    let workDir = '';
    let projectDir = '';
    let child: ChildProcess | undefined;
    let log = '';
    const waiters: Array<() => void> = [];

    const notify = () => {
        for (const waiter of [...waiters]) {
            waiter();
        }
    };

    /**
     * Resolve once `pattern` has appeared at least `count` times in the
     * collected stdout/stderr; reject with the collected log on timeout.
     */
    const waitForLog = (pattern: string, count: number, timeoutMs = WAIT_TIMEOUT) =>
        new Promise<void>((resolve, reject) => {
            const check = () => {
                if (countMatches(log, pattern) >= count) {
                    cleanup();
                    resolve();
                }
            };
            const timer = setTimeout(() => {
                cleanup();
                reject(
                    new Error(
                        `Timed out waiting for "${pattern}" x${count}. Collected log:\n${log}`
                    )
                );
            }, timeoutMs);
            const cleanup = () => {
                clearTimeout(timer);
                const index = waiters.indexOf(check);
                if (index > -1) {
                    waiters.splice(index, 1);
                }
            };
            waiters.push(check);
            check();
        });

    /**
     * `Watching sources in` is logged before chokidar has finished its initial
     * scan and nothing is logged on `ready`, so an edit made right after it
     * can be missed. Re-apply the edit until the rebuild log line shows up.
     * The retry window is longer than chokidar's write-finish delay plus the
     * 1 s debounce, so a slow first event cannot cause a second rebuild.
     */
    const editUntilLogged = async (edit: () => void, pattern: string, count: number) => {
        const deadline = Date.now() + WAIT_TIMEOUT;
        for (;;) {
            edit();
            try {
                await waitForLog(pattern, count, 8000);
                return;
            } catch (error) {
                if (Date.now() > deadline) {
                    throw error;
                }
            }
        }
    };

    const readOut = (folder: string, file: string) =>
        fs.readFileSync(path.join(projectDir, folder, file), 'utf8');

    beforeAll(async () => {
        workDir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'compodocx-watch-'));
        projectDir = path.join(workDir, 'ks');
        fs.cpSync(FIXTURE, projectDir, { recursive: true });

        child = spawn(
            'node',
            [
                BIN,
                '-p',
                'tsconfig.json',
                '-d',
                'out',
                '-s',
                '-w',
                '--port',
                String(PORT),
                '--disableSearch',
                '--no-multiVersion'
            ],
            { cwd: projectDir }
        );
        const collect = (chunk: Buffer) => {
            log += stripAnsi(chunk.toString());
            notify();
        };
        child.stdout?.on('data', collect);
        child.stderr?.on('data', collect);

        await waitForLog('Watching sources in', 1);
    });

    afterAll(() => {
        child?.kill();
        if (workDir) {
            fs.rmSync(workDir, { recursive: true, force: true });
        }
    });

    it(
        'rebuilds the diff after a component .ts change',
        async () => {
            const file = path.join(projectDir, COMPONENT_FILE);
            const source = fs.readFileSync(file, 'utf8');
            const edited = source.replace(
                'Dashboard page using signals, resource(), and linkedSignal().',
                `Dashboard page using signals, resource(), and linkedSignal(). ${TS_MARKER}`
            );
            expect(edited).not.to.equal(source);

            await editUntilLogged(
                () => fs.writeFileSync(file, edited),
                'Get diff dependencies data',
                1
            );
            await waitForLog('Documentation generated in', 2);

            expect(readOut('out', COMPONENT_PAGE)).to.contain(TS_MARKER);
        },
        IT_TIMEOUT
    );

    it(
        'writes the same component page as a fresh one-shot run of the edited sources',
        () => {
            const fresh = spawnSync(
                'node',
                [
                    BIN,
                    '-p',
                    'tsconfig.json',
                    '-d',
                    'out-fresh',
                    '--disableSearch',
                    '--no-multiVersion'
                ],
                { cwd: projectDir }
            );
            expect(fresh.status).to.equal(0);

            const rebuilt = normaliseTimestamps(readOut('out', COMPONENT_PAGE));
            const oneShot = normaliseTimestamps(readOut('out-fresh', COMPONENT_PAGE));
            expect(rebuilt).to.equal(oneShot);
        },
        IT_TIMEOUT
    );

    it(
        'regenerates the root markdown pages after a README.md change',
        async () => {
            const readme = path.join(projectDir, 'README.md');
            fs.appendFileSync(readme, `\n${README_MARKER}\n`);

            await waitForLog('Regenerating README.md, CHANGELOG.md', 1);
            await waitForLog('Documentation generated in', 3);

            // The README renders into index.html; overview.html is the statistics page.
            expect(readOut('out', 'index.html')).to.contain(README_MARKER);
        },
        IT_TIMEOUT
    );

    it(
        'runs a full rebuild after a new .ts file is added',
        async () => {
            fs.writeFileSync(
                path.join(projectDir, 'src/app/watch-added.ts'),
                '/**\n * Added by the watch spec.\n */\nexport const WATCH_ADDED = 1;\n'
            );

            await waitForLog('Get dependencies data', 2);
            await waitForLog('Documentation generated in', 4);
        },
        IT_TIMEOUT
    );
});
