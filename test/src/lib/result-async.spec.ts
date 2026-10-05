import { describe, expect, it } from 'vitest';
import { andThenAsync, err, ok, type Result, sequenceAsync } from '../../../src/lib';

describe('Result async helpers', () => {
    describe('andThenAsync', () => {
        it('passes the ok value to the step and returns its Result', async () => {
            const r = await andThenAsync(ok(2), n => ok(n * 3));
            expect(r).toEqual({ ok: true, value: 6 });
        });

        it('short-circuits an err without calling the step', async () => {
            let called = false;
            const r = await andThenAsync(err('boom') as Result<number>, n => {
                called = true;
                return ok(n);
            });
            expect(r).toEqual({ ok: false, message: 'boom' });
            expect(called).toBe(false);
        });

        it('awaits an async step', async () => {
            const r = await andThenAsync(ok('a'), async s => {
                await Promise.resolve();
                return ok(`${s}b`);
            });
            expect(r).toEqual({ ok: true, value: 'ab' });
        });
    });

    describe('sequenceAsync', () => {
        it('runs the steps in order, feeding each the previous value', async () => {
            const seen: string[] = [];
            const step = (tag: string) => async (value: string) => {
                seen.push(tag);
                return ok(value + tag);
            };
            const r = await sequenceAsync([step('a'), step('b'), step('c')], '>');
            expect(r).toEqual({ ok: true, value: '>abc' });
            expect(seen).toEqual(['a', 'b', 'c']);
        });

        it('stops at the first err and does not call later steps', async () => {
            const seen: string[] = [];
            const r = await sequenceAsync<number, string>(
                [
                    n => {
                        seen.push('first');
                        return ok(n + 1);
                    },
                    () => {
                        seen.push('second');
                        return err('halt');
                    },
                    n => {
                        seen.push('third');
                        return ok(n);
                    }
                ],
                0
            );
            expect(r).toEqual({ ok: false, message: 'halt' });
            expect(seen).toEqual(['first', 'second']);
        });

        it('returns ok(initial) for an empty list', async () => {
            const r = await sequenceAsync<number, string>([], 7);
            expect(r).toEqual({ ok: true, value: 7 });
        });
    });
});
