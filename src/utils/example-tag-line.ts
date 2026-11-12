/** Label of an `@example` caption, the same for every example renderer. */
export const exampleCaptionHtml = (caption: string): string => `<b><i>${caption.trim()}</i></b>`;

/** What follows the `@example` tag line. */
export type ExampleFollower = 'fence' | 'gap-then-fence' | 'code';

/** Classifies what follows the tag line from the first non-empty line after it. */
export function exampleFollower(fenceFollows: boolean, emptyLineFirst: boolean): ExampleFollower {
    if (!fenceFollows) {
        return 'code';
    }
    return emptyLineFirst ? 'gap-then-fence' : 'fence';
}

/** Text after `@example` on the tag line, split by role. */
export interface ExampleTagLine {
    readonly caption: string;
    readonly text: string;
    readonly code: string;
}

const CAPTION_ELEMENT = /<caption>([\s\S]*?)<\/caption>/;

/**
 * Splits the text after `@example` on the tag line. A `<caption>` element is
 * always the caption. The remaining text is part of the caption when a code
 * fence follows directly, plain text when an empty line comes first, and the
 * first code line when no fence follows.
 */
export function splitExampleTagLine(rest: string, follower: ExampleFollower): ExampleTagLine {
    const element = CAPTION_ELEMENT.exec(rest);
    const tagged = element ? element[1].trim() : '';
    const remainder = (element ? rest.replace(element[0], '') : rest).trim();
    if (follower === 'fence') {
        return { caption: [tagged, remainder].filter(Boolean).join(' '), text: '', code: '' };
    }
    if (follower === 'gap-then-fence') {
        return { caption: tagged, text: remainder, code: '' };
    }
    return { caption: tagged, text: '', code: remainder };
}

/**
 * A body whose first line directly precedes its first code fence: that line
 * is a caption. Returns `undefined` for every other body.
 */
export function leadingCaptionLine(body: string): { caption: string; rest: string } | undefined {
    const fence = /^```/m.exec(body);
    if (!fence || fence.index === 0) {
        return undefined;
    }
    const before = body.slice(0, fence.index);
    const line = before.replace(/\n$/, '');
    if (line.trim() === '' || line.includes('\n')) {
        return undefined;
    }
    return { caption: line, rest: body.slice(fence.index) };
}
