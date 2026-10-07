import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import Configuration from '../configuration';
import FileEngine from '../engines/file.engine';
import HtmlEngine from '../engines/html.engine';
import type { CoverageData } from '../interfaces/coverageData.interface';
import { ROOT_DEPTH } from '../links/layout';
import { type CoverageVerdict, evaluateCoverageGate } from '../run/coverage-gate';
import {
    type CoverageFile,
    computeDocumentationCoverage,
    computeUnitTestCoverage
} from '../services/coverage';

export class CoveragePageGenerator {
    /**
     * Build the documentation coverage page and evaluate the coverage gate.
     * Resolves with the gate's verdict; the caller logs its lines and halts
     * the run when the verdict carries an exit code.
     */
    public prepareDocumentation(): Promise<CoverageVerdict> {
        logger.info('Process documentation coverage report');

        return new Promise((resolve, _reject) => {
            const report = computeDocumentationCoverage({
                components: Configuration.mainData.components,
                directives: Configuration.mainData.directives,
                entities: Configuration.mainData.entities,
                classes: Configuration.mainData.classes,
                injectables: Configuration.mainData.injectables,
                interfaces: Configuration.mainData.interfaces,
                guards: Configuration.mainData.guards,
                interceptors: Configuration.mainData.interceptors,
                pipes: Configuration.mainData.pipes,
                miscellaneous: {
                    functions: Configuration.mainData.miscellaneous.functions,
                    variables: Configuration.mainData.miscellaneous.variables,
                    typealiases: Configuration.mainData.miscellaneous.typealiases
                }
            });

            const coverageData = {
                count: report.count,
                status: report.status,
                files: report.files
            };

            Configuration.addPage({
                name: 'coverage',
                id: 'coverage',
                context: 'coverage',
                files: coverageData.files,
                data: coverageData,
                depth: ROOT_DEPTH,
                pageType: COMPODOC_DEFAULTS.PAGE_TYPES.ROOT
            });
            Configuration.mainData.coverageData = coverageData;
            if (Configuration.mainData.exportFormat === COMPODOC_DEFAULTS.exportFormat) {
                HtmlEngine.generateCoverageBadge(
                    Configuration.mainData.output,
                    'documentation',
                    coverageData
                );
            }

            const verdict = evaluateCoverageGate({
                count: coverageData.count,
                files: coverageData.files,
                coverageTest: Configuration.mainData.coverageTest,
                coverageTestPerFile: Configuration.mainData.coverageTestPerFile,
                coverageTestThreshold: Configuration.mainData.coverageTestThreshold,
                coverageMinimumPerFile: Configuration.mainData.coverageMinimumPerFile,
                coverageTestThresholdFail: Configuration.mainData.coverageTestThresholdFail,
                coverageTestShowOnlyFailed: Configuration.mainData.coverageTestShowOnlyFailed
            });
            resolve(verdict);
        });
    }

    public prepareUnitTest(): Promise<any> {
        logger.info('Process unit test coverage report');
        return new Promise((resolve, _reject) => {
            const coverageData: CoverageData = Configuration.mainData.coverageData;
            const coverageFiles = coverageData.files as ReadonlyArray<CoverageFile> | undefined;
            if (!coverageFiles) {
                logger.warn('Missing documentation coverage data');
            }

            const fileDat = FileEngine.getSync(Configuration.mainData.unitTestCoverage);
            if (!fileDat) {
                return Promise.reject('Error reading unit test coverage file');
            }
            const unitTestSummary = JSON.parse(fileDat) as Record<string, unknown>;

            const report = computeUnitTestCoverage(unitTestSummary, coverageFiles);
            const unitTestData: Record<string, unknown> = {
                total: report.total,
                files: report.files,
                idColumn: report.idColumn
            };
            Configuration.mainData.unitTestData = unitTestData;
            Configuration.addPage({
                name: 'unit-test',
                id: 'unit-test',
                context: 'unit-test',
                files: report.files,
                data: unitTestData,
                depth: ROOT_DEPTH,
                pageType: COMPODOC_DEFAULTS.PAGE_TYPES.ROOT
            });

            if (Configuration.mainData.exportFormat === COMPODOC_DEFAULTS.exportFormat) {
                const keysToGet = ['statements', 'branches', 'functions', 'lines'] as const;
                keysToGet.forEach(key => {
                    const metric = report.total[key];
                    if (metric) {
                        HtmlEngine.generateCoverageBadge(Configuration.mainData.output, key, {
                            count: metric.coveragePercent,
                            status: metric.status
                        });
                    }
                });
            }
            resolve(true);
        });
    }
}
