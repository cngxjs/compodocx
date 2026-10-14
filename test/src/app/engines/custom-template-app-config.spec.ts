import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import Configuration from '../../../../src/app/configuration';
import {
    clearCustomTemplates,
    loadCustomTemplates
} from '../../../../src/app/engines/custom-template.engine';
import { HtmlEngine } from '../../../../src/app/engines/html.engine';

describe('app-config custom template', () => {
    let dir: string;

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-templates-'));
        fs.mkdirSync(path.join(dir, 'partials'));
        for (const name of ['app-config', 'menu']) {
            fs.writeFileSync(
                path.join(dir, 'partials', `${name}.js`),
                `module.exports = data => '<p id="custom-${name}">' + data.context + '</p>';`
            );
        }
        loadCustomTemplates(dir);
    });

    afterEach(() => {
        clearCustomTemplates();
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('replaces the app-config page content', () => {
        const html = HtmlEngine.getInstance().render(Configuration.mainData, {
            context: 'app-config',
            name: 'app-config',
            depth: 0,
            appConfig: []
        });
        expect(html).toContain('<p id="custom-app-config">app-config</p>');
    });
});
