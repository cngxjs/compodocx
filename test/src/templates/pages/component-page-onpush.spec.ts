import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import Configuration from '../../../../src/app/configuration';
import I18nEngine from '../../../../src/app/engines/i18n.engine';
import { ComponentPage } from '../../../../src/templates/pages/ComponentPage';
import AngularVersionUtil from '../../../../src/utils/angular-version.util';

beforeAll(() => {
    I18nEngine.init('en-US');
});

const page = (component: Record<string, unknown>, angularMajor?: number): string => {
    Configuration.mainData.angularMajor = angularMajor;
    return ComponentPage({
        component: { name: 'Shell', file: 'src/shell.ts', selector: 'app-shell', ...component },
        depth: 1,
        navTabs: [{ id: 'info', href: '#info', label: 'Info' }]
    });
};

const ONPUSH_BADGE = /cdx-badge--trait"[^>]*>OnPush</;

describe('ComponentPage - OnPush default', () => {
    afterEach(() => {
        Configuration.mainData.angularMajor = undefined;
    });

    it('notes OnPush on Angular 22 when changeDetection is not set', () => {
        const html = page({}, 22);
        expect(html).toMatch(ONPUSH_BADGE);
        expect(html).toContain('OnPush (default)');
    });

    it('shows nothing on Angular 21 or an unknown version', () => {
        for (const major of [21, undefined]) {
            const html = page({}, major);
            expect(html).not.toMatch(ONPUSH_BADGE);
            expect(html).not.toContain('OnPush (default)');
        }
    });

    it('keeps an explicit strategy as written', () => {
        const eager = page({ changeDetection: 'ChangeDetectionStrategy.Default' }, 22);
        expect(eager).not.toMatch(ONPUSH_BADGE);
        expect(eager).toContain('ChangeDetectionStrategy.Default');
        const onPush = page({ changeDetection: 'ChangeDetectionStrategy.OnPush' }, 21);
        expect(onPush).toMatch(ONPUSH_BADGE);
        expect(onPush).not.toContain('OnPush (default)');
    });
});

describe('AngularVersionUtil.getAngularMajorOfProject', () => {
    const major = (pkg: unknown) => AngularVersionUtil.getAngularMajorOfProject(pkg);

    it('reads dependencies, then peerDependencies, then devDependencies', () => {
        expect(major({ dependencies: { '@angular/core': '^22.2.0' } })).toBe(22);
        expect(major({ peerDependencies: { '@angular/core': '>=21.0.0 <23.0.0' } })).toBe(21);
        expect(major({ devDependencies: { '@angular/core': '~22.0.1' } })).toBe(22);
        expect(
            major({
                dependencies: { '@angular/core': '^21.2.4' },
                devDependencies: { '@angular/core': '^22.0.0' }
            })
        ).toBe(21);
    });

    it('is undefined without @angular/core or without a number', () => {
        expect(major({})).toBeUndefined();
        expect(major({ dependencies: { '@angular/core': 'latest' } })).toBeUndefined();
    });
});
