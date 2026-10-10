import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import {
    clearCustomTemplates,
    loadCustomTemplates,
    renderCustomTemplate
} from '../../../../src/app/engines/custom-template.engine';
import { logger } from '../../../../src/utils/logger';

describe('custom templates with removed or renamed override names', () => {
    let dir: string;

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-templates-'));
        fs.mkdirSync(path.join(dir, 'partials'));
        for (const name of ['bucket-landing', 'miscellaneous-functions', 'overview']) {
            fs.writeFileSync(
                path.join(dir, 'partials', `${name}.js`),
                `module.exports = () => '<p>${name}</p>';`
            );
        }
        vi.clearAllMocks();
    });

    afterEach(() => {
        clearCustomTemplates();
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('warns once per file and ignores it; other overrides still load', () => {
        loadCustomTemplates(dir);
        const warnings = vi.mocked(logger.warn).mock.calls.map(call => String(call[0]));
        expect(warnings).toHaveLength(2);
        expect(warnings[0]).toContain('bucket-landing.js is ignored (its page no longer exists)');
        expect(warnings[1]).toContain(
            'miscellaneous-functions.js is ignored (renamed to "utilities"'
        );
        expect(warnings.every(w => w.includes('compodocx migrate'))).toBe(true);
        expect(renderCustomTemplate('bucket-landing', {})).toBeNull();
        expect(renderCustomTemplate('overview', {})).toBe('<p>overview</p>');
    });
});
