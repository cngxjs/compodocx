import * as path from 'node:path';

import { logger } from '../../utils/logger';
import Configuration from '../configuration';
import DependenciesEngine from '../engines/dependencies.engine';
import NgdEngine from '../engines/ngd.engine';

export class GraphGenerator {
    /**
     * Render the main and per-module graphs. Resolves once every graph is
     * read back; a failed module graph render or read is logged and the
     * promise stays pending, so no pages are written.
     */
    public processGraphs(): Promise<void> {
        return new Promise(resolve => this.renderGraphs(resolve));
    }

    private renderGraphs(done: () => void): void {
        if (Configuration.mainData.disableGraph) {
            logger.info('Graph generation disabled');
            done();
        } else {
            logger.info('Process main graph');
            const modules = Configuration.mainData.modules;
            let i = 0;
            const len = modules.length;
            const loop = () => {
                if (i <= len - 1) {
                    logger.info('Process module graph ', modules[i].name);
                    let finalPath = Configuration.mainData.output;
                    if (Configuration.mainData.output.lastIndexOf('/') === -1) {
                        finalPath += '/';
                    }
                    finalPath += `modules/${modules[i].name}`;
                    const _rawModule = DependenciesEngine.getRawModule(modules[i].name);
                    if (
                        _rawModule.declarations.length > 0 ||
                        _rawModule.bootstrap.length > 0 ||
                        _rawModule.imports.length > 0 ||
                        _rawModule.exports.length > 0 ||
                        _rawModule.providers.length > 0
                    ) {
                        NgdEngine.renderGraph(
                            modules[i].file,
                            finalPath,
                            'f',
                            modules[i].name
                        ).then(
                            () => {
                                NgdEngine.readGraph(
                                    path.resolve(`${finalPath + path.sep}dependencies.svg`),
                                    modules[i].name
                                ).then(
                                    data => {
                                        modules[i].graph = data;
                                        i++;
                                        loop();
                                    },
                                    err => {
                                        logger.error('Error during graph read: ', err);
                                    }
                                );
                            },
                            errorMessage => {
                                logger.error(errorMessage);
                            }
                        );
                    } else {
                        i++;
                        loop();
                    }
                } else {
                    done();
                }
            };
            let finalMainGraphPath = Configuration.mainData.output;
            if (finalMainGraphPath.lastIndexOf('/') === -1) {
                finalMainGraphPath += '/';
            }
            finalMainGraphPath += 'graph';
            NgdEngine.init(path.resolve(finalMainGraphPath));

            NgdEngine.renderGraph(
                Configuration.mainData.tsconfig,
                path.resolve(finalMainGraphPath),
                'p'
            ).then(
                () => {
                    NgdEngine.readGraph(
                        path.resolve(`${finalMainGraphPath + path.sep}dependencies.svg`),
                        'Main graph'
                    ).then(
                        data => {
                            Configuration.mainData.mainGraph = data;
                            loop();
                        },
                        err => {
                            logger.error('Error during main graph reading : ', err);
                            Configuration.mainData.disableMainGraph = true;
                            loop();
                        }
                    );
                },
                err => {
                    logger.error(
                        'Ooops error during main graph generation, moving on next part with main graph disabled : ',
                        err
                    );
                    Configuration.mainData.disableMainGraph = true;
                    loop();
                }
            );
        }
    }
}
