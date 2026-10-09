import { logger } from '../../utils/logger';
import { enqueueFunctionalPages } from './functional-pages';

/** One page per functional resolver (`resolvers/<name>.html`). */
export class ResolverPageGenerator {
    public prepare(): Promise<void> {
        logger.info('Prepare resolvers');
        enqueueFunctionalPages('resolver');
        return Promise.resolve();
    }
}
