import { renderFunctionalPage } from './MiscDetailPage';

/**
 * A functional resolver (`ResolveFn` constant or function). The engine keeps
 * it with the miscellaneous symbols; the page renders its signature.
 *
 * Override name: `resolver`.
 */
export const ResolverPage = (data: any): string => renderFunctionalPage(data.resolver, data.depth);
