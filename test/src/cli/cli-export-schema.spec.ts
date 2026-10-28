import Ajv2020 from 'ajv/dist/2020';
import { EXPORT_SCHEMA_VERSION } from '../../../src/app/interfaces/export-data.interface';
import { hasStderrError, read, shell, temporaryDir } from '../helpers';

const tmp = temporaryDir();

/** A real export validates against the JSON Schema the package ships. */
describe('CLI export: JSON Schema', () => {
    const distFolder = `${tmp.name}-export-schema`;
    let data: unknown;

    beforeAll(() => {
        tmp.create(distFolder);
        const ls = shell('node', [
            './bin/index-cli.js',
            '--no-multiVersion',
            '-p',
            './test/fixtures/kitchen-sink-standalone/tsconfig.json',
            '-d',
            distFolder,
            '-e',
            'json'
        ]);
        if (hasStderrError(ls.stderr.toString())) {
            console.error(`shell error: ${ls.stderr.toString()}`);
            throw new Error('error');
        }
        data = JSON.parse(read(`${distFolder}/documentation.json`, 'utf8'));
    });
    afterAll(() => tmp.clean(distFolder));

    it('validates the kitchen-sink export', () => {
        const schema = JSON.parse(
            read(`./src/data/schemas/documentation.v${EXPORT_SCHEMA_VERSION}.schema.json`, 'utf8')
        );
        const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
        const valid = validate(data);
        expect(validate.errors ?? []).to.deep.equal([]);
        expect(valid).to.be.true;
    });
});
