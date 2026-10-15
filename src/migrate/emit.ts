/**
 * JS source emission from a Handlebars AST.
 *
 * `convert(source)` returns the body of the override function - pure string,
 * ready to wrap in `module.exports = function(data, helpers) { return \`<body>\`; }`.
 * `wrapModule(body, ...)` does that wrap.
 *
 * Pure functions throughout: each emitter takes a node + scope stack + warning
 * sink and returns a string. The sink is the only mutable thing and lives at
 * the top of `convert`.
 */

import type {
    AstBlockStatement,
    AstBooleanLiteral,
    AstContentStatement,
    AstExpression,
    AstHash,
    AstMustacheStatement,
    AstNumberLiteral,
    AstPartialStatement,
    AstPathExpression,
    AstProgram,
    AstStatement,
    AstStringLiteral,
    AstSubExpression,
    ScopeFrame
} from './ast';
import { isValidIdentifier, normalizePath, parse, ROOT_SCOPE } from './ast';
import { lookupHelper } from './helper-map';
import type { Warning } from './types';

export interface EmitContext {
    readonly file: string;
    readonly scopes: readonly ScopeFrame[];
}

const ROOT_CONTEXT = (file: string): EmitContext => ({ file, scopes: [ROOT_SCOPE] });

const pushScope = (ctx: EmitContext, frame: ScopeFrame): EmitContext => ({
    ...ctx,
    scopes: [...ctx.scopes, frame]
});

type Sink = (w: Warning) => void;

const warn = (
    sink: Sink,
    ctx: EmitContext,
    node: { loc?: { start?: { line: number; column: number } } },
    kind: Warning['kind'],
    message: string
): void => {
    sink({
        file: ctx.file,
        line: node.loc?.start?.line ?? 0,
        column: node.loc?.start?.column,
        kind,
        message
    });
};

/** Escape a literal string segment for embedding in a JS template literal. */
export const escapeForTemplateLiteral = (text: string): string =>
    text.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${');

const emitContent = (node: AstContentStatement): string => escapeForTemplateLiteral(node.value);

const emitLiteralExpression = (node: AstExpression): string => {
    switch ((node as { type: string }).type) {
        case 'StringLiteral':
            return JSON.stringify((node as AstStringLiteral).value);
        case 'NumberLiteral':
            return String((node as AstNumberLiteral).value);
        case 'BooleanLiteral':
            return String((node as AstBooleanLiteral).value);
        case 'NullLiteral':
            return 'null';
        case 'UndefinedLiteral':
            return 'undefined';
        default:
            return '';
    }
};

const emitArgument = (node: AstExpression, ctx: EmitContext, sink: Sink): string => {
    switch ((node as { type: string }).type) {
        case 'PathExpression':
            return normalizePath(node as AstPathExpression, ctx.scopes);
        case 'SubExpression':
            return emitSubExpression(node as AstSubExpression, ctx, sink);
        default:
            return emitLiteralExpression(node);
    }
};

const emitHash = (hash: AstHash | undefined, ctx: EmitContext, sink: Sink): string => {
    if (!hash?.pairs || hash.pairs.length === 0) {
        return '';
    }
    const pairs = hash.pairs.map(p => {
        const key = isValidIdentifier(p.key) ? p.key : JSON.stringify(p.key);
        return `${key}: ${emitArgument(p.value as AstExpression, ctx, sink)}`;
    });
    return `{ ${pairs.join(', ')} }`;
};

const emitHelperCall = (
    name: string,
    params: readonly AstExpression[],
    hash: AstHash,
    node: AstMustacheStatement | AstSubExpression,
    ctx: EmitContext,
    sink: Sink
): string => {
    const args = params.map(p => emitArgument(p, ctx, sink));
    const hashLiteral = emitHash(hash, ctx, sink);
    const allArgs = hashLiteral ? [...args, hashLiteral] : args;

    const mapping = lookupHelper(name);
    if (!mapping) {
        warn(sink, ctx, node, 'unknown-helper', `unknown helper "${name}"`);
        return `/* TODO(migrate): unknown helper "${name}" */ ''`;
    }
    if (mapping.kind === 'rename') {
        return `helpers.${mapping.to}(${allArgs.join(', ')})`;
    }
    if (mapping.kind === 'lossy-rename') {
        warn(sink, ctx, node, 'lossy-rename', `${name} → ${mapping.to}: ${mapping.reason}`);
        return `helpers.${mapping.to}(${allArgs.join(', ')})`;
    }
    if (mapping.kind === 'inline') {
        return mapping.emit(args);
    }
    if (mapping.kind === 'removed') {
        warn(sink, ctx, node, 'removed-construct', `helper "${name}" removed: ${mapping.reason}`);
        return "''";
    }
    warn(sink, ctx, node, 'unknown-helper', mapping.warn);
    return `/* TODO(migrate): ${mapping.warn} */ ''`;
};

const emitSubExpression = (node: AstSubExpression, ctx: EmitContext, sink: Sink): string =>
    emitHelperCall(node.path.original, node.params, node.hash, node, ctx, sink);

/** Emit a `{{...}}` mustache as a JS expression returning a string. */
const emitMustacheExpression = (
    node: AstMustacheStatement,
    ctx: EmitContext,
    sink: Sink
): string => {
    const path = node.path as AstPathExpression;
    const isHelperCall = node.params.length > 0 || (node.hash?.pairs?.length ?? 0) > 0;

    if (isHelperCall) {
        return emitHelperCall(path.original, node.params, node.hash, node, ctx, sink);
    }

    // Identifier-only mustache: could be a path or a 0-arg helper. Helper map
    // lookup wins (matches Handlebars' resolution for known helpers).
    const name = path.original;
    if (lookupHelper(name)) {
        return emitHelperCall(name, [], node.hash, node, ctx, sink);
    }
    return `${normalizePath(path, ctx.scopes)} ?? ''`;
};

const emitMustache = (node: AstMustacheStatement, ctx: EmitContext, sink: Sink): string =>
    `\${${emitMustacheExpression(node, ctx, sink)}}`;

const emitProgramAsTemplate = (program: AstProgram, ctx: EmitContext, sink: Sink): string => {
    const fragments = program.body.map(stmt => emitStatement(stmt, ctx, sink));
    return `\`${fragments.join('')}\``;
};

const emitIfBlock = (node: AstBlockStatement, ctx: EmitContext, sink: Sink): string => {
    const cond = emitArgument(node.params[0], ctx, sink);
    const truthy = emitProgramAsTemplate(node.program, ctx, sink);
    const falsy = node.inverse ? emitProgramAsTemplate(node.inverse, ctx, sink) : "''";
    return `\${${cond} ? ${truthy} : ${falsy}}`;
};

const emitUnlessBlock = (node: AstBlockStatement, ctx: EmitContext, sink: Sink): string => {
    const cond = emitArgument(node.params[0], ctx, sink);
    const truthy = emitProgramAsTemplate(node.program, ctx, sink);
    const falsy = node.inverse ? emitProgramAsTemplate(node.inverse, ctx, sink) : "''";
    return `\${!(${cond}) ? ${truthy} : ${falsy}}`;
};

interface EachBindings {
    readonly item: string;
    readonly index: string;
    readonly aliases: Readonly<Record<string, string>>;
}

const eachBindings = (node: AstBlockStatement): EachBindings => {
    const params = node.program?.blockParams ?? [];
    const item = params[0] ?? 'item';
    const index = params[1] ?? '__hbs_index';
    // When users write `as |row idx|`, both names also need to be visible
    // inside the body as path-prefix aliases (so `{{row.name}}` resolves to
    // `row.name` instead of `row.row.name`). The default `item` binding
    // doesn't need an alias entry because the implicit `<scope>.name` lookup
    // already lands on it.
    const aliases =
        params.length > 0
            ? { [item]: item, [index]: index }
            : ({} as Readonly<Record<string, string>>);
    return { item, index, aliases };
};

const emitEachBlock = (node: AstBlockStatement, ctx: EmitContext, sink: Sink): string => {
    const collection = emitArgument(node.params[0], ctx, sink);
    const { item, index, aliases } = eachBindings(node);
    const childCtx = pushScope(ctx, { binding: item, optional: false, aliases });
    const body = emitProgramAsTemplate(node.program, childCtx, sink);
    // Re-bind `__hbs_index` so `{{@index}}` paths resolve to the loop index.
    const renamedBody = body.replaceAll('__hbs_index', index);
    const fallback = node.inverse ? emitProgramAsTemplate(node.inverse, ctx, sink) : "''";
    const map = `(${collection} ?? []).map((${item}, ${index}) => ${renamedBody}).join('')`;
    if (!node.inverse) {
        return `\${${map}}`;
    }
    return `\${(${collection} ?? []).length > 0 ? ${map} : ${fallback}}`;
};

const emitWithBlock = (node: AstBlockStatement, ctx: EmitContext, sink: Sink): string => {
    const target = emitArgument(node.params[0], ctx, sink);
    const binding = `__hbs_with_${ctx.scopes.length}`;
    const childCtx = pushScope(ctx, { binding, optional: true });
    const body = emitProgramAsTemplate(node.program, childCtx, sink);
    return `\${(() => { const ${binding} = ${target}; return ${body}; })()}`;
};

type BlockHandler = (node: AstBlockStatement, ctx: EmitContext, sink: Sink) => string;

const BUILTIN_BLOCKS: Readonly<Record<string, BlockHandler>> = {
    if: emitIfBlock,
    unless: emitUnlessBlock,
    each: emitEachBlock,
    with: emitWithBlock
};

const emitBlock = (node: AstBlockStatement, ctx: EmitContext, sink: Sink): string => {
    const name = node.path.original;
    const builtin = BUILTIN_BLOCKS[name];
    if (builtin) {
        return builtin(node, ctx, sink);
    }

    // Custom block helpers like `#compare`, `#or`, `#ifEqualString`. The legacy
    // forms wrap the inner program when truthy and the inverse when falsy -
    // mapping cleanly to a ternary on the inline emit.
    const mapping = lookupHelper(name);
    const truthy = emitProgramAsTemplate(node.program, ctx, sink);
    const falsy = node.inverse ? emitProgramAsTemplate(node.inverse, ctx, sink) : "''";

    if (!mapping) {
        warn(sink, ctx, node, 'unsupported-block', `unknown block helper "#${name}"`);
        return `\${(/* TODO(migrate): unknown block helper "#${name}" */ false) ? ${truthy} : ${falsy}}`;
    }
    if (mapping.kind === 'inline') {
        const args = node.params.map(p => emitArgument(p, ctx, sink));
        return `\${(${mapping.emit(args)}) ? ${truthy} : ${falsy}}`;
    }
    if (mapping.kind === 'rename' || mapping.kind === 'lossy-rename') {
        if (mapping.kind === 'lossy-rename') {
            warn(sink, ctx, node, 'lossy-rename', `#${name} → ${mapping.to}: ${mapping.reason}`);
        }
        const args = node.params.map(p => emitArgument(p, ctx, sink));
        return `\${helpers.${mapping.to}(${args.join(', ')}) ? ${truthy} : ${falsy}}`;
    }
    if (mapping.kind === 'removed') {
        warn(
            sink,
            ctx,
            node,
            'removed-construct',
            `block helper "#${name}" removed: ${mapping.reason}`
        );
        return `\${${truthy}}`;
    }
    warn(sink, ctx, node, 'unknown-helper', mapping.warn);
    return `\${(/* TODO(migrate): ${mapping.warn} */ false) ? ${truthy} : ${falsy}}`;
};

const emitPartial = (node: AstPartialStatement, ctx: EmitContext, sink: Sink): string => {
    const nameNode = node.name as AstPathExpression;
    const partialName =
        (nameNode as { type: string }).type === 'PathExpression' ? nameNode.original : '<dynamic>';
    const argExpr = node.params[0]
        ? emitArgument(node.params[0], ctx, sink)
        : ctx.scopes[ctx.scopes.length - 1].binding;
    const hash = emitHash(node.hash, ctx, sink);
    warn(
        sink,
        ctx,
        node,
        'partial-no-target',
        `partial "${partialName}" has no compodocx equivalent — inline manually`
    );
    const arg = hash ? `{ ...${argExpr}, ...${hash} }` : argExpr;
    return `\${/* TODO(migrate): partial "${partialName}" — replace with require('./${partialName}.js')(${arg}, helpers) */ ''}`;
};

const emitStatement = (node: AstStatement, ctx: EmitContext, sink: Sink): string => {
    switch ((node as { type: string }).type) {
        case 'ContentStatement':
            return emitContent(node as AstContentStatement);
        case 'MustacheStatement':
            return emitMustache(node as AstMustacheStatement, ctx, sink);
        case 'BlockStatement':
            return emitBlock(node as AstBlockStatement, ctx, sink);
        case 'PartialStatement':
            return emitPartial(node as AstPartialStatement, ctx, sink);
        case 'CommentStatement':
            return '';
        default:
            warn(
                sink,
                ctx,
                node as { loc?: { start?: { line: number; column: number } } },
                'manual-review',
                `unsupported statement "${(node as { type: string }).type}"`
            );
            return '';
    }
};

export interface ConvertOptions {
    readonly file?: string;
}

export interface ConvertOutput {
    readonly body: string;
    readonly warnings: readonly Warning[];
}

/** Convert an HBS source string to the body of a template-literal expression. */
export const convertBody = (source: string, options: ConvertOptions = {}): ConvertOutput => {
    const file = options.file ?? '<inline>';
    const program = parse(source);
    const warnings: Warning[] = [];
    const sink: Sink = w => warnings.push(w);
    const ctx = ROOT_CONTEXT(file);
    const fragments = program.body.map(stmt => emitStatement(stmt, ctx, sink));
    return { body: fragments.join(''), warnings };
};

/** Wrap a converted body in the `module.exports = function(data, helpers)` shell. */
export const wrapModule = (body: string, header: string = ''): string => {
    const headerLine = header ? `${header}\n` : '';
    return (
        `${headerLine}module.exports = function (data, helpers) {\n` +
        `    return \`${body}\`;\n` +
        '};\n'
    );
};
