import { describe, expect, it } from 'vitest';

import { markedtags } from '../../../src/utils/utils';

const tag = (name: string, comment: string) => ({ tagName: { text: name }, comment });

describe('markedtags', () => {
    it('drops the dash between the name and the text of a named tag', () => {
        const [param] = markedtags([tag('param', '- The theme to apply')]);
        expect(param.comment).not.toContain('<li>');
        expect(param.comment).toContain('The theme to apply');
    });

    it('keeps a list in the text of a tag without a name', () => {
        const [note] = markedtags([tag('remarks', '- first\n- second')]);
        expect(note.comment).toContain('<li>first</li>');
    });
});
