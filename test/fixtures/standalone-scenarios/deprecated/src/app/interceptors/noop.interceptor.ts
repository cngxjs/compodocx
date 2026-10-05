import { HttpInterceptorFn } from '@angular/common/http';

/**
 * @deprecated This interceptor is deprecated
 */
export const NoopInterceptor: HttpInterceptorFn = (req, next) => {
    return next(req);
};
