const PLACEHOLDER = '{value}';

/** One `key=value` pair; a value with spaces is written in double quotes. */
const FIELD = /([A-Za-z][\w-]*)=(?:"([^"]*)"|(\S+))/g;
/** `{name}` placeholders of the configured note text. */
const NAMED_PLACEHOLDER = /\{([A-Za-z][\w-]*)\}/g;

/**
 * The fields of a structured marker value (`model=claude-opus-4.7
 * date=2026-05`, `model="Claude Opus"`), or `undefined` when the value is
 * free text: every part of it must be a `key=value` pair.
 */
export const aiGeneratedFields = (marker: string | true): Record<string, string> | undefined => {
    if (typeof marker !== 'string') {
        return undefined;
    }
    const fields: Record<string, string> = {};
    const rest = marker.replace(FIELD, (_pair, key: string, quoted?: string, plain?: string) => {
        fields[key] = quoted ?? plain ?? '';
        return '';
    });
    const onlyPairs = rest.trim() === '' && Object.keys(fields).length > 0;
    return onlyPairs ? fields : undefined;
};

/**
 * True when the configured text applies to a marker: it is set, and when it
 * names fields (`{model}`, `{date}`; `{value}` does not count) the marker has
 * at least one of them. Otherwise the translated default is used.
 */
const usesConfigured = (
    configured: string,
    fields: Record<string, string> | undefined
): boolean => {
    if (!configured) {
        return false;
    }
    const named = [...configured.matchAll(NAMED_PLACEHOLDER)]
        .map(match => match[1])
        .filter(name => name !== 'value');
    return named.length === 0 || named.some(name => fields?.[name] !== undefined);
};

/**
 * Visible sentence for an `@aiGenerated` marker, unescaped. `configured` is
 * the `aiGeneratedNote` config text; empty falls back to the translated
 * default, with the marker value when there is one. `{value}` in the text is
 * the marker value (empty for a bare marker; the values joined by `, ` for a
 * structured value), `{key}` the field of a structured value (empty when the
 * value has no such field). A configured text naming fields of which the
 * marker has none falls back to the translated default.
 */
export const aiGeneratedNoteText = (
    marker: string | true,
    configured: string,
    translate: (key: string, params?: Record<string, string>) => string
): string => {
    const fields = aiGeneratedFields(marker);
    const freeText = typeof marker === 'string' ? marker : '';
    const value = fields ? Object.values(fields).join(', ') : freeText;
    const fallback = value
        ? translate('ai-generated-note-value', { value: PLACEHOLDER })
        : translate('ai-generated-note');
    const text = usesConfigured(configured, fields) ? configured : fallback;
    return text.replace(NAMED_PLACEHOLDER, (_match, name: string) =>
        name === 'value' ? value : (fields?.[name] ?? '')
    );
};
