import { HttpInterceptorFn } from '@angular/common/http';

/**
 * An interceptor that does nothing
 */
export const NoopInterceptor: HttpInterceptorFn = (req, next) => next(req);
