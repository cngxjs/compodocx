import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { componentStyleFiles } from '../../../../src/app/run/styles';

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
