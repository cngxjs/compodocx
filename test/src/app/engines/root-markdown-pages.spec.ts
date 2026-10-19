import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import Configuration from '../../../../src/app/configuration';
import {
    clearCustomTemplates,
    loadCustomTemplates
} from '../../../../src/app/engines/custom-template.engine';
import { HtmlEngine } from '../../../../src/app/engines/html.engine';

const ROOT_MARKDOWN_CONTEXTS = ['readme', 'changelog', 'contributing', 'license', 'todo'];

const renderPage = (context: string): string =>
    HtmlEngine.getInstance().render(Configuration.mainData, {
        context,
        name: context,
        id: context,
        depth: 0,
        markdown: `<p id="root-md-${context}">Body of ${context}</p>`
    });

describe('root markdown pages', () => {
    afterEach(() => {
        clearCustomTemplates();
    });

    it.each(ROOT_MARKDOWN_CONTEXTS)('renders the %s markdown content', context => {
        expect(renderPage(context)).toContain(`<p id="root-md-${context}">Body of ${context}</p>`);
    });

    it('applies the markdown override to the todo page', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-templates-'));
        try {
            fs.mkdirSync(path.join(dir, 'partials'));
            fs.writeFileSync(
                path.join(dir, 'partials', 'markdown.js'),
                `module.exports = data => '<p id="custom-markdown">' + data.context + '</p>';`
            );
            loadCustomTemplates(dir);
            expect(renderPage('todo')).toContain('<p id="custom-markdown">todo</p>');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
