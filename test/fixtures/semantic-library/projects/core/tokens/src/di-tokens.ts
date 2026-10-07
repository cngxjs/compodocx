import { HttpContextToken } from '@angular/common/http';
import { InjectionToken, type Signal } from '@angular/core';

import type { FooConfig, LabelFn } from './tokens';

/** Configuration of the foo feature. */
export const FOO_CONFIG = new InjectionToken<FooConfig>('FOO_CONFIG');

/** Current label as a signal. */
export const FOO_LABEL = new InjectionToken<Signal<string>>('FOO_LABEL');

/** Label formatter. */
export const FOO_FORMATTER = new InjectionToken<LabelFn>('FOO_FORMATTER');

/** Maximum number of items. */
export const FOO_LIMIT = new InjectionToken<number>('FOO_LIMIT');

/** Display mode. */
export const FOO_MODE = new InjectionToken<'compact' | 'wide'>('FOO_MODE');

/** Registry of extra values. */
export const FOO_EXTRAS = new InjectionToken<Record<string, string>>('FOO_EXTRAS');

/** Marks requests that skip the cache. */
export const SKIP_CACHE = new HttpContextToken<boolean>(() => false);
