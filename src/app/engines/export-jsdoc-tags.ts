import type { ExportArg, ExportJsdocTag } from '../interfaces/export-data.interface';

type Fields = Record<string, unknown>;

type PlainJsdocTag = ExportJsdocTag & { dotDotDotToken?: boolean; function?: ExportArg[] };

const isObject = (value: unknown): value is Fields => typeof value === 'object' && value !== null;

/** `text`, else `escapedText`, of a name node; a string stays as it is. */
const nameText = (value: unknown): string | undefined => {
    if (typeof value === 'string') {
        return value;
    }
    if (!isObject(value)) {
        return undefined;
    }
    const text = value.text ?? value.escapedText;
    return typeof text === 'string' ? text : undefined;
};

/** Copies the listed fields that are defined, in the order of the list. */
const pick = (source: Fields, keys: readonly string[]): Fields => {
    const out: Fields = {};
    for (const key of keys) {
        if (source[key] !== undefined) {
            out[key] = source[key];
        }
    }
    return out;
};

const ARG_FIELDS = [
    'type',
    'optional',
    'dotDotDotToken',
    'deprecated',
    'deprecationMessage',
    'description',
    'defaultValue'
] as const;

const TAG_FIELDS = [
    'type',
    'defaultValue',
    'optional',
    'deprecated',
    'deprecationMessage',
    'dotDotDotToken'
] as const;

const toExportArg = (arg: unknown): ExportArg => {
    const fields = isObject(arg) ? arg : {};
    return { name: nameText(fields.name) ?? '', ...pick(fields, ARG_FIELDS) } as ExportArg;
};

/** One JSDoc tag of the engine (a TS node or a compodocx object) as written to the export. */
export const toExportJsdocTag = (tag: Fields): PlainJsdocTag => {
    const out: Fields = {};
    const tagName = nameText(tag.tagName);
    if (tagName !== undefined) {
        out.tagName = { text: tagName };
    }
    if (typeof tag.comment === 'string') {
        out.comment = tag.comment;
    }
    const name = nameText(tag.name);
    if (name !== undefined) {
        out.name = name;
    }
    Object.assign(out, pick(tag, TAG_FIELDS));
    if (Array.isArray(tag.function)) {
        out.function = tag.function.map(toExportArg);
    }
    return out as PlainJsdocTag;
};

/** `JSON.stringify` replacer: every `jsdoctags` array, at any depth, as plain tag objects. */
export const jsdocTagsReplacer = (key: string, value: unknown): unknown =>
    key === 'jsdoctags' && Array.isArray(value)
        ? value.map(tag => toExportJsdocTag(isObject(tag) ? tag : {}))
        : value;
