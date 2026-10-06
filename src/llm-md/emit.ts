/**
 * Per-entity-kind emit functions for the llm-md exporter.
 *
 * Mirrors the dispatcher shape in `src/diff/compare.ts`: walk every entity
 * bucket of `ExportData`, switch on the entity kind, and concatenate the
 * per-kind output. Every emit function is pure — it takes an immutable
 * `Export*` record and returns a markdown string.
 *
 * Source code is intentionally out of scope. We emit signatures + collapsed
 * descriptions + `@deprecated` markers. JSDoc trivia (`@since`, `@author`,
 * `@example`) is dropped because it adds tokens without helping the model
 * answer "what API does this expose?".
 */

import type {
    ExportArg,
    ExportClass,
    ExportComponent,
    ExportDirective,
    ExportEnumeration,
    ExportFunction,
    ExportGuard,
    ExportInjectable,
    ExportInterceptor,
    ExportInterface,
    ExportMethod,
    ExportPipe,
    ExportProperty,
    ExportTypeAlias,
    ExportVariable
} from '../app/interfaces/export-data.interface';
import {
    collapseDescription,
    collapseSignatureWhitespace,
    deprecatedTail,
    escapeMarkdown,
    formatMethodSignature,
    formatPropertySignature,
    inlineCode,
    joinSections
} from './format';

const fileLine = (file: string | undefined): string => (file ? `File: ${inlineCode(file)}` : '');

const descriptionLine = (description: string | undefined): string => {
    const collapsed = collapseDescription(description);
    return collapsed ? `Description: ${escapeMarkdown(collapsed)}` : '';
};

const formatArg = (arg: ExportArg): string => {
    const name = `${arg.name}${arg.optional ? '?' : ''}${arg.dotDotDotToken ? '' : ''}`;
    const prefix = arg.dotDotDotToken ? '...' : '';
    const segments = [`${prefix}${name}`];
    if (arg.type) {
        segments[0] = `${prefix}${name}: ${collapseSignatureWhitespace(arg.type)}`;
    }
    if (arg.defaultValue !== undefined && arg.defaultValue !== '') {
        segments[0] = `${segments[0]} = ${collapseSignatureWhitespace(arg.defaultValue)}`;
    }
    return segments[0];
};

const renderProperty = (prop: ExportProperty): string => {
    const sig = formatPropertySignature(prop.name, prop.type, prop.optional, prop.defaultValue);
    const dep = deprecatedTail(prop.deprecated, prop.deprecationMessage);
    const desc = collapseDescription(prop.description);
    const tail = desc ? ` — ${escapeMarkdown(desc)}` : '';
    return `- ${inlineCode(sig)}${dep}${tail}`;
};

const renderMethod = (method: ExportMethod): string => {
    const args = (method.args ?? []).map(formatArg);
    const sig = formatMethodSignature(method.name, args, method.returnType);
    const dep = deprecatedTail(method.deprecated, method.deprecationMessage);
    const desc = collapseDescription(method.description);
    const tail = desc ? ` — ${escapeMarkdown(desc)}` : '';
    return `- ${inlineCode(sig)}${dep}${tail}`;
};

const renderList = (heading: string, items: ReadonlyArray<string>): string => {
    if (items.length === 0) {
        return '';
    }
    return `${heading}:\n${items.join('\n')}`;
};

const renderProperties = (heading: string, props: ReadonlyArray<ExportProperty>): string =>
    renderList(heading, props.map(renderProperty));

const renderMethods = (heading: string, methods: ReadonlyArray<ExportMethod>): string =>
    renderList(heading, methods.map(renderMethod));

const heroLines = (
    name: string,
    file: string | undefined,
    extras: ReadonlyArray<string>
): string => {
    const heading = `### ${escapeMarkdown(name)}`;
    const meta = [fileLine(file), ...extras].filter(s => s.length > 0);
    return meta.length === 0 ? heading : `${heading}\n\n${meta.join('\n')}`;
};

export const emitComponent = (entity: ExportComponent): string => {
    const extras: string[] = [];
    if (entity.selector) {
        extras.push(`Selector: ${inlineCode(entity.selector)}`);
    }
    if (entity.standalone === true) {
        extras.push('Standalone: yes');
    }
    if (entity.changeDetection) {
        extras.push(`Change detection: ${inlineCode(String(entity.changeDetection))}`);
    }
    if (entity.exportAs) {
        extras.push(`Exported as: ${inlineCode(entity.exportAs)}`);
    }
    const description = descriptionLine(entity.description);
    const dep = deprecatedTail(entity.deprecated, entity.deprecationMessage);
    if (dep) {
        extras.push(`Deprecated:${dep}`);
    }
    return joinSections([
        heroLines(entity.name, entity.file, extras),
        description,
        renderProperties('Inputs', entity.inputsClass ?? []),
        renderProperties('Outputs', entity.outputsClass ?? []),
        renderProperties('Properties', regularProperties(entity.propertiesClass ?? [])),
        renderMethods('Methods', entity.methodsClass ?? []),
        renderThemeTokens(entity.themeTokens ?? [])
    ]);
};

const SIGNAL_DERIVED_KINDS = new Set(['signal', 'computed', 'linked-signal', 'input', 'output']);

const regularProperties = (props: ReadonlyArray<ExportProperty>): ExportProperty[] =>
    props.filter(p => {
        if (!p.kind) {
            return true;
        }
        return !SIGNAL_DERIVED_KINDS.has(p.kind);
    });

interface ThemeTokenLike {
    name: string;
    type?: string;
    defaultValue?: string;
    description?: string;
    group?: string;
    deprecated?: boolean | string | null;
    deprecationMessage?: string;
}

const renderThemeTokens = (tokens: ReadonlyArray<ThemeTokenLike>): string => {
    if (tokens.length === 0) {
        return '';
    }
    const lines = tokens.map(t => {
        const sig = formatPropertySignature(t.name, t.type, false, t.defaultValue);
        const dep = isDeprecated(t.deprecated)
            ? deprecatedTail(true, deprecationMessageOf(t.deprecated, t.deprecationMessage))
            : '';
        const desc = collapseDescription(t.description);
        const tail = desc ? ` — ${escapeMarkdown(desc)}` : '';
        const groupTag = t.group ? ` [${escapeMarkdown(t.group)}]` : '';
        return `- ${inlineCode(sig)}${groupTag}${dep}${tail}`;
    });
    return renderList('Theme tokens', lines);
};

const isDeprecated = (val: boolean | string | null | undefined): boolean => {
    if (val === null || val === undefined || val === false) {
        return false;
    }
    return true;
};

const deprecationMessageOf = (
    val: boolean | string | null | undefined,
    fallback: string | undefined
): string | undefined => {
    if (typeof val === 'string' && val.length > 0) {
        return val;
    }
    return fallback;
};

export const emitDirective = (entity: ExportDirective): string => {
    const extras: string[] = [];
    if (entity.selector) {
        extras.push(`Selector: ${inlineCode(entity.selector)}`);
    }
    if (entity.standalone === true) {
        extras.push('Standalone: yes');
    }
    const dep = deprecatedTail(entity.deprecated, entity.deprecationMessage);
    if (dep) {
        extras.push(`Deprecated:${dep}`);
    }
    return joinSections([
        heroLines(entity.name, entity.file, extras),
        descriptionLine(entity.description),
        renderProperties('Inputs', entity.inputsClass ?? []),
        renderProperties('Outputs', entity.outputsClass ?? []),
        renderProperties('Properties', regularProperties(entity.propertiesClass ?? [])),
        renderMethods('Methods', entity.methodsClass ?? [])
    ]);
};

export const emitPipe = (entity: ExportPipe): string => {
    const extras: string[] = [];
    if (entity.ngname) {
        extras.push(`Pipe name: ${inlineCode(entity.ngname)}`);
    }
    if (entity.standalone === true) {
        extras.push('Standalone: yes');
    }
    if (entity.pure !== undefined) {
        extras.push(`Pure: ${inlineCode(String(entity.pure))}`);
    }
    const dep = deprecatedTail(entity.deprecated, entity.deprecationMessage);
    if (dep) {
        extras.push(`Deprecated:${dep}`);
    }
    return joinSections([
        heroLines(entity.name, entity.file, extras),
        descriptionLine(entity.description),
        renderProperties('Properties', entity.properties ?? []),
        renderMethods('Methods', entity.methods ?? [])
    ]);
};

const emitClassLike = (
    entity: ExportClass | ExportInjectable | ExportInterceptor | ExportGuard | ExportInterface,
    extraLines: ReadonlyArray<string>
): string => {
    const dep = deprecatedTail(entity.deprecated, entity.deprecationMessage);
    const allExtras = [...extraLines];
    if (dep) {
        allExtras.push(`Deprecated:${dep}`);
    }
    return joinSections([
        heroLines(entity.name, entity.file, allExtras),
        descriptionLine(entity.description),
        renderProperties('Properties', entity.properties ?? []),
        renderMethods('Methods', entity.methods ?? [])
    ]);
};

export const emitInjectable = (entity: ExportInjectable): string => {
    const extras: string[] = [];
    if (entity.providedIn) {
        extras.push(`providedIn: ${inlineCode(entity.providedIn)}`);
    }
    if (entity.isToken) {
        extras.push(`Kind: ${entity.tokenClass ?? 'InjectionToken'}`);
        if (entity.tokenType) {
            extras.push(`Token type: ${inlineCode(entity.tokenType)}`);
        }
    }
    return emitClassLike(entity, extras);
};

export const emitInterceptor = (entity: ExportInterceptor): string => emitClassLike(entity, []);

export const emitGuard = (entity: ExportGuard): string => {
    const extras: string[] = [];
    if (entity.implements && entity.implements.length > 0) {
        extras.push(`Implements: ${entity.implements.map(s => inlineCode(s)).join(', ')}`);
    }
    return emitClassLike(entity, extras);
};

export const emitClass = (entity: ExportClass): string => {
    const extras: string[] = [];
    if (entity.extends) {
        const list = Array.isArray(entity.extends) ? entity.extends : [entity.extends];
        if (list.length > 0) {
            extras.push(`Extends: ${list.map(s => inlineCode(s)).join(', ')}`);
        }
    }
    return emitClassLike(entity, extras);
};

export const emitInterface = (entity: ExportInterface): string => {
    const extras: string[] = [];
    if (entity.extends) {
        const list = Array.isArray(entity.extends) ? entity.extends : [entity.extends];
        if (list.length > 0) {
            extras.push(`Extends: ${list.map(s => inlineCode(s)).join(', ')}`);
        }
    }
    return emitClassLike(entity, extras);
};

export const emitFunction = (entity: ExportFunction): string => {
    const args = (entity.args ?? []).map(formatArg);
    const sig = formatMethodSignature(entity.name, args, entity.returnType);
    const dep = deprecatedTail(entity.deprecated, entity.deprecationMessage);
    const desc = collapseDescription(entity.description);
    const lines = [`- ${inlineCode(sig)}${dep}`];
    if (desc) {
        lines[0] = `${lines[0]} — ${escapeMarkdown(desc)}`;
    }
    if (entity.file) {
        lines.push(`  Defined in ${inlineCode(entity.file)}`);
    }
    return lines.join('\n');
};

export const emitTypeAlias = (entity: ExportTypeAlias): string => {
    const dep = deprecatedTail(entity.deprecated, entity.deprecationMessage);
    const rhs = entity.rawtype ? ` = ${collapseSignatureWhitespace(entity.rawtype)}` : '';
    const sig = `type ${entity.name}${rhs}`;
    const desc = collapseDescription(entity.description);
    const tail = desc ? ` — ${escapeMarkdown(desc)}` : '';
    return `- ${inlineCode(sig)}${dep}${tail}`;
};

export const emitEnumeration = (entity: ExportEnumeration): string => {
    const dep = deprecatedTail(entity.deprecated, entity.deprecationMessage);
    const headerLine = `- ${inlineCode(`enum ${entity.name}`)}${dep}`;
    const descCollapsed = collapseDescription(entity.description);
    const desc = descCollapsed ? `${headerLine} — ${escapeMarkdown(descCollapsed)}` : headerLine;
    const memberLines = (entity.childs ?? []).map(m => {
        const valuePart = m.value ? ` = ${collapseSignatureWhitespace(m.value)}` : '';
        const memberDep = deprecatedTail(m.deprecated, m.deprecationMessage);
        return `  - ${inlineCode(`${m.name}${valuePart}`)}${memberDep}`;
    });
    return memberLines.length > 0 ? `${desc}\n${memberLines.join('\n')}` : desc;
};

export const emitVariable = (entity: ExportVariable): string => {
    const dep = deprecatedTail(entity.deprecated, entity.deprecationMessage);
    const sig = formatPropertySignature(entity.name, entity.type, false, entity.defaultValue);
    const desc = collapseDescription(entity.description);
    const tail = desc ? ` — ${escapeMarkdown(desc)}` : '';
    const fileTail = entity.file ? `\n  Defined in ${inlineCode(entity.file)}` : '';
    return `- ${inlineCode(sig)}${dep}${tail}${fileTail}`;
};

/** Re-exported for tests. */
export const _internals = {
    formatArg,
    renderProperty,
    renderMethod,
    regularProperties
};
