import type { ExportData, ExportProperty } from '../../../src/app/interfaces/export-data.interface';
import { hasStderrError, read, shell, temporaryDir } from '../helpers';
import { pagesIn } from '../helpers/pages';

const tmp = temporaryDir();
const SM = './test/fixtures/signal-members';
/** A string default once sent the old default-text regex into a hang. */
const RUN_TIMEOUT = 60_000;

const run = (args: string[]): void => {
    const ls = shell('node', ['./bin/index-cli.js', '-p', `${SM}/tsconfig.json`, ...args], {
        timeout: RUN_TIMEOUT
    });
    if (ls.status !== 0 || hasStderrError(ls.stderr.toString())) {
        console.error(`shell error (${ls.status ?? ls.signal}): ${ls.stderr.toString()}`);
        throw new Error('error');
    }
};

const pick = (list: readonly ExportProperty[] | undefined) =>
    (list ?? []).map(({ name, signalKind, required, type, defaultValue, alias }) => ({
        name,
        signalKind,
        required,
        type,
        defaultValue,
        alias
    }));
const names = (list: readonly ExportProperty[] | undefined) => (list ?? []).map(p => p.name);

describe('CLI signal members', () => {
    describe('JSON export', () => {
        const out = `${tmp.name}-signal-members-json`;
        let data: ExportData;

        beforeAll(() => {
            tmp.create(out);
            run(['-e', 'json', '-d', out]);
            data = JSON.parse(read(`${out}/documentation.json`));
        });
        afterAll(() => tmp.clean(out));

        const component = () => data.components.find(c => c.name === 'SignalCopyComponent');
        const directive = () => data.directives.find(d => d.name === 'SignalFormsDirective');

        it('keeps string defaults that mention input, output and model as properties', () => {
            expect(names(component()?.propertiesClass)).toEqual([
                'inputHelp',
                'loudHeading',
                'modelHelp',
                'outputHelp',
                'snippet'
            ]);
            expect(names(component()?.inputsClass)).toEqual(['heading']);
            expect(names(component()?.outputsClass)).toEqual([]);
        });

        it('keeps a computed value that reads an input as a property', () => {
            const loud = component()?.propertiesClass?.find(p => p.name === 'loudHeading');
            expect(loud?.signalKind).toBe('computed');
        });

        it('lists every signal form with its kind, type, default, required flag and alias', () => {
            expect(pick(directive()?.inputsClass)).toEqual([
                {
                    name: 'disabled',
                    signalKind: 'input-signal',
                    required: false,
                    type: undefined,
                    defaultValue: 'false',
                    alias: 'smDisabled'
                },
                {
                    name: 'itemId',
                    signalKind: 'input-signal',
                    required: true,
                    type: 'string',
                    defaultValue: undefined,
                    alias: undefined
                },
                {
                    name: 'label',
                    signalKind: 'input-signal',
                    required: false,
                    type: 'string',
                    defaultValue: "'Untitled'",
                    alias: undefined
                },
                {
                    name: 'page',
                    signalKind: 'model',
                    required: false,
                    type: undefined,
                    defaultValue: '1',
                    alias: undefined
                },
                {
                    name: 'selected',
                    signalKind: 'model',
                    required: true,
                    type: 'string',
                    defaultValue: undefined,
                    alias: undefined
                }
            ]);
            expect(
                pick(directive()?.outputsClass).map(p => [p.name, p.signalKind, p.alias])
            ).toEqual([
                ['closed', 'output-signal', 'smClosed'],
                ['page', 'model', undefined],
                ['renamed', 'output-signal', undefined],
                ['selected', 'model', undefined]
            ]);
            expect(directive()?.propertiesClass ?? []).toEqual([]);
        });
    });

    describe('HTML output', () => {
        const out = `${tmp.name}-signal-members-html`;
        const pages = pagesIn(out);

        beforeAll(() => {
            tmp.create(out);
            run(['--disableSearch', '--no-multiVersion', '-d', out]);
        });
        afterAll(() => tmp.clean(out));

        it('renders the string properties in the properties block of the component page', () => {
            const html = read(`${out}/${pages.of('component', 'SignalCopyComponent')}`);
            const section = (id: string) => {
                const start = html.indexOf(`id="${id}"`);
                expect(start).toBeGreaterThan(-1);
                return html.slice(start, html.indexOf('</section>', start));
            };
            const inputs = section('inputs');
            expect(inputs).toContain('id="heading"');
            for (const name of ['inputHelp', 'outputHelp', 'modelHelp', 'snippet']) {
                expect(inputs).not.toContain(name);
                expect(section('properties')).toContain(name);
            }
            expect(inputs).not.toContain('loudHeading');
        });

        it('renders the alias modifier on the directive page', () => {
            const html = read(`${out}/${pages.of('directive', 'SignalFormsDirective')}`);
            expect(html).toContain('alias: smDisabled');
            expect(html).toContain('alias: smClosed');
        });
    });
});
