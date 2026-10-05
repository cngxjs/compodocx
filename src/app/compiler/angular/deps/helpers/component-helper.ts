import { SyntaxKind, ts } from 'ts-morph';
import { detectIndent } from '../../../../../utils';
import type { ClassHelper } from './class-helper';
import { type IParseDeepIdentifierResult, type ProviderEntry, SymbolHelper } from './symbol-helper';

export type { ProviderEntry };

/**
 * Structured representation of a single entry from a `@Component({ host: {...} })`
 * literal, used by the Phase 2b metadata renderer in `MetadataRow.tsx`. The raw
 * `host: Map<string, string>` stays on the dep object for the existing
 * component-dep.factory host-binding / host-listener auto-synthesis pass; this
 * parallel shape is consumed by the render layer only.
 */
export type HostEntry = {
    /** Raw source form: `class`, `role`, `[attr.aria-label]`, `(click)`, etc. */
    readonly key: string;
    /** Classification by key pattern. `raw` is reserved for unexpected shapes. */
    readonly kind:
        | 'static'
        | 'attr-binding'
        | 'property-binding'
        | 'class-binding'
        | 'style-binding'
        | 'event'
        | 'raw';
    /** The initializer source text. */
    readonly value: string;
    /** For bindings: the part inside `[...]` or `(...)`. */
    readonly target?: string;
};

/**
 * Structured representation of a single entry from a
 * `@Component({ hostDirectives: [...] })` array. The render layer
 * (`MetadataHostDirectivesRow` in `MetadataRow.tsx`) reads `name`, `inputs`
 * and `outputs`. `unresolved` lets the renderer optionally mark entries
 * whose identifier could not be traced back to an object literal or
 * directive class; `refName` preserves the original identifier text of a
 * dereferenced entry for attribution if we ever want to surface it.
 */
export type HostDirectiveEntry = {
    readonly name: string;
    readonly inputs?: string[];
    readonly outputs?: string[];
    /** True if `name` is an unresolved identifier — no matching directive class or local const. */
    readonly unresolved?: boolean;
    /** Original identifier text when the entry was dereferenced from a local const. */
    readonly refName?: string;
};

export class ComponentHelper {
    constructor(
        private classHelper: ClassHelper,
        private symbolHelper: SymbolHelper = new SymbolHelper()
    ) {}

    public getComponentChangeDetection(
        props: ReadonlyArray<ts.ObjectLiteralElementLike>,
        srcFile: ts.SourceFile
    ): string {
        return this.symbolHelper.getSymbolDeps(props, 'changeDetection', srcFile).pop();
    }

    public getComponentEncapsulation(
        props: ReadonlyArray<ts.ObjectLiteralElementLike>,
        srcFile: ts.SourceFile
    ): Array<string> {
        return this.symbolHelper.getSymbolDeps(props, 'encapsulation', srcFile);
    }

    public getComponentPure(
        props: ReadonlyArray<ts.ObjectLiteralElementLike>,
        srcFile: ts.SourceFile
    ): string {
        return this.symbolHelper.getSymbolDeps(props, 'pure', srcFile).pop();
    }

    public getComponentName(
        props: ReadonlyArray<ts.ObjectLiteralElementLike>,
        srcFile: ts.SourceFile
    ): string {
        return this.symbolHelper.getSymbolDeps(props, 'name', srcFile).pop();
    }

    public getComponentExportAs(
        props: ReadonlyArray<ts.ObjectLiteralElementLike>,
        srcFile: ts.SourceFile
    ): string {
        return this.symbolHelper.getSymbolDeps(props, 'exportAs', srcFile).pop();
    }

    /**
     * `providedIn` of an `@Injectable` decorator: the bare value for string
     * literals (`root`, `platform`, `any`), the identifier text otherwise.
     */
    public getInjectableProvidedIn(
        props: ReadonlyArray<ts.ObjectLiteralElementLike>,
        srcFile: ts.SourceFile
    ): string | undefined {
        const value = this.symbolHelper.getSymbolDeps(props, 'providedIn', srcFile).pop();
        return typeof value === 'string' && value.length > 0 ? value : undefined;
    }

    public getComponentHostDirectives(
        props: ReadonlyArray<ts.ObjectLiteralElementLike>,
        srcFile?: ts.SourceFile
    ): HostDirectiveEntry[] {
        const hostDirectiveSymbolParsed = this.symbolHelper.getSymbolDepsRaw(
            props,
            'hostDirectives'
        );
        let hostDirectiveSymbol = null;

        if (hostDirectiveSymbolParsed.length > 0) {
            hostDirectiveSymbol = hostDirectiveSymbolParsed.pop();
        }

        const result: HostDirectiveEntry[] = [];

        if (
            hostDirectiveSymbol?.initializer?.elements &&
            hostDirectiveSymbol.initializer.elements.length > 0
        ) {
            for (const element of hostDirectiveSymbol.initializer.elements) {
                result.push(this.parseHostDirectiveEntry(element, srcFile));
            }
        }

        return result;
    }

    /**
     * Classify a single element of the `hostDirectives: [...]` array into a
     * `HostDirectiveEntry`. Handles three shapes:
     *
     * 1. Inline `{ directive, inputs, outputs }` object literal — parsed directly.
     * 2. `Identifier` that resolves to a local `const FOO = { directive: ... }`
     *    variable declaration in the same source file — dereferenced and the
     *    original identifier text is preserved as `refName`.
     * 3. `Identifier` that does not resolve locally (bare directive class
     *    reference OR const imported from another file) — emits `{ name }`.
     *    For bare class references this is already the correct rendering;
     *    for imported const refs this is a deliberate MVP fallback flagged
     *    as `unresolved: true` so the renderer can treat it differently if
     *    we ever want to.
     *
     * TODO(Phase 1.5): imported const dereferencing. Currently consts defined
     * in a *different* source file cannot be followed, so the result is the
     * same as a bare class reference. A follow-up should handle this by either
     * walking imports without relying on the global `ast` Project singleton
     * (to keep unit tests deterministic), or by wiring srcFile into a scoped
     * ts-morph Project that can resolve the module specifier. See
     * `.internal/compiler-metadata-extraction-fix-plan.md` Phase 1 risk table.
     */
    private parseHostDirectiveEntry(element: any, srcFile?: ts.SourceFile): HostDirectiveEntry {
        if (
            element.kind === SyntaxKind.ObjectLiteralExpression &&
            element.properties &&
            element.properties.length > 0
        ) {
            return this.parseHostDirectiveObjectLiteral(element.properties);
        }

        if (element.kind === SyntaxKind.Identifier) {
            const identifierName = String(element.escapedText ?? element.text ?? '');

            if (srcFile) {
                const localConstProperties = this.resolveLocalObjectLiteralProperties(
                    identifierName,
                    srcFile
                );
                if (localConstProperties) {
                    const parsed = this.parseHostDirectiveObjectLiteral(localConstProperties);
                    return { ...parsed, refName: identifierName };
                }
            }

            // Could not dereference — either a bare directive class reference
            // (correct rendering) or an imported const (Phase 1.5 territory).
            // Flag unresolved so the renderer can optionally distinguish.
            return { name: identifierName, unresolved: true };
        }

        return { name: '', unresolved: true };
    }

    /**
     * Extract `{ name, inputs, outputs }` from an array of `PropertyAssignment`
     * nodes representing an inline `{ directive, inputs, outputs }` object
     * literal. Used for both the inline host-directive case and the
     * dereferenced local-const case (which produces the same property array).
     */
    private parseHostDirectiveObjectLiteral(properties: ReadonlyArray<any>): HostDirectiveEntry {
        let name = '';
        const inputs: string[] = [];
        const outputs: string[] = [];

        for (const property of properties) {
            if (!property.name) {
                continue;
            }
            const keyName = property.name.escapedText ?? property.name.text;
            if (keyName === 'directive') {
                name = String(
                    property.initializer?.escapedText ?? property.initializer?.text ?? ''
                );
            } else if (keyName === 'inputs') {
                if (property.initializer?.elements && property.initializer.elements.length > 0) {
                    for (const el of property.initializer.elements) {
                        if (typeof el.text === 'string') {
                            inputs.push(el.text);
                        }
                    }
                }
            } else if (keyName === 'outputs') {
                if (property.initializer?.elements && property.initializer.elements.length > 0) {
                    for (const el of property.initializer.elements) {
                        if (typeof el.text === 'string') {
                            outputs.push(el.text);
                        }
                    }
                }
            }
        }

        return { name, inputs, outputs };
    }

    /**
     * Walk the top-level statements of a source file looking for a
     * `const NAME = { ... }` (or `let` / `var`) whose initializer is an
     * ObjectLiteralExpression, and return its property list. Returns
     * `undefined` when no matching local variable exists. This deliberately
     * does NOT consult the global ts-morph `ast` Project from ImportsUtil —
     * that dependency would break the in-memory unit test infrastructure and
     * only adds cross-file resolution which is Phase 1.5 scope.
     */
    private resolveLocalObjectLiteralProperties(
        name: string,
        srcFile: ts.SourceFile
    ): ReadonlyArray<ts.ObjectLiteralElementLike> | undefined {
        for (const statement of srcFile.statements) {
            if (!ts.isVariableStatement(statement)) {
                continue;
            }
            for (const decl of statement.declarationList.declarations) {
                if (!ts.isIdentifier(decl.name)) {
                    continue;
                }
                if (decl.name.text !== name) {
                    continue;
                }
                const init = decl.initializer;
                if (init && ts.isObjectLiteralExpression(init)) {
                    return init.properties;
                }
            }
        }
        return undefined;
    }

    public getComponentHost(
        props: ReadonlyArray<ts.ObjectLiteralElementLike>
    ): Map<string, string> {
        return this.getSymbolDepsObject(props, 'host');
    }

    /**
     * Parallel structured extractor for the `host: { ... }` literal. Reads the
     * same AST node as `getComponentHost` but returns a typed `HostEntry[]`
     * instead of a flat Map, so the Phase 2b render layer can emit a
     * code-object-literal metadata row with per-kind styling without having to
     * re-classify keys at render time.
     *
     * Returns an empty array when no `host` literal is present.
     */
    public getComponentHostStructured(
        props: ReadonlyArray<ts.ObjectLiteralElementLike>
    ): HostEntry[] {
        let hostNode: ts.ObjectLiteralElementLike | undefined;
        for (const prop of props) {
            if (prop.name && (prop.name as any).text === 'host') {
                hostNode = prop;
                break;
            }
        }
        if (!hostNode) {
            return [];
        }
        const initializer = (hostNode as any).initializer;
        if (!initializer || !ts.isObjectLiteralExpression(initializer)) {
            return [];
        }
        const entries: HostEntry[] = [];
        for (const prop of initializer.properties) {
            const key = this.readNodeText((prop as any).name);
            if (key === undefined) {
                continue;
            }
            const value = this.readNodeText((prop as any).initializer) ?? '';
            entries.push(this.classifyHostEntry(key, value));
        }
        return entries;
    }

    /**
     * Classify a single host literal entry by key pattern.
     *
     * - `(foo)`          → event listener, target = 'foo'
     * - `[attr.bar]`     → attr binding, target = 'bar'
     * - `[class.bar]`    → class binding, target = 'bar'
     * - `[style.bar]`    → style binding, target = 'bar'
     * - `[bar]`          → property binding, target = 'bar'
     * - anything else    → static attribute (no target)
     */
    private classifyHostEntry(key: string, value: string): HostEntry {
        if (key.startsWith('(') && key.endsWith(')')) {
            return { key, kind: 'event', value, target: key.slice(1, -1) };
        }
        if (key.startsWith('[') && key.endsWith(']')) {
            const inner = key.slice(1, -1);
            if (inner.startsWith('attr.')) {
                return { key, kind: 'attr-binding', value, target: inner.slice(5) };
            }
            if (inner.startsWith('class.')) {
                return { key, kind: 'class-binding', value, target: inner.slice(6) };
            }
            if (inner.startsWith('style.')) {
                return { key, kind: 'style-binding', value, target: inner.slice(6) };
            }
            return { key, kind: 'property-binding', value, target: inner };
        }
        return { key, kind: 'static', value };
    }

    public getComponentTag(
        props: ReadonlyArray<ts.ObjectLiteralElementLike>,
        srcFile: ts.SourceFile
    ): string {
        return this.symbolHelper.getSymbolDeps(props, 'tag', srcFile).pop();
    }

    public getComponentInputsMetadata(
        props: ReadonlyArray<ts.ObjectLiteralElementLike>,
        srcFile: ts.SourceFile
    ): Array<string> {
        return this.symbolHelper.getSymbolDeps(props, 'inputs', srcFile);
    }

    public getInputOutputSignals(props) {
        const inputSignals = [];
        const outputSignals = [];
        const properties = [];

        props.forEach(prop => {
            const inputSignal = this.getInputSignal(prop);
            if (inputSignal) {
                inputSignals.push(inputSignal);
            }

            const outputSignal = this.getOutputSignal(prop);
            if (outputSignal) {
                outputSignals.push(outputSignal);
            }

            if (!inputSignal && !outputSignal) {
                properties.push(prop);
            }
        });

        return { inputSignals, outputSignals, properties };
    }

    public getInputSignal(prop) {
        const config =
            this.getSignalConfig('input', prop.defaultValue) ??
            this.getSignalConfig('model', prop.defaultValue);

        if (config) {
            return {
                ...prop,
                ...config
            };
        }

        return undefined;
    }

    public getOutputSignal(prop) {
        const config =
            this.getSignalConfig('output', prop.defaultValue) ??
            this.getSignalConfig('model', prop.defaultValue);

        if (config) {
            return {
                ...prop,
                ...config
            };
        }

        return undefined;
    }

    private getSignalConfig(type: 'input' | 'output' | 'model', defaultValue: string) {
        // Matches a quote mark
        const quotePattern = `['"\`]`;

        // Matches a value for the input
        const valuePattern = (capture = true) =>
            `(${capture ? '' : '?:'}[^()]*(?:\\([^()]*\\)[^()]*)*)`;

        // Matches an optional space
        const spacePattern = `(?: )*`;

        // Matches the input's type
        const typesPattern = `(?:<((?:${valuePattern(false)}(?:${spacePattern}\\|${spacePattern})?)+)>)?`;

        // Matches the alias provided in the options
        const aliasRegExp = new RegExp(`alias:${spacePattern}${quotePattern}(\\w+)${quotePattern}`);

        // Matches a signal of the provided type
        const signalRegExp = new RegExp(
            `${type}(.required)?${typesPattern}\\(${valuePattern()}?(?:,${spacePattern}({.+}))?\\)`
        );

        const matches = signalRegExp.exec(defaultValue?.replace(/\n/g, ''));

        if (matches) {
            const [_match, required, type, defaultValue, options] = matches;

            const name = options?.match(aliasRegExp)?.[1];

            const result = {
                required: !!required,
                type: this.parseSignalType(type),
                defaultValue
            };

            if (name) {
                return {
                    ...result,
                    name
                };
            }

            return result;
        }
    }

    public parseSignalType(type: string) {
        if (!type) {
            return type;
        }

        // adjust union string expression like: 'foo' | 'bar' | 'test'
        // which should be outputed as: "foo" | "bar" | "test"

        const unionTypeRegex = /^'([\w-]+)'\s?\|\s?('([\w-]+)'|.*)$/;
        let typeRest = type;
        let newType = '';
        let typeMatch: RegExpMatchArray;
        while ((typeMatch = typeRest.match(unionTypeRegex))) {
            const [, first, rest, second] = typeMatch;
            if (second) {
                newType += `"${first}" | "${second}"`;
                type = newType;
                break;
            }
            newType += `"${first}" | `;
            typeRest = rest;
        }

        return type;
    }

    public getComponentStandalone(
        props: ReadonlyArray<ts.ObjectLiteralElementLike>,
        srcFile: ts.SourceFile
    ): boolean {
        // Angular 19+: standalone unless the decorator says `standalone: false`
        const parsedData = this.symbolHelper.getSymbolDeps(props, 'standalone', srcFile);
        if (parsedData.length !== 1) {
            return true;
        }

        return JSON.parse(parsedData[0]) !== false;
    }

    public getComponentTemplate(
        props: ReadonlyArray<ts.ObjectLiteralElementLike>,
        srcFile: ts.SourceFile
    ): string {
        let t = this.symbolHelper.getSymbolDeps(props, 'template', srcFile, true).pop();
        if (t) {
            t = detectIndent(t, 0);
            t = t.replace(/\n/, '');
            t = t.replace(/ +$/gm, '');
        }
        return t;
    }

    public getComponentStyleUrls(
        props: ReadonlyArray<ts.ObjectLiteralElementLike>,
        srcFile: ts.SourceFile
    ): string[] {
        const plural = this.symbolHelper.getSymbolDeps(props, 'styleUrls', srcFile);
        const singular = this.symbolHelper.getSymbolDeps(props, 'styleUrl', srcFile);
        if (singular.length === 0) {
            return plural;
        }
        // Angular 21 introduced the singular `styleUrl: './foo.css'` form. Stencil
        // components have always used the same field. Fold it into the plural so
        // every downstream consumer (theming parser, handleStyleurls, nav-tabs,
        // hero metadata) sees one canonical list regardless of authoring style.
        const merged = [...plural];
        for (const url of singular) {
            if (url && !merged.includes(url)) {
                merged.push(url);
            }
        }
        return merged;
    }

    public getComponentStyleUrl(
        props: ReadonlyArray<ts.ObjectLiteralElementLike>,
        srcFile: ts.SourceFile
    ): string {
        return this.symbolHelper.getSymbolDeps(props, 'styleUrl', srcFile).pop();
    }

    public getComponentShadow(
        props: ReadonlyArray<ts.ObjectLiteralElementLike>,
        srcFile: ts.SourceFile
    ): string {
        return this.symbolHelper.getSymbolDeps(props, 'shadow', srcFile).pop();
    }

    public getComponentScoped(
        props: ReadonlyArray<ts.ObjectLiteralElementLike>,
        srcFile: ts.SourceFile
    ): string {
        return this.symbolHelper.getSymbolDeps(props, 'scoped', srcFile).pop();
    }

    public getComponentAssetsDir(
        props: ReadonlyArray<ts.ObjectLiteralElementLike>,
        srcFile: ts.SourceFile
    ): string {
        return this.symbolHelper.getSymbolDeps(props, 'assetsDir', srcFile).pop();
    }

    public getComponentAssetsDirs(
        props: ReadonlyArray<ts.ObjectLiteralElementLike>,
        srcFile: ts.SourceFile
    ): string[] {
        return this.sanitizeUrls(this.symbolHelper.getSymbolDeps(props, 'assetsDir', srcFile));
    }

    public getComponentStyles(
        props: ReadonlyArray<ts.ObjectLiteralElementLike>,
        srcFile: ts.SourceFile
    ): string[] {
        return this.symbolHelper.getSymbolDeps(props, 'styles', srcFile);
    }

    public getComponentModuleId(
        props: ReadonlyArray<ts.ObjectLiteralElementLike>,
        srcFile: ts.SourceFile
    ): string {
        return this.symbolHelper.getSymbolDeps(props, 'moduleId', srcFile).pop();
    }

    public getComponentOutputs(
        props: ReadonlyArray<ts.ObjectLiteralElementLike>,
        srcFile: ts.SourceFile
    ): string[] {
        return this.symbolHelper.getSymbolDeps(props, 'outputs', srcFile);
    }

    public getComponentProviders(
        props: ReadonlyArray<ts.ObjectLiteralElementLike>,
        srcFile: ts.SourceFile
    ): ProviderEntry[] {
        return this.symbolHelper.getProviderEntries(props, 'providers', srcFile);
    }

    public getComponentImports(
        props: ReadonlyArray<ts.ObjectLiteralElementLike>,
        srcFile: ts.SourceFile
    ): Array<IParseDeepIdentifierResult> {
        return this.symbolHelper
            .getSymbolDeps(props, 'imports', srcFile)
            .map(name => this.symbolHelper.parseDeepIndentifier(name));
    }

    public getComponentViewProviders(
        props: ReadonlyArray<ts.ObjectLiteralElementLike>,
        srcFile: ts.SourceFile
    ): ProviderEntry[] {
        return this.symbolHelper.getProviderEntries(props, 'viewProviders', srcFile);
    }

    public getComponentTemplateUrl(
        props: ReadonlyArray<ts.ObjectLiteralElementLike>,
        srcFile: ts.SourceFile
    ): Array<string> {
        return this.symbolHelper.getSymbolDeps(props, 'templateUrl', srcFile);
    }

    public getComponentExampleUrls(text: string): Array<string> | undefined {
        const exampleUrlsMatches = text.match(/<example-url>(.*?)<\/example-url>/g);
        let exampleUrls;
        if (exampleUrlsMatches?.length) {
            exampleUrls = exampleUrlsMatches.map(val => val.replace(/<\/?example-url>/g, ''));
        }
        return exampleUrls;
    }

    public getComponentPreserveWhitespaces(
        props: ReadonlyArray<ts.ObjectLiteralElementLike>,
        srcFile: ts.SourceFile
    ): string {
        return this.symbolHelper.getSymbolDeps(props, 'preserveWhitespaces', srcFile).pop();
    }

    public getComponentSelector(
        props: ReadonlyArray<ts.ObjectLiteralElementLike>,
        srcFile: ts.SourceFile
    ): string {
        return this.symbolHelper.getSymbolDeps(props, 'selector', srcFile).pop();
    }

    private parseProperties(node: ts.ObjectLiteralElementLike): Map<string, string> {
        const obj = new Map<string, string>();
        const element = node as any;
        const properties = element.initializer?.properties || [];
        properties.forEach((prop: any) => {
            const key = this.readNodeText(prop.name);
            if (key === undefined) {
                return;
            }
            obj.set(key, this.readNodeText(prop.initializer));
        });
        return obj;
    }

    /**
     * Reads the source content of an AST node for the purpose of host /
     * host-directive metadata extraction.
     *
     * Literal kinds (`StringLiteral`, `NoSubstitutionTemplateLiteral`,
     * `NumericLiteral`) and `Identifier` expose a native `.text` field that
     * already returns the inner content with surrounding quotes / backticks
     * stripped. Everything else — `CallExpression`, `PropertyAccessExpression`,
     * `TemplateExpression`, `ObjectLiteralExpression`, computed property
     * names, etc. — falls back to `getText()` so complex initializers keep
     * their full source instead of collapsing to `undefined` the way the
     * previous `initializer?.text` access did. Phase 2a bug fix — see
     * .internal/compiler-metadata-extraction-fix-plan.md.
     */
    private readNodeText(node: ts.Node | undefined): string | undefined {
        if (!node) {
            return undefined;
        }
        if (
            ts.isStringLiteral(node) ||
            ts.isNoSubstitutionTemplateLiteral(node) ||
            ts.isNumericLiteral(node) ||
            ts.isIdentifier(node)
        ) {
            return node.text;
        }
        return node.getText();
    }

    public getSymbolDepsObject(
        props: ReadonlyArray<ts.ObjectLiteralElementLike>,
        type: string,
        _multiLine?: boolean
    ): Map<string, string> {
        let i = 0,
            len = props.length,
            filteredProps = [];

        for (i; i < len; i++) {
            if (props[i].name && (props[i].name as any).text === type) {
                filteredProps.push(props[i]);
            }
        }
        return filteredProps.map(x => this.parseProperties(x)).pop();
    }

    public getComponentIO(
        filename: string,
        sourceFile: ts.SourceFile,
        node: ts.Node,
        fileBody,
        astFile: ts.SourceFile
    ): any {
        /**
         * Copyright https://github.com/ng-bootstrap/ng-bootstrap
         */
        const reducedSource = fileBody ? fileBody.statements : sourceFile.statements;
        const res = reducedSource.reduce((directive, statement) => {
            if (ts.isClassDeclaration(statement)) {
                if (statement.pos === node.pos && statement.end === node.end) {
                    return directive.concat(
                        this.classHelper.visitClassDeclaration(
                            filename,
                            statement,
                            sourceFile,
                            astFile
                        )
                    );
                }
            }

            return directive;
        }, []);

        return res[0] || {};
    }

    private sanitizeUrls(urls: Array<string>): Array<string> {
        return urls.map(url => url.replace('./', ''));
    }
}

export class ComponentCache {
    private cache: Map<string, any> = new Map();

    public get(key: string): any {
        return this.cache.get(key);
    }

    public set(key: string, value: any): void {
        this.cache.set(key, value);
    }
}
