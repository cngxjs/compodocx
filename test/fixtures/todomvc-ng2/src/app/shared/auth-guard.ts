import { CanActivateFn } from '@angular/router';

export const AuthGuard: CanActivateFn = () => {
    return true;
};
