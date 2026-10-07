import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import { markedAcl } from '../../utils/marked.acl';
import Configuration from '../configuration';
import DependenciesEngine from '../engines/dependencies.engine';
import MarkdownEngine from '../engines/markdown.engine';
import { pageLocation } from '../links/layout';
import type { NavTabsResolver } from './nav-tabs';

/**
 * Emits one HTML page per `InjectionToken` / `HttpContextToken`
 * declaration, at `tokens/<name>.html`. Mirrors
 * `InjectablePageGenerator` but routes to the leaner `TokenPage`
 * template instead of the shared entity page — tokens have no
 * methods / inputs / outputs / API tab.
 */
export class TokenPageGenerator {
    constructor(private readonly navTabs: NavTabsResolver) {}

    public prepare(someTokens?: any[]): Promise<void> {
        logger.info('Prepare tokens');

        Configuration.mainData.tokens = someTokens ?? DependenciesEngine.getTokens();

        return new Promise(resolve => {
            const tokens = Configuration.mainData.tokens ?? [];
            for (const token of tokens) {
                if (MarkdownEngine.hasNeighbourReadmeFile(token.file)) {
                    logger.info(` ${token.name} has a README file, include it`);
                    const readme = MarkdownEngine.readNeighbourReadmeFile(token.file);
                    token.readme = markedAcl(readme);
                }
                const location = pageLocation({ type: 'symbol', kind: 'token', name: token.name });
                const page: any = {
                    path: location.path,
                    name: token.name,
                    id: token.id,
                    navTabs: this.navTabs.resolve(token),
                    context: 'token',
                    token,
                    depth: location.depth,
                    pageType: COMPODOC_DEFAULTS.PAGE_TYPES.INTERNAL
                };
                if (token.isDuplicate) {
                    page.name += `-${token.duplicateId}`;
                }
                Configuration.addPage(page);
            }
            resolve();
        });
    }
}
