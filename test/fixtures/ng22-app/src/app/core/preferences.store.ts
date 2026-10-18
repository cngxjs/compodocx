import { Injectable, signal } from '@angular/core';

/**
 * User preferences, written the Angular 21 way.
 */
@Injectable({ providedIn: 'root' })
export class PreferencesStore {
    /** Colour scheme. */
    readonly scheme = signal<'light' | 'dark'>('light');
}
