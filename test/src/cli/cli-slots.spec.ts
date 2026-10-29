import { hasStderrError, read, shell, temporaryDir } from '../helpers';
import { pagesIn } from '../helpers/pages';

const tmp = temporaryDir();

/**
 * A `@slot` whose description runs over the next line keeps its name and
 * the whole description. The kitchen-sink `HostDirDemoComponent` has one.
 */
const generate = (distFolder: string, format?: string): void => {
    tmp.create(distFolder);
    const ls = shell('node', [
        './bin/index-cli.js',
        '--no-multiVersion',
        '-p',
        './test/fixtures/kitchen-sink-standalone/tsconfig.json',
        '-d',
        distFolder,
        ...(format ? ['-e', format] : [])
    ]);
    if (hasStderrError(ls.stderr.toString())) {
        console.error(`shell error: ${ls.stderr.toString()}`);
        throw new Error('error');
    }
};

describe('CLI: multi-line @slot', () => {
    const jsonFolder = `${tmp.name}-slots-json`;
    const htmlFolder = `${tmp.name}-slots-html`;
    let slots: any[];
    let page: string;

    beforeAll(() => {
        generate(jsonFolder, 'json');
        generate(htmlFolder);
        const data = JSON.parse(read(`${jsonFolder}/documentation.json`, 'utf8'));
        slots = data.components.find((c: any) => c.name === 'HostDirDemoComponent').slots;
        page = read(`${htmlFolder}/${pagesIn(htmlFolder).of('component', 'HostDirDemoComponent')}`);
    });
    afterAll(() => {
        tmp.clean(jsonFolder);
        tmp.clean(htmlFolder);
    });

    it('keeps the slot name and the description over both lines in the JSON', () => {
        expect(slots).to.deep.equal([
            {
                name: 'default',
                description:
                    'Content of the wrapper `div`,\nwhich carries the highlight and tooltip of the host.'
            }
        ]);
    });

    it('renders the name and the description in the Content Slots section', () => {
        expect(page).to.contain('<dt><code>default</code></dt>');
        expect(page).to.contain('which carries the highlight and tooltip of the host.');
    });
});
