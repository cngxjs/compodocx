import { describe, expect, it } from 'vitest';

import {
    BUILD_STEP_MS,
    buildSchedule,
    dependencyLevels,
    LEVEL0_MAX_MS,
    levelAt
} from '../../../src/client/graph-levels';

const e = (source: string, target: string) => ({ source, target });

describe('dependencyLevels', () => {
    it('puts what nothing else is built on at level 0', () => {
        const levels = dependencyLevels(['a', 'b'], []);
        expect([...levels]).toEqual([
            ['a', 0],
            ['b', 0]
        ]);
    });

    it('puts a symbol one above the highest level it uses', () => {
        const levels = dependencyLevels(
            ['app', 'card', 'button', 'icon'],
            [e('app', 'card'), e('app', 'icon'), e('card', 'button'), e('button', 'icon')]
        );
        expect(Object.fromEntries(levels)).toEqual({ icon: 0, button: 1, card: 2, app: 3 });
    });

    it('lets a cycle share one level', () => {
        const levels = dependencyLevels(
            ['a', 'b', 'c', 'base', 'top'],
            [e('a', 'b'), e('b', 'c'), e('c', 'a'), e('c', 'base'), e('top', 'a')]
        );
        expect(levels.get('base')).toBe(0);
        expect(levels.get('a')).toBe(1);
        expect(levels.get('b')).toBe(1);
        expect(levels.get('c')).toBe(1);
        expect(levels.get('top')).toBe(2);
    });

    it('ignores edges to unknown ids and self edges', () => {
        const levels = dependencyLevels(['a'], [e('a', 'zzz'), e('a', 'a')]);
        expect(levels.get('a')).toBe(0);
    });

    it('handles long chains without recursion', () => {
        const ids = Array.from({ length: 20_000 }, (_, i) => `n${i}`);
        const edges = ids.slice(1).map((id, i) => e(id, ids[i]));
        expect(dependencyLevels(ids, edges).get('n19999')).toBe(19_999);
    });
});

describe('buildSchedule', () => {
    const node = (id: string, group: string, x: number, level = 0) => ({
        id,
        group,
        x,
        y: 0,
        level
    });

    it('shows level 0 island by island, from the middle outward', () => {
        const schedule = buildSchedule([
            node('far1', 'far', 300),
            node('mid1', 'mid', 0),
            node('mid2', 'mid', 10),
            node('near1', 'near', -100)
        ]);
        const island = (id: string) => Math.floor((schedule.at.get(id) ?? 0) / 100);
        expect(island('mid1')).toBeLessThan(island('near1'));
        expect(island('near1')).toBeLessThan(island('far1'));
    });

    it('keeps level 0 within its cap however many islands there are', () => {
        const nodes = Array.from({ length: 200 }, (_, i) => node(`n${i}`, `g${i}`, i * 10));
        const schedule = buildSchedule(nodes);
        expect(Math.max(...schedule.at.values())).toBeLessThan(LEVEL0_MAX_MS + 100);
    });

    it('starts each further level one step after the one before', () => {
        const schedule = buildSchedule([
            node('a', 'g', 0),
            node('b', 'g', 5, 1),
            node('c', 'g', 9, 2)
        ]);
        expect(schedule.top).toBe(2);
        expect(schedule.at.get('b')).toBeGreaterThanOrEqual(schedule.level0Ms);
        expect((schedule.at.get('c') ?? 0) - (schedule.at.get('b') ?? 0)).toBeGreaterThan(
            BUILD_STEP_MS - 100
        );
        expect(levelAt(schedule, 0)).toBe(0);
        expect(levelAt(schedule, schedule.level0Ms + 1)).toBe(1);
        expect(levelAt(schedule, 1e6)).toBe(2);
    });

    it('schedules the same nodes the same way every time', () => {
        const nodes = [node('a', 'g', 0), node('b', 'h', 50), node('c', 'h', 60, 1)];
        expect([...buildSchedule(nodes).at]).toEqual([...buildSchedule(nodes).at]);
    });
});
