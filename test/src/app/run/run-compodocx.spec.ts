import { describe, expect, it } from 'vitest';
import type { MainDataInterface } from '../../../../src/app/interfaces/main-data.interface';
import type { RunContext, Stage } from '../../../../src/app/run/context';
import { halt } from '../../../../src/app/run/halt';
import { type PhaseKey, phasesFor, runPhases } from '../../../../src/app/run/phases';
import { applyRunOptions } from '../../../../src/app/run/run-compodocx';
import { err, ok } from '../../../../src/lib';

const mainData = (values: Record<string, unknown>) => values as unknown as MainDataInterface;

describe('run pipeline', () => {
    it('maps every run mode to its phases', () => {
        expect(phasesFor('full')).toEqual([
            'init',
            'packageJson',
            'markdowns',
            'crawl',
            'prepare',
            'emit'
        ]);
        expect(phasesFor('coverage')).toEqual(['crawl', 'prepare', 'emit']);
        expect(phasesFor('diff')).toEqual(['microCrawl', 'prepare', 'emit']);
        expect(phasesFor('markdown')).toEqual(['resetRootMarkdownPages', 'markdowns', 'emitPages']);
        expect(phasesFor('includes')).toEqual(['resetAdditionalPages', 'includes', 'emitPages']);
    });

    it('applies only options that mainData already has', () => {
        const data = mainData({ output: './documentation/', theme: 'default' });
        applyRunOptions(data, { output: 'out/', unknownOption: true });
        expect(data).toEqual({ output: 'out/', theme: 'default' });
    });

    it('maps the name option to the documentation title', () => {
        const data = mainData({ documentationMainName: 'Application documentation' });
        applyRunOptions(data, { name: 'My docs' });
        expect(data.documentationMainName).toBe('My docs');
    });

    it('runs coverage without the init phase', () => {
        expect(phasesFor('coverage')).not.toContain('init');
        expect(phasesFor('full')[0]).toBe('init');
    });

    it('stops at the first halting phase', async () => {
        const seen: PhaseKey[] = [];
        const stub =
            (key: PhaseKey): Stage =>
            async ctx => {
                seen.push(key);
                return key === 'crawl' ? err(halt(1, 'prepare')) : ok(ctx);
            };
        const ctx = { mode: 'full' } as unknown as RunContext;

        const result = await runPhases(ctx, stub);

        expect(result).toEqual({ ok: false, message: { exitCode: 1, reason: 'prepare' } });
        expect(seen).toEqual(['init', 'packageJson', 'markdowns', 'crawl']);
    });
});
