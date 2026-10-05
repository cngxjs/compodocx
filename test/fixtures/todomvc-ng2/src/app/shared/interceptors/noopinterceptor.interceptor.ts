import { HttpInterceptorFn } from '@angular/common/http';

export const NoopInterceptor: HttpInterceptorFn = (req, next) => {
    return next(req);
};
