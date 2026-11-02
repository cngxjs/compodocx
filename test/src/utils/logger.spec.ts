import { logger } from '../../../src/utils/logger';

describe('logger verbose gate', () => {
    let lines: string[] = [];

    beforeEach(() => {
        lines = [];
        vi.spyOn(process.stdout, 'write').mockImplementation(chunk => {
            lines.push(String(chunk));
            return true;
        });
    });

    afterEach(() => {
        logger.silent = true;
        logger.verbose = false;
        vi.restoreAllMocks();
    });

    it('suppresses debug lines by default', () => {
        logger.debug('found', 'Foo');
        expect(lines).to.have.length(0);
    });

    it('prints debug lines with verbose', () => {
        logger.verbose = true;
        logger.debug('found', 'Foo');
        expect(lines.join('')).to.contain('Foo');
    });

    it('lets silent win over verbose', () => {
        logger.verbose = true;
        logger.silent = false;
        logger.debug('found', 'Foo');
        logger.info('generated');
        expect(lines).to.have.length(0);
    });

    it('leaves info and warn untouched by verbose', () => {
        logger.info('generated');
        logger.warn('careful');
        logger.verbose = true;
        logger.info('generated again');
        expect(lines).to.have.length(3);
    });
});
