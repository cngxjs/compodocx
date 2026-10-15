/**
 * Handlebars AST helpers shared by the converter pipeline.
 *
 * - `parse(source)` — wraps `Handlebars.parse`, returning the typed AST.
 * - `normalizePath(node, scopes)` — converts a `PathExpression` into a JS access
 *   string using the active scope stack.
 * - `walk(program, visit)` — depth-first walk that surfaces every statement and
 *   expression node back to the caller.
 *
 * Pure functions throughout: every helper returns a fresh value, no internal
 * state, no mutation of inputs. The emitter (`emit.ts`) drives the walk.
 */

import Handlebars from 'handlebars';

export type AstProgram = hbs.AST.Program;
export type AstStatement = hbs.AST.Statement;
export type AstExpression = hbs.AST.Expression;
export type AstPathExpression = hbs.AST.PathExpression;
export type AstMustacheStatement = hbs.AST.MustacheStatement;
export type AstBlockStatement = hbs.AST.BlockStatement;
export type AstPartialStatement = hbs.AST.PartialStatement;
export type AstContentStatement = hbs.AST.ContentStatement;
export type AstSubExpression = hbs.AST.SubExpression;
export type AstStringLiteral = hbs.AST.StringLiteral;
export type AstNumberLiteral = hbs.AST.NumberLiteral;
export type AstBooleanLiteral = hbs.AST.BooleanLiteral;
export type AstHash = hbs.AST.Hash;

export const parse = (source: string): AstProgram => Handlebars.parse(source);

/**
 * Scope stack entry used while emitting JS access expressions.
 * The bottom of the stack is always `data` (the override's first argument).
 * Each `#each` / `#with` block pushes its loop variable name on top.
 *
 * Block-param aliases (`{{#each items as |row idx|}}`) bind extra HBS names
 * to JS identifiers visible inside the block — `aliases` maps the HBS-side
 * name to the JS expression to use when a path starts with that name.
 */
export interface ScopeFrame {
    /** JS identifier for this scope (e.g. `data`, `item`, `_ctx0`). */
    readonly binding: string;
    /** When true, dotted access through this binding uses optional chaining. */
    readonly optional: boolean;
    /** Optional HBS-name → JS-identifier aliases (for `as |x y|` block params). */
    readonly aliases?: Readonly<Record<string, string>>;
}

export const ROOT_SCOPE: ScopeFrame = { binding: 'data', optional: false };

const RESERVED_WORDS = new Set([
    'break',
    'case',
    'catch',
    'class',
    'const',
    'continue',
    'debugger',
    'default',
    'delete',
    'do',
    'else',
    'enum',
    'export',
    'extends',
    'finally',
    'for',
    'function',
    'if',
    'import',
    'in',
    'instanceof',
    'new',
    'null',
    'return',
    'super',
    'switch',
    'this',
    'throw',
    'true',
    'false',
    'try',
    'typeof',
    'var',
    'void',
    'while',
    'with',
    'yield'
]);

const isPureNumeric = (part: string): boolean => /^\d+$/.test(part);

export const isValidIdentifier = (part: string): boolean =>
    /^[$_a-zA-Z][\w$]*$/.test(part) && !RESERVED_WORDS.has(part);

/**
 * Heuristic: when the original path expression contains `[...]`, the part is
 * either a quoted-string key (`a.[key with space]`) or a bare numeric/identifier
 * inside brackets (`a.[0]`). The numeric path is matched by `isPureNumeric`;
 * this catches the string-key case so the emitter quotes the output.
 */
const isBracketStringPart = (node: AstPathExpression, part: string): boolean =>
    !isPureNumeric(part) &&
    !isValidIdentifier(part) &&
    !!node.original &&
    node.original.includes(`[${part}]`);

type SegmentKind = 'identifier' | 'numeric' | 'bracket-string';

const classifySegment = (node: AstPathExpression, part: string): SegmentKind => {
    if (isPureNumeric(part)) {
        return 'numeric';
    }
    if (isBracketStringPart(node, part)) {
        return 'bracket-string';
    }
    if (isValidIdentifier(part)) {
        return 'identifier';
    }
    return 'bracket-string';
};

const formatSegment = (node: AstPathExpression, part: string, optional: boolean): string => {
    const sep = optional ? '?.' : '.';
    switch (classifySegment(node, part)) {
        case 'identifier':
            return `${sep}${part}`;
        case 'numeric':
            return optional ? `?.[${part}]` : `[${part}]`;
        case 'bracket-string':
            return optional ? `?.[${JSON.stringify(part)}]` : `[${JSON.stringify(part)}]`;
    }
};

const resolveScope = (scopes: readonly ScopeFrame[], depth: number): ScopeFrame | null => {
    const idx = scopes.length - 1 - depth;
    return idx >= 0 ? scopes[idx] : null;
};

const handleDataVar = (node: AstPathExpression): string => {
    const head = node.parts[0];
    if (head === 'index' || head === 'key' || head === 'first' || head === 'last') {
        return `__hbs_${head}`;
    }
    return `/* TODO(migrate): @${node.original} private var */`;
};

interface PathStart {
    readonly head: string;
    readonly remaining: readonly string[];
    readonly headOptional: boolean;
}

/**
 * Block-param aliases let `{{row.name}}` resolve to the loop binding instead
 * of `<scope>.row.name`. When the leading segment matches an alias on the
 * active scope, the alias's JS expression replaces the implicit prefix and
 * the rest of the path proceeds with optional chaining.
 */
const resolvePathStart = (node: AstPathExpression, frame: ScopeFrame): PathStart => {
    const [first, ...rest] = node.parts;
    const alias = frame.aliases?.[first];
    if (alias) {
        return { head: alias, remaining: rest, headOptional: false };
    }
    return { head: frame.binding, remaining: node.parts, headOptional: frame.optional };
};

/**
 * Normalize a Handlebars path into a JS expression.
 *
 * Handles dotted access, bracket numeric, bracket string, `this`/`.`,
 * `../parent`, and block-param aliases (`{{#each items as |row idx|}}`).
 * Returns a TODO comment string for `@key` / `@first` / `@last` (rare) and
 * for out-of-range `../` parent depths (caller turns this into a fidelity warning).
 */
export const normalizePath = (node: AstPathExpression, scopes: readonly ScopeFrame[]): string => {
    if (scopes.length === 0) {
        throw new Error('normalizePath: empty scope stack');
    }
    if (node.data) {
        return handleDataVar(node);
    }
    const frame = resolveScope(scopes, node.depth ?? 0);
    if (!frame) {
        return `/* TODO(migrate): ../${node.original} parent depth ${node.depth} not in scope */`;
    }
    if (node.parts.length === 0) {
        return frame.binding;
    }
    const { head, remaining, headOptional } = resolvePathStart(node, frame);
    return remaining.reduce(
        (acc, part, i) => acc + formatSegment(node, part, i > 0 || headOptional),
        head
    );
};

type AstNode = AstStatement | AstExpression | AstProgram;
type VisitResult = false | undefined;
type Visitor = (node: AstNode) => VisitResult;

const childrenOf = (node: AstNode): readonly AstNode[] => {
    switch ((node as { type: string }).type) {
        case 'Program':
            return (node as AstProgram).body;
        case 'BlockStatement': {
            const b = node as AstBlockStatement;
            return [
                ...b.params,
                ...(b.program ? [b.program] : []),
                ...(b.inverse ? [b.inverse] : [])
            ];
        }
        case 'MustacheStatement':
            return (node as AstMustacheStatement).params;
        case 'SubExpression':
            return (node as AstSubExpression).params;
        case 'PartialStatement':
            return (node as AstPartialStatement).params;
        default:
            return [];
    }
};

/**
 * Pre-order walker. Calls `visit(node)`. If `visit` returns `false`, child
 * nodes are skipped (used by the emitter to take ownership of a subtree).
 */
export const walk = (program: AstProgram, visit: Visitor): void => {
    const recurse = (node: AstNode): void => {
        if (visit(node) === false) {
            return;
        }
        for (const child of childrenOf(node)) {
            recurse(child);
        }
    };
    recurse(program);
};
