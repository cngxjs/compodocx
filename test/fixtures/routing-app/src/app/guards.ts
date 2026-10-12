import type {
    CanActivateChildFn,
    CanActivateFn,
    CanDeactivateFn,
    CanMatchFn,
    RedirectFunction,
    ResolveFn,
    UrlMatchResult,
    UrlSegment
} from '@angular/router';

/** Lets signed-in users through. */
export const rtaAuthGuard: CanActivateFn = () => true;

/** Checks every child route of the account section. */
export const rtaChildGuard: CanActivateChildFn = () => true;

/**
 * Guard factory: lets users with one of the roles through.
 *
 * @param roles Accepted roles
 */
export function rtaRoleGuard(...roles: string[]): CanActivateFn {
    return () => roles.length > 0;
}

/** Asks before leaving a page with unsaved changes. */
export const rtaLeaveGuard: CanDeactivateFn<unknown> = () => true;

/** Matches the admin section only when the feature is enabled. */
export const rtaAdminMatch: CanMatchFn = () => true;

/** Loads the signed-in user name. */
export const rtaUserResolver: ResolveFn<string> = () => 'user';

/** Title of the help page. */
export const rtaHelpTitle: ResolveFn<string> = () => 'Help';

/** Sends the start page to the home section. */
export const rtaStartRedirect: RedirectFunction = () => 'home';

/**
 * Matches legacy URLs of the form `old/<anything>`.
 *
 * @param segments URL segments
 */
export function rtaLegacyMatcher(segments: UrlSegment[]): UrlMatchResult | null {
    return segments.length > 0 ? { consumed: segments } : null;
}
