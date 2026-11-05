import { SyntaxKind, ts } from 'ts-morph';
import { detectIndent } from '../../../../../utils';
import { resolveExampleUrl } from '../../../../../utils/example-urls';
import Configuration from '../../../../configuration';
import type { ClassHelper } from './class-helper';
import { type IParseDeepIdentifierResult, type ProviderEntry, SymbolHelper } from './symbol-helper';

export type { ProviderEntry };

/** Text of the JSDoc blocks of a declaration, not of the rest of its file. */
export const jsDocTextOf = (node: ts.Node | undefined): string =>
    node
        ? ts
              .getJSDocCommentsAndTags(node)
              .filter(ts.isJSDoc)
              .map(doc => doc.getText())
              .join('\n')
        : '';

const INPUT_SIGNAL_KINDS: ReadonlySet<string> = new Set(['input-signal', 'model']);
const OUTPUT_SIGNAL_KINDS: ReadonlySet<string> = new Set(['output-signal', 'model']);

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
    /** True if `name` is an unresolved identifier - no matching directive class or local const. */
    readonly unresolved?: boolean;
    /** Original identifier text when the entry was dereferenced from a local const. */
    readonly refName?: string;
};

/** `node` without parentheses, `as` and `satisfies` around it. */
const unwrapExpression = (node: ts.Expression): ts.Expression => {
    let current = node;
    while (
        ts.isParenthesizedExpression(current) ||
        ts.isAsExpression(current) ||
        ts.isSatisfiesExpression(current)
    ) {
        current = current.expression;
    }
    return current;
};

/** The initializer of the top-level variable `name` in `srcFile`. */
const localVariableInitializer = (
    name: string,
    srcFile: ts.SourceFile
): ts.Expression | undefined =>
    srcFile.statements
        .filter(ts.isVariableStatement)
        .flatMap(statement => [...statement.declarationList.declarations])
        .find(decl => ts.isIdentifier(decl.name) && decl.name.text === name)?.initializer;

export class ComponentHelper {
    constructor(
        private classHelper: ClassHelper,
        private symbolHelper: SymbolHelper = new SymbolHelper(),
        /** The crawler checker; follows consts imported from other project files. */
        private checker?: ts.TypeChecker
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
     * `HostDirectiveEntry`:
     *
     * 1. Inline `{ directive, inputs, outputs }` object literal - parsed directly.
     * 2. `Identifier` naming a const object, in this file or imported from
     *    another project file (with the crawler checker, through re-exports) -
     *    dereferenced, the identifier text kept as `refName`.
     * 3. Any other `Identifier` (a bare directive class, an unknown name) -
     *    `{ name, unresolved: true }`.
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

            const target = srcFile && this.constInitializer(element, srcFile);
            const value = target && unwrapExpression(target.initializer);
            if (value && ts.isObjectLiteralExpression(value)) {
                const parsed = this.parseHostDirectiveObjectLiteral(value.properties);
                return { ...parsed, refName: identifierName };
            }

            // A bare directive class reference (correct rendering) or a name
            // that does not lead to a const object.
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

    /** A signal input or model member (`signalKind` set by the member visitor), else undefined. */
    public getInputSignal(prop) {
        return INPUT_SIGNAL_KINDS.has(prop.signalKind) ? this.toSignalMember(prop) : undefined;
    }

    /** A signal output or model member (`signalKind` set by the member visitor), else undefined. */
    public getOutputSignal(prop) {
        return OUTPUT_SIGNAL_KINDS.has(prop.signalKind) ? this.toSignalMember(prop) : undefined;
    }

    private toSignalMember(prop) {
        return {
            ...prop,
            required: prop.required === true,
            type: this.parseSignalType(prop.type)
        };
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

    /**
     * The inline `styles` of a decorator: a string, a template literal or an
     * array of them, also through consts and spreads. A template literal with
     * substitutions is kept as written (`${COLOR}` stays in the text); a value
     * that cannot be read (a call, an unknown name) is left out instead of
     * showing its name as CSS.
     */
    public getComponentStyles(
        props: ReadonlyArray<ts.ObjectLiteralElementLike>,
        srcFile: ts.SourceFile
    ): string[] {
        const prop = props.find(p => p.name && ts.isIdentifier(p.name) && p.name.text === 'styles');
        if (!prop) {
            return [];
        }
        if (ts.isShorthandPropertyAssignment(prop)) {
            return this.readStyles(prop.name, srcFile, new Set());
        }
        if (ts.isPropertyAssignment(prop)) {
            return this.readStyles(prop.initializer, srcFile, new Set());
        }
        return [];
    }

    private readStyles(
        node: ts.Expression | undefined,
        srcFile: ts.SourceFile,
        seen: Set<ts.Node>
    ): string[] {
        const expression = node && unwrapExpression(node);
        if (!expression || seen.has(expression)) {
            return [];
        }
        seen.add(expression);
        if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
            return [expression.text];
        }
        if (ts.isTemplateExpression(expression)) {
            return [expression.getText(srcFile).slice(1, -1)];
        }
        if (ts.isArrayLiteralExpression(expression)) {
            return expression.elements.flatMap(element =>
                this.readStyles(
                    ts.isSpreadElement(element) ? element.expression : element,
                    srcFile,
                    seen
                )
            );
        }
        if (ts.isIdentifier(expression)) {
            const target = this.constInitializer(expression, srcFile);
            return target ? this.readStyles(target.initializer, target.srcFile, seen) : [];
        }
        return [];
    }

    /**
     * The initializer of the variable `identifier` names: a top-level variable
     * of this file, else (with the checker) the declaration an import leads
     * to, through re-exports. Anything but a variable (a class) is undefined.
     */
    private constInitializer(
        identifier: ts.Identifier,
        srcFile: ts.SourceFile
    ): { initializer: ts.Expression; srcFile: ts.SourceFile } | undefined {
        const local = localVariableInitializer(identifier.text, srcFile);
        if (local) {
            return { initializer: local, srcFile };
        }
        const symbol = this.checker?.getSymbolAtLocation(identifier);
        if (!symbol) {
            return undefined;
        }
        const target =
            symbol.flags & ts.SymbolFlags.Alias ? this.checker.getAliasedSymbol(symbol) : symbol;
        const declaration = target.valueDeclaration;
        if (!declaration || !ts.isVariableDeclaration(declaration) || !declaration.initializer) {
            return undefined;
        }
        return { initializer: declaration.initializer, srcFile: declaration.getSourceFile() };
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

    /** `<example-url>` tags of the declaration's own JSDoc, resolved against `exampleUrlBase`. */
    public getExampleUrlsOf(node: ts.Node | undefined): Array<string> | undefined {
        const base = Configuration.mainData.exampleUrlBase ?? '';
        return this.getComponentExampleUrls(jsDocTextOf(node))?.map(url =>
            resolveExampleUrl(url, base)
        );
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
     * stripped. Everything else - `CallExpression`, `PropertyAccessExpression`,
     * `TemplateExpression`, `ObjectLiteralExpression`, computed property
     * names, etc. - falls back to `getText()` so complex initializers keep
     * their full source instead of collapsing to `undefined` the way the
     * previous `initializer?.text` access did. Phase 2a bug fix - see
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
