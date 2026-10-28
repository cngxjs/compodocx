const PLACEHOLDER = '{value}';

/**
 * Visible sentence for an `@aiGenerated` marker, unescaped. `configured` is
 * the `aiGeneratedNote` config text; empty falls back to the translated
 * default, with the marker value when there is one. `{value}` in the text is
 * replaced by the marker value (empty for a bare marker).
 */
export const aiGeneratedNoteText = (
    marker: string | true,
    configured: string,
    translate: (key: string, params?: Record<string, string>) => string
): string => {
    const value = typeof marker === 'string' ? marker : '';
    const fallback = value
        ? translate('ai-generated-note-value', { value: PLACEHOLDER })
        : translate('ai-generated-note');
    return (configured || fallback).split(PLACEHOLDER).join(value);
};
