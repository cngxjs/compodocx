import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { componentStyleFiles, logStyles } from '../../../../src/app/run/styles';
import { buildStyleModel } from '../../../../src/app/styles';
import { logger } from '../../../../src/utils/logger';

describe('logStyles', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    const warningsFor = (content: string): string[] => {
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
        vi.spyOn(logger, 'info').mockImplementation(() => undefined);
        vi.spyOn(logger, 'debug').mockImplementation(() => undefined);
        const model = buildStyleModel([{ file: 'kit/theming/plain.css', content }]);
        logStyles({ model, problems: [], ignored: [], skipped: [] });
        return warn.mock.calls.map(call => String(call[0]));
    };

    it('warns once when a file without content names @themes targets', () => {
        expect(warningsFor('/**\n * @themes StyCard, StyTooltip\n */\nbody {}\n')).toEqual([
            'Style file kit/theming/plain.css: @themes StyCard, StyTooltip ignored, ' +
                'the file has no overview, documented token or mixin'
        ]);
    });

    it('does not warn for a file without content and without @themes', () => {
        expect(warningsFor('/* reset */\nbody { margin: 0; }\n')).toEqual([]);
    });
});

describe('componentStyleFiles', () => {
    it('resolves each component styleUrl against its file, relative to the cwd', () => {
        const cwd = path.resolve('/repo');
        const files = componentStyleFiles(
            [
                {
                    file: 'projects/kit/src/button/button.ts',
                    styleUrls: ['./button.css', '../shared.scss']
                },
                { file: 'projects/kit/src/card/card.ts', styleUrls: [] },
                { styleUrls: ['./orphan.css'] }
            ],
            cwd
        );
        expect([...files]).toEqual([
            'projects/kit/src/button/button.css',
            'projects/kit/src/shared.scss'
        ]);
    });
});
