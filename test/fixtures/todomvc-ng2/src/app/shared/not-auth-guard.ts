import { CanMatchFn } from '@angular/router';

export const NotAuthGuard: CanMatchFn = () => {
    return true;
};
