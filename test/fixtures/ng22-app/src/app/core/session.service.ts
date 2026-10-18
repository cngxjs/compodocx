import { HttpClient, httpResource } from '@angular/common/http';
import { Service, inject, linkedSignal, signal } from '@angular/core';

/** Profile of the signed-in user. */
export interface Profile {
    name: string;
    roles: string[];
}

/**
 * Holds the signed-in user. Provided in the root injector by default.
 */
@Service()
export class SessionService {
    private readonly http = inject(HttpClient);

    /** Id of the signed-in user, `null` when signed out. */
    readonly userId = signal<string | null>(null);

    /** Profile of the signed-in user, loaded over HTTP. */
    readonly profile = httpResource<Profile>(() => `/api/users/${this.userId()}`);

    /** Selected role, reset when the profile changes; writes go through `set`. */
    readonly role = linkedSignal({
        source: () => this.profile.value()?.roles ?? [],
        computation: roles => roles[0] ?? 'guest',
        set: (value: string, write: (next: string) => void) => write(value.toLowerCase())
    });

    /** Whether a user is signed in. */
    isSignedIn(): boolean {
        return this.userId() !== null;
    }
}
