import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { SessionService } from './session.service';

/**
 * Lets only signed-in users through.
 */
export const signedInGuard: CanActivateFn = () => inject(SessionService).isSignedIn();
