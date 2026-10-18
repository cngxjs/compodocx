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

    it('ignores the removed module and modules overrides with a warning', () => {
        for (const name of ['module', 'modules']) {
            fs.writeFileSync(
                path.join(dir, 'partials', `${name}.js`),
                `module.exports = () => '<p>${name}</p>';`
            );
        }
        loadCustomTemplates(dir);
        const warnings = vi.mocked(logger.warn).mock.calls.map(call => String(call[0]));
        expect(warnings).toContain(
            'Custom template module.js is ignored (its page or block no longer exists); see MIGRATION.md'
        );
        expect(warnings).toContain(
            'Custom template modules.js is ignored (its page or block no longer exists); see MIGRATION.md'
        );
        expect(renderCustomTemplate('module', {})).toBeNull();
        expect(renderCustomTemplate('modules', {})).toBeNull();
    });

    it('ignores the removed block-enum, block-typealias and block-host-listener overrides', () => {
        const names = ['block-enum', 'block-typealias', 'block-host-listener'];
        for (const name of names) {
            fs.writeFileSync(
                path.join(dir, 'partials', `${name}.js`),
                `module.exports = () => '<p>${name}</p>';`
            );
        }
        loadCustomTemplates(dir);
        const warnings = vi.mocked(logger.warn).mock.calls.map(call => String(call[0]));
        for (const name of names) {
            expect(warnings).toContain(
                `Custom template ${name}.js is ignored (its page or block no longer exists); see MIGRATION.md`
            );
            expect(renderCustomTemplate(name, {})).toBeNull();
        }
    });

    it('warns once per file and ignores it; other overrides still load', () => {
        loadCustomTemplates(dir);
        const warnings = vi.mocked(logger.warn).mock.calls.map(call => String(call[0]));
        expect(warnings).toHaveLength(2);
        expect(warnings[0]).toContain(
            'bucket-landing.js is ignored (its page or block no longer exists)'
        );
        expect(warnings[1]).toContain(
            'miscellaneous-functions.js is ignored (renamed to "utilities"'
        );
        expect(warnings.every(w => w.includes('see MIGRATION.md'))).toBe(true);
        expect(renderCustomTemplate('bucket-landing', {})).toBeNull();
        expect(renderCustomTemplate('overview', {})).toBe('<p>overview</p>');
    });

    it('warns once about Handlebars partials and skips them', () => {
        for (const name of ['component.hbs', 'block-method.hbs']) {
            fs.writeFileSync(path.join(dir, 'partials', name), '<p>{{name}}</p>');
        }
        loadCustomTemplates(dir);
        const warnings = vi
            .mocked(logger.warn)
            .mock.calls.map(call => String(call[0]))
            .filter(w => w.includes('.hbs'));
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain('Found 2 .hbs file(s)');
        expect(warnings[0]).toContain('Handlebars templates are no longer supported');
        expect(warnings[0]).toContain('docs/custom-templates.md');
        expect(renderCustomTemplate('component', {})).toBeNull();
    });
});
