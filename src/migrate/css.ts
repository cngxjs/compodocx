/**
 * `compodocx migrate css <file-or-dir> [--aggressive]` - class-name rewriter.
 *
 * Two modes:
 *  - Conservative (default): rewrite class names in `.css` / `.scss` / `.sass`
 *    files only. For `.html` / `.ts` / `.tsx` matches, emit an audit-only
 *    report so the user can verify each match by hand.
 *  - Aggressive (`--aggressive`): also rewrite in `.html` / `.ts` / `.tsx` /
 *    `.js`. Documented as risky-with-string-literals; the recommended workflow
 *    is `--dry-run --aggressive` first.
 *
 * `data-compodoc="<block-name>"` attributes survive both modes unchanged
 * (never-touch rule in CSS_RENAME_RULES).
 */

import * as path from 'node:path';
import { AUDIT_ONLY_PATTERNS, CSS_RENAME_RULES, type RenameRule } from './css-rename-map';
import { scoreOf } from './report';
import type { AuditMatch, CssRewriteResult, FidelityScore, Warning } from './types';

const STYLESHEET_EXTS = new Set(['.css', '.scss', '.sass']);
const AGGRESSIVE_EXTS = new Set(['.html', '.ts', '.tsx', '.js', '.jsx']);

export type CssMode = 'conservative' | 'aggressive';

export const isStylesheet = (file: string): boolean => STYLESHEET_EXTS.has(path.extname(file));
export const isMarkupOrCode = (file: string): boolean => AGGRESSIVE_EXTS.has(path.extname(file));

/** Returns true when this rule applies to the given class token. */
const ruleMatches = (rule: RenameRule, token: string): boolean => {
    if (rule.kind === 'never-touch') {
        return rule.match.test(token);
    }
    if (rule.kind === 'exact') {
        return rule.from === token;
    }
    return token.startsWith(rule.from);
};

/** Applies a rule to a token. Returns null when the rule doesn't actually rewrite. */
const applyRule = (rule: RenameRule, token: string): string | null => {
    if (rule.kind === 'never-touch') {
        return null;
    }
    if (rule.kind === 'exact') {
        return rule.from === token ? rule.to : null;
    }
    return token.startsWith(rule.from) ? rule.to + token.slice(rule.from.length) : null;
};

interface TokenRewrite {
    readonly token: string;
    readonly to: string;
}

/**
 * Resolve a rewrite for a single class token. Order: never-touch first,
 * then exact, then prefix. A never-touch hit short-circuits to null.
 */
const resolveTokenRewrite = (token: string): TokenRewrite | null => {
    for (const rule of CSS_RENAME_RULES) {
        if (rule.kind === 'never-touch' && ruleMatches(rule, token)) {
            return null;
        }
    }
    for (const rule of CSS_RENAME_RULES) {
        if (rule.kind === 'never-touch') {
            continue;
        }
        const replacement = applyRule(rule, token);
        if (replacement) {
            return { token, to: replacement };
        }
    }
    return null;
};

const CSS_CLASS_REGEX = /\.([a-zA-Z][\w-]*)\b/g;
const HTML_CLASS_ATTR_REGEX = /\bclass\s*=\s*["']([^"']*)["']/g;
const HTML_CLASSNAME_ATTR_REGEX = /\b(?:className|class)\s*=\s*\{?\s*["']([^"']*)["']/g;

interface RewriteOutcome {
    readonly output: string;
    readonly substitutions: number;
    readonly auditMatches: readonly AuditMatch[];
    readonly warnings: readonly Warning[];
}

const isAuditOnlyToken = (token: string): boolean =>
    AUDIT_ONLY_PATTERNS.some(p => (p.endsWith('-') ? token.startsWith(p) : token === p));

const rewriteCssSource = (file: string, source: string): RewriteOutcome => {
    let substitutions = 0;
    const warnings: Warning[] = [];
    const output = source.replace(CSS_CLASS_REGEX, (match, token: string) => {
        // Skip data-compodoc tokens (never-touch is checked inside resolveTokenRewrite).
        if (isAuditOnlyToken(token)) {
            warnings.push({
                file,
                line: 0,
                kind: 'manual-review',
                message: `class .${token} is context-dependent — review manually before renaming`
            });
            return match;
        }
        const rewrite = resolveTokenRewrite(token);
        if (!rewrite) {
            return match;
        }
        substitutions++;
        return `.${rewrite.to}`;
    });
    return { output, substitutions, auditMatches: [], warnings };
};

const rewriteClassList = (
    file: string,
    classList: string,
    line: number
): { rewritten: string; substitutions: number; auditMatches: readonly AuditMatch[] } => {
    const tokens = classList.split(/\s+/);
    const audits: AuditMatch[] = [];
    let substitutions = 0;
    const rewritten = tokens
        .map(token => {
            if (!token) {
                return token;
            }
            if (isAuditOnlyToken(token)) {
                audits.push({
                    file,
                    line,
                    column: 0,
                    from: token,
                    to: token,
                    snippet: classList
                });
                return token;
            }
            const rewrite = resolveTokenRewrite(token);
            if (!rewrite) {
                return token;
            }
            substitutions++;
            return rewrite.to;
        })
        .join(' ');
    return { rewritten, substitutions, auditMatches: audits };
};

const rewriteMarkupOrCode = (file: string, source: string, audit: boolean): RewriteOutcome => {
    let substitutions = 0;
    const auditMatches: AuditMatch[] = [];
    const warnings: Warning[] = [];

    const lineOf = (offset: number): { line: number; lineText: string } => {
        const before = source.slice(0, offset);
        const lineStart = before.lastIndexOf('\n') + 1;
        const lineEnd = source.indexOf('\n', offset);
        const lineText = source.slice(lineStart, lineEnd === -1 ? source.length : lineEnd);
        return { line: before.split('\n').length, lineText };
    };

    const rewriteAttribute = (match: string, classList: string, offset: number): string => {
        const { line, lineText } = lineOf(offset);
        // Never-touch: any line containing `data-compodoc` is preserved as-is.
        // The `data-compodoc="<block-name>"` attribute is the stable
        // downstream-scraping selector - corrupting the surrounding class is a
        // user-visible regression even if the attribute name itself survives.
        if (/data-compodoc/.test(lineText)) {
            return match;
        }
        const result = rewriteClassList(file, classList, line);
        if (audit) {
            auditMatches.push(...result.auditMatches);
            // In audit mode, surface every match (including ones we COULD
            // rewrite) so the user can review.
            const rewriteCount = result.substitutions;
            if (rewriteCount > 0) {
                warnings.push({
                    file,
                    line,
                    kind: 'css-audit-only',
                    message: `${rewriteCount} class token(s) match a rename rule — re-run with --aggressive to apply`
                });
            }
            return match;
        }
        substitutions += result.substitutions;
        if (result.auditMatches.length > 0) {
            auditMatches.push(...result.auditMatches);
            warnings.push({
                file,
                line,
                kind: 'manual-review',
                message: `class list contains audit-only tokens — review manually`
            });
        }
        return match.replace(classList, result.rewritten);
    };

    let output = source.replace(HTML_CLASS_ATTR_REGEX, (match, classList, offset) =>
        rewriteAttribute(match, classList, offset)
    );
    output = output.replace(HTML_CLASSNAME_ATTR_REGEX, (match, classList, offset) =>
        rewriteAttribute(match, classList, offset)
    );

    return { output, substitutions, auditMatches, warnings };
};

const buildResult = (
    file: string,
    outcome: RewriteOutcome,
    aggressiveWarning: Warning | null
): CssRewriteResult => {
    const warnings: Warning[] = [...outcome.warnings];
    if (aggressiveWarning) {
        warnings.push(aggressiveWarning);
    }
    const score: FidelityScore = scoreOf(warnings);
    return {
        file,
        output: outcome.output,
        rewriteCount: outcome.substitutions,
        auditMatches: [...outcome.auditMatches],
        score,
        warnings
    };
};

export const rewriteCss = (file: string, source: string, mode: CssMode): CssRewriteResult => {
    if (isStylesheet(file)) {
        return buildResult(file, rewriteCssSource(file, source), null);
    }
    if (isMarkupOrCode(file)) {
        const audit = mode === 'conservative';
        const aggressiveWarning: Warning | null =
            mode === 'aggressive'
                ? {
                      file,
                      line: 0,
                      kind: 'aggressive-rewrite',
                      message: `aggressive rewrite of ${path.extname(file)} — verify class strings against generated HTML`
                  }
                : null;
        return buildResult(file, rewriteMarkupOrCode(file, source, audit), aggressiveWarning);
    }
    return {
        file,
        output: source,
        rewriteCount: 0,
        auditMatches: [],
        score: 'green',
        warnings: []
    };
};
