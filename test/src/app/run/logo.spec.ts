import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { MainDataInterface } from '../../../../src/app/interfaces/main-data.interface';
import { resolveLogoLayout } from '../../../../src/app/run/logo';

let dir: string;

const mainData = (customLogo: string, logoLayout = 'auto') =>
    ({ customLogo, logoLayout }) as unknown as MainDataInterface;

beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'cdx-logo-'));
    writeFileSync(path.join(dir, 'wide.svg'), '<svg viewBox="0 0 400 100"></svg>');
    writeFileSync(path.join(dir, 'square.svg'), '<svg viewBox="0 0 64 64"></svg>');
    writeFileSync(path.join(dir, 'photo.jpg'), 'not read');
});

afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
});

describe('resolveLogoLayout', () => {
    it('reads the aspect ratio of the file for auto', async () => {
        expect(await resolveLogoLayout(mainData(path.join(dir, 'wide.svg')))).toBe('wordmark');
        expect(await resolveLogoLayout(mainData(path.join(dir, 'square.svg')))).toBe('icon');
    });

    it('keeps the logo-only layout for an unreadable format or a missing file', async () => {
        expect(await resolveLogoLayout(mainData(path.join(dir, 'photo.jpg')))).toBe('wordmark');
        expect(await resolveLogoLayout(mainData(path.join(dir, 'missing.svg')))).toBe('wordmark');
    });

    it('uses an explicit layout without reading the file', async () => {
        expect(await resolveLogoLayout(mainData(path.join(dir, 'missing.svg'), 'icon'))).toBe(
            'icon'
        );
        expect(await resolveLogoLayout(mainData(path.join(dir, 'square.svg'), 'wordmark'))).toBe(
            'wordmark'
        );
    });
});
