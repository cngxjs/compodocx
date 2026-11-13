import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Symbol chips (Used by, Provided by, Injected by, Provides) carry
// `cdx-chip--<kind>` with the table kind; every kind with an entity colour
// needs its modifier, or the chip falls back to the grey default.
const CSS = fs.readFileSync(path.resolve('src/styles/components/content-sections.css'), 'utf8');

// `resolver` has no entity colour anywhere and stays on the default.
const KINDS = [
    'component',
    'directive',
    'pipe',
    'class',
    'interface',
    'guard',
    'interceptor',
    'injectable',
    'service',
    'entity',
    'token',
    'function',
    'variable',
    'typealias',
    'enumeration',
    'style',
    'namespace'
];

describe('symbol chip kind modifiers', () => {
    it.each(KINDS)('colours a %s chip', kind => {
        expect(CSS).toMatch(new RegExp(`\\.cdx-chip--${kind}\\b[^{]*\\{\\s*--cdx-chip-color:`));
    });
});
