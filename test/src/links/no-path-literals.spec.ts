import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { FEATURE_FOLDER, KIND_FOLDER } from '../../../src/app/links/layout';

/**
 * The page layout is the only owner of output folders. This spec scans the
 * sources for literals that spell out a folder of the generated docs, so a
 * new link cannot bypass the layout.
 */

const ROOT = path.resolve(__dirname, '../../..');
const SRC = path.join(ROOT, 'src');
const SKIP = ['src/app/links/layout.ts', 'src/locales/', 'src/resources/'];

/**
 * Literals that name a folder but are not output links: file, literal text
 * and why it is not a link. Empty: every link goes through the layout.
 */
const ALLOWLIST: ReadonlyArray<{ file: string; text: string; reason: string }> = [];

const FOLDERS = [...Object.values(KIND_FOLDER), FEATURE_FOLDER];
const FOLDER_RE = new RegExp(`(^|[^A-Za-z0-9_-])(${FOLDERS.join('|')})(/|\\.html)`);
const KIND_KEYS: ReadonlySet<string> = new Set(Object.keys(KIND_FOLDER));
const FOLDER_VALUES: ReadonlySet<string> = new Set(FOLDERS);

const sourceFiles = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            return sourceFiles(full);
        }
        return /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [full] : [];
    });

interface Hit {
    readonly file: string;
    readonly line: number;
    readonly text: string;
    readonly rule: string;
}

const literalText = (node: ts.Node): string | undefined => {
    if (ts.isStringLiteralLike(node)) {
        return node.text;
    }
    if (ts.isTemplateExpression(node)) {
        return [node.head.text, ...node.templateSpans.map(s => `\${}${s.literal.text}`)].join('');
    }
    return undefined;
};

const scan = (file: string): Hit[] => {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    const source = ts.createSourceFile(
        file,
        fs.readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    const hits: Hit[] = [];
    const hit = (node: ts.Node, text: string, rule: string) =>
        hits.push({
            file: rel,
            line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
            text,
            rule
        });
    const visit = (node: ts.Node): void => {
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
            return;
        }
        const text = literalText(node);
        if (text !== undefined) {
            if (FOLDER_RE.test(text)) {
                hit(node, text, 'folder literal');
            } else if (/\$\{\}s\//.test(text)) {
                hit(node, text, 'derived folder');
            }
        }
        if (ts.isObjectLiteralExpression(node)) {
            const mapped = node.properties.filter(
                p =>
                    ts.isPropertyAssignment(p) &&
                    KIND_KEYS.has(p.name.getText(source).replace(/['"]/g, '')) &&
                    ts.isStringLiteralLike(p.initializer) &&
                    FOLDER_VALUES.has(p.initializer.text)
            );
            if (mapped.length >= 2) {
                hit(node, node.getText(source).slice(0, 60), 'kind-to-folder table');
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    return hits;
};

describe('output path literals', () => {
    it('appear only in the page layout', () => {
        const hits = sourceFiles(SRC)
            .filter(file => !SKIP.some(skip => file.includes(skip.replace(/\//g, path.sep))))
            .flatMap(scan)
            .filter(h => !ALLOWLIST.some(a => a.file === h.file && h.text.includes(a.text)));
        expect(hits.map(h => `${h.file}:${h.line} [${h.rule}] ${h.text}`)).toEqual([]);
    });
});
