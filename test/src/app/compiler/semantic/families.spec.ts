import { describe, expect, it } from 'vitest';

import {
    type Feature,
    type FeatureModel,
    featureId,
    linkFamilies
} from '../../../../../src/app/compiler/semantic';

const feature = (entryPoint: string, key: string, label = key): Feature => ({
    id: featureId(entryPoint, key),
    entryPoint,
    key,
    label,
    root: `${entryPoint}/${key}`,
    detector: key ? 'cohesion' : 'entry-point'
});

/** `symbols`: key -> [feature id, kind]. */
const modelOf = (
    features: readonly Feature[],
    symbols: Readonly<Record<string, readonly [string, string]>>
): FeatureModel => ({
    features,
    featureOf: new Map(Object.entries(symbols).map(([key, [id]]) => [key, id])),
    families: []
});

const symbolsOf = (
    symbols: Readonly<Record<string, readonly [string, string]>>,
    usedBy: Readonly<Record<string, readonly string[]>>
) => Object.entries(symbols).map(([key, [, kind]]) => ({ key, kind, usedBy: usedBy[key] ?? [] }));

const UI_TABS = feature('@x/ui/tabs', '', 'tabs');
const COMMON_TABS = feature('@x/common', 'tabs');
const OTHERS = ['a', 'b', 'c', 'd', 'e', 'f'].map(key => feature('@x/other', key));

describe('feature families', () => {
    it('links a feature whose component wraps a component of another entry point', () => {
        const symbols = {
            UiTabs: [UI_TABS.id, 'component'],
            TabList: [COMMON_TABS.id, 'directive']
        } as const;
        const links = linkFamilies(
            modelOf([UI_TABS, COMMON_TABS, ...OTHERS], symbols),
            symbolsOf(symbols, { TabList: ['UiTabs'] })
        );
        expect(links).toEqual([
            { from: UI_TABS.id, to: COMMON_TABS.id, reason: 'wraps', edges: 1 }
        ]);
    });

    it('drops a wrapped feature that a quarter of all features use', () => {
        const users = OTHERS.slice(0, 3);
        const symbols: Record<string, readonly [string, string]> = {
            Core: [COMMON_TABS.id, 'class'],
            ...Object.fromEntries(users.map(f => [`User-${f.key}`, [f.id, 'component'] as const]))
        };
        const links = linkFamilies(
            modelOf([UI_TABS, COMMON_TABS, ...OTHERS], symbols),
            symbolsOf(symbols, { Core: users.map(f => `User-${f.key}`) })
        );
        expect(links).toEqual([]);
    });

    it('links two features of one name when an edge joins them', () => {
        const symbols = {
            injectTabs: [UI_TABS.id, 'function'],
            TABS_CONFIG: [COMMON_TABS.id, 'token']
        } as const;
        const links = linkFamilies(
            modelOf([UI_TABS, COMMON_TABS, ...OTHERS], symbols),
            symbolsOf(symbols, { TABS_CONFIG: ['injectTabs'] })
        );
        expect(links).toEqual([
            { from: UI_TABS.id, to: COMMON_TABS.id, reason: 'same-name', edges: 1 }
        ]);
    });

    it('never links on a shared name alone', () => {
        const symbols = {
            UiTabs: [UI_TABS.id, 'component'],
            Tabs: [COMMON_TABS.id, 'component']
        } as const;
        expect(
            linkFamilies(modelOf([UI_TABS, COMMON_TABS], symbols), symbolsOf(symbols, {}))
        ).toEqual([]);
    });

    it('ignores edges from symbols without a feature (hidden ones)', () => {
        const symbols = { TabList: [COMMON_TABS.id, 'directive'] } as const;
        const links = linkFamilies(
            modelOf([UI_TABS, COMMON_TABS, ...OTHERS], symbols),
            symbolsOf(symbols, { TabList: ['HiddenUiTabs'] })
        );
        expect(links).toEqual([]);
    });
});
