import { describe, expect, it } from 'vitest';

import {
    contentVersion,
    ENTITIES_SCRIPT,
    entitiesScript,
    MENU_SCRIPT,
    menuScript
} from '../../../../src/app/page-generator/shared-scripts';
import { Layout } from '../../../../src/templates/Layout';

const page = (depth: number, menuVersion?: string) =>
    Layout({
        data: { documentationMainName: 'Docs', depth, context: 'readme', name: 'index' },
        content: '',
        menuVersion
    });

describe('shared sidebar script', () => {
    it('inserts the menu markup at the end of the sidebar', () => {
        const html = '<nav><ul class="list"><li>"quoted" </script></li></ul></nav>';
        const script = menuScript(html);
        expect(
            script.startsWith("document.getElementById('sidebar').insertAdjacentHTML('beforeend', ")
        ).toBe(true);
        const literal = /insertAdjacentHTML\('beforeend', ("(?:[^"\\]|\\.)*")\);\n$/.exec(
            script
        )?.[1];
        expect(JSON.parse(literal ?? '""')).toBe(html);
    });

    it('versions a script by the first 8 hex chars of its sha256', () => {
        expect(contentVersion('a')).toBe('ca978112');
        expect(contentVersion('a')).not.toBe(contentVersion('b'));
    });

    it('loads the script right after the sidebar, relative to the page', () => {
        const root = page(0, 'ca978112');
        expect(root).toContain(`</nav><script src="./${MENU_SCRIPT}?v=ca978112"`);
        expect(page(2, 'ca978112')).toContain(`<script src="../../${MENU_SCRIPT}?v=ca978112"`);
        const sidebar = root.slice(root.indexOf('<nav class="cdx-sidebar'));
        expect(sidebar.indexOf('<script src=')).toBe(sidebar.indexOf('</nav>') + '</nav>'.length);
    });

    it('renders no menu script without a version', () => {
        expect(page(0)).not.toContain(MENU_SCRIPT);
    });
});

describe('shared entity index script', () => {
    const index = { Foo: { href: 'app/Foo.html', kind: 'component' } };
    const withIndex = (entitiesVersion?: string) =>
        Layout({
            data: {
                documentationMainName: 'Docs',
                depth: 1,
                context: 'readme',
                name: 'index',
                entityIndex: index
            },
            content: '',
            entitiesVersion
        });

    it('assigns the index to the global the palette reads', () => {
        expect(entitiesScript(index)).toBe(`window.__CDX_ENTITIES__=${JSON.stringify(index)};`);
    });

    it('loads the script instead of an inline index', () => {
        const html = withIndex('0a1b2c3d');
        expect(html).toContain(`<script src="../${ENTITIES_SCRIPT}?v=0a1b2c3d"`);
        expect(html).not.toContain('window.__CDX_ENTITIES__');
    });

    it('renders no entity script without a version', () => {
        expect(withIndex()).not.toContain(ENTITIES_SCRIPT);
    });
});
