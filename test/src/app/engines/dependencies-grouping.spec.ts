import { describe, expect, it } from 'vitest';

import { buildGroupTree } from '../../../../src/app/engines/dependencies.engine';

describe('buildGroupTree', () => {
    it('should return empty array for empty input', () => {
        expect(buildGroupTree({})).toEqual([]);
    });

    it('should create flat nodes for single-segment keys', () => {
        const tree = buildGroupTree({
            dashboard: [{ name: 'A' }, { name: 'B' }],
            settings: [{ name: 'C' }]
        });
        expect(tree).toHaveLength(2);
        expect(tree[0].name).toBe('dashboard');
        expect(tree[0].items).toHaveLength(2);
        expect(tree[1].name).toBe('settings');
        expect(tree[1].items).toHaveLength(1);
    });

    it('should nest multi-segment keys into a tree', () => {
        const tree = buildGroupTree({
            'features/admin': [{ name: 'AdminPanel' }],
            'features/admin/ui': [{ name: 'AuditLog' }, { name: 'RoleManager' }],
            'features/settings': [{ name: 'Settings' }]
        });

        expect(tree).toHaveLength(1);
        expect(tree[0].name).toBe('features');
        expect(tree[0].items).toHaveLength(0); // pure container
        expect(tree[0].children).toHaveLength(2); // admin, settings

        const admin = tree[0].children.find(c => c.name === 'admin')!;
        expect(admin.items).toHaveLength(1);
        expect(admin.items[0].name).toBe('AdminPanel');
        expect(admin.children).toHaveLength(1);

        const ui = admin.children[0];
        expect(ui.name).toBe('ui');
        expect(ui.items).toHaveLength(2);
    });

    it('should NOT path-compress single-child containers', () => {
        const tree = buildGroupTree({
            'users/components': [{ name: 'UserList' }, { name: 'UserCard' }]
        });

        // Should be users > components, not "users/components"
        expect(tree).toHaveLength(1);
        expect(tree[0].name).toBe('users');
        expect(tree[0].items).toHaveLength(0);
        expect(tree[0].children).toHaveLength(1);
        expect(tree[0].children[0].name).toBe('components');
        expect(tree[0].children[0].items).toHaveLength(2);
    });

    it('should create intermediate nodes with no items', () => {
        const tree = buildGroupTree({
            'a/b/c': [{ name: 'X' }]
        });

        expect(tree[0].name).toBe('a');
        expect(tree[0].items).toHaveLength(0);
        expect(tree[0].children[0].name).toBe('b');
        expect(tree[0].children[0].items).toHaveLength(0);
        expect(tree[0].children[0].children[0].name).toBe('c');
        expect(tree[0].children[0].children[0].items).toHaveLength(1);
    });

    it('should sort children alphabetically', () => {
        const tree = buildGroupTree({
            'z-folder': [{ name: 'Z' }],
            'a-folder': [{ name: 'A' }],
            'm-folder': [{ name: 'M' }]
        });

        expect(tree.map(n => n.name)).toEqual(['a-folder', 'm-folder', 'z-folder']);
    });

    it('should set correct fullPath on all nodes', () => {
        const tree = buildGroupTree({
            'features/admin/ui/settings': [{ name: 'S' }]
        });

        expect(tree[0].fullPath).toBe('features');
        expect(tree[0].children[0].fullPath).toBe('features/admin');
        expect(tree[0].children[0].children[0].fullPath).toBe('features/admin/ui');
        expect(tree[0].children[0].children[0].children[0].fullPath).toBe(
            'features/admin/ui/settings'
        );
    });

    it('should handle mix of depths correctly', () => {
        const tree = buildGroupTree({
            dashboard: [{ name: 'D1' }, { name: 'D2' }],
            'shared/directives': [{ name: 'S1' }],
            'features/admin': [{ name: 'F1' }],
            'features/admin/ui': [{ name: 'F2' }]
        });

        expect(tree).toHaveLength(3); // dashboard, features, shared
        const names = tree.map(n => n.name);
        expect(names).toContain('dashboard');
        expect(names).toContain('features');
        expect(names).toContain('shared');
    });
});
