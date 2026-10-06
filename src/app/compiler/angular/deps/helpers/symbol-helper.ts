// @ts-nocheck

import { SyntaxKind, ts } from 'ts-morph';
import ImportsUtil from '../../../../../utils/imports.util';
import { TsPrinterUtil } from '../../../../../utils/ts-printer.util';

enum AngularProviderConfigProperties {
    Useclass = 'useClass',
    UseValue = 'useValue',
    UseFactory = 'useFactory',
    UseExisting = 'useExisting'
}

/**
 * Structured representation of a single entry in a `providers: [...]` array.
 *
 * The top-level `name` and `type` fields are preserved for backwards
 * compatibility with every existing downstream consumer (`application.ts`
 * filter, dependencies engine relationships, JSON/PDF exports, menu helpers).
 * `name` is the `provide:` target for object providers, or the class / token
 * identifier for bare providers. `type` is derived from a substring match on
 * the name via `getType(name)` and may be further refined by
 * `application.ts` when the provider matches a known Injectable or
 * Interceptor in the dep-engine registry.
 *
 * The remaining fields are additive and consumed by the render layer
 * (`MetadataProvidersRow`) to emit a source-like code-object literal.
 */
export type ProviderEntry = {
    /** `provide:` target for object providers, else the class / token name. */
    readonly name: string;
    /** Derived from `getType(name)` or set later by `application.ts`. */
    type?: string;

    /** Which DI pattern this provider uses. */
    readonly kind: 'class' | 'useClass' | 'useValue' | 'useFactory' | 'useExisting';
    /** Same as `name` for object providers, omitted for `kind: 'class'`. */
    readonly provide?: string;
    readonly useClass?: string;
    /** Source text of the useValue expression. See `valueKind` for category. */
    readonly useValue?: string;
    readonly valueKind?: 'literal' | 'identifier' | 'expression';
    /** Identifier name of the factory function. */
    readonly factory?: string;
    /** Identifier names of factory dependencies, in source order. */
    readonly deps?: string[];
    readonly useExisting?: string;
    readonly multi?: boolean;
};

export class SymbolHelper {
    private readonly unknown = '???';

    public parseDeepIndentifier(name: string, srcFile?: ts.SourceFile): IParseDeepIdentifierResult {
        const result = {
            name: '',
            type: ''
        };

        if (typeof name === 'undefined') {
            return result;
        }
        const nsModule = name.split('.');
        const type = this.getType(name);

        if (nsModule.length > 1) {
            result.ns = nsModule[0];
            result.name = name;
            result.type = type;
            return result;
        }
        if (typeof srcFile !== 'undefined') {
            result.file = ImportsUtil.getFileNameOfImport(name, srcFile);
        }
        result.name = name;
        result.type = type;
        return result;
    }

    public getType(name: string): string {
        let type;
        if (name.toLowerCase().indexOf('component') !== -1) {
            type = 'component';
        } else if (name.toLowerCase().indexOf('pipe') !== -1) {
            type = 'pipe';
        } else if (name.toLowerCase().indexOf('module') !== -1) {
            type = 'module';
        } else if (name.toLowerCase().indexOf('directive') !== -1) {
            type = 'directive';
        } else if (
            name.toLowerCase().indexOf('injectable') !== -1 ||
            name.toLowerCase().indexOf('service') !== -1
        ) {
            type = 'injectable';
        }
        return type;
    }

    /**
     * Output
     * RouterModule.forRoot 179
     */
    public buildIdentifierName(
        node: ts.Identifier | ts.PropertyAccessExpression | ts.SpreadElement,
        name
    ) {
        if (ts.isIdentifier(node) && !ts.isPropertyAccessExpression(node)) {
            return `${node.text}.${name}`;
        }

        name = name ? `.${name}` : '';

        let nodeName = this.unknown;
        if (node.name) {
            nodeName = node.name.text;
        } else if (node.text) {
            nodeName = node.text;
        } else if (node.expression) {
            if (node.expression.text) {
                nodeName = node.expression.text;
            } else if (node.expression.elements) {
                if (ts.isArrayLiteralExpression(node.expression)) {
                    nodeName = node.expression.elements.map(el => el.text).join(', ');
                    nodeName = `[${nodeName}]`;
                }
            }
        }

        if (ts.isSpreadElement(node)) {
            return `...${nodeName}`;
        }
        return `${this.buildIdentifierName(node.expression, nodeName)}${name}`;
    }

    /**
     * parse expressions such as:
     * { provide: APP_BASE_HREF, useValue: '/' }
     * { provide: 'Date', useFactory: (d1, d2) => new Date(), deps: ['d1', 'd2'] }
     */
    public parseProviderConfiguration(node: ts.ObjectLiteralExpression): string {
        if (node.kind && node.kind === SyntaxKind.ObjectLiteralExpression) {
            const provideProperty = node.properties.find(
                props => props.name.getText() === 'provide'
            );

            if (!provideProperty) {
                throw new Error('provide property not found in provider object config');
            }

            const providerObjectProps = Object.values(AngularProviderConfigProperties);
            for (let i = 0; i < providerObjectProps.length; i++) {
                const providerProp = providerObjectProps[i];
                const prop = node.properties.find(props => props.name.getText() === providerProp);
                if (prop) {
                    return prop.getLastToken().getText();
                }
            }
        }

        return new TsPrinterUtil().print(node);
    }

    /**
     * Kind
     *  181 CallExpression => "RouterModule.forRoot(args)"
     *   71 Identifier     => "RouterModule" "TodoStore"
     *    9 StringLiteral  => "./app.component.css" "./tab.scss"
     */
    public parseSymbolElements(
        node:
            | ts.CallExpression
            | ts.Identifier
            | ts.StringLiteral
            | ts.PropertyAccessExpression
            | ts.SpreadElement
    ): string {
        // parse expressions such as: AngularFireModule.initializeApp(firebaseConfig)
        // if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        if (
            (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) ||
            (ts.isNewExpression(node) && ts.isElementAccessExpression(node.expression))
        ) {
            const className = this.buildIdentifierName(node.expression);

            // function arguments could be really complex. There are so
            // many use cases that we can't handle. Just print "args" to indicate
            // that we have arguments.

            const functionArgs = node.arguments.length > 0 ? 'args' : '';
            const text = `${className}(${functionArgs})`;
            return text;
        } else if (ts.isPropertyAccessExpression(node)) {
            // parse expressions such as: Shared.Module
            return this.buildIdentifierName(node);
        } else if (ts.isIdentifier(node)) {
            // parse expressions such as: MyComponent
            if (node.text) {
                return node.text;
            }
            if (node.escapedText) {
                return node.escapedText;
            }
        } else if (ts.isSpreadElement(node)) {
            // parse expressions such as: ...MYARRAY
            // Resolve MYARRAY in imports or local file variables after full scan, just return the name of the variable
            if (node.expression?.text) {
                return node.expression.text;
            }
        }

        return node.text ? node.text : this.parseProviderConfiguration(node);
    }

    /**
     * Kind
     *  177 ArrayLiteralExpression
     *  122 BooleanKeyword
     *    9 StringLiteral
     */
    private parseSymbols(
        node: ts.ObjectLiteralElement,
        srcFile: ts.SourceFile,
        decoratorType: string
    ): Array<string | boolean> {
        let localNode = node;

        if (ts.isShorthandPropertyAssignment(localNode) && decoratorType !== 'template') {
            localNode = ImportsUtil.findValueInImportOrLocalVariables(
                node.name.text,
                srcFile,
                decoratorType
            );
        }
        if (ts.isShorthandPropertyAssignment(localNode) && decoratorType === 'template') {
            const data = ImportsUtil.findValueInImportOrLocalVariables(
                node.name.text,
                srcFile,
                decoratorType
            );
            return [data];
        }

        if (localNode.initializer && ts.isArrayLiteralExpression(localNode.initializer)) {
            return localNode.initializer.elements.map(x => this.parseSymbolElements(x));
        } else if (
            (localNode.initializer && ts.isStringLiteral(localNode.initializer)) ||
            (localNode.initializer && ts.isTemplateLiteral(localNode.initializer)) ||
            (localNode.initializer &&
                ts.isPropertyAssignment(localNode) &&
                localNode.initializer.text)
        ) {
            return [localNode.initializer.text];
        } else if (
            localNode.initializer?.kind &&
            (localNode.initializer.kind === SyntaxKind.TrueKeyword ||
                localNode.initializer.kind === SyntaxKind.FalseKeyword)
        ) {
            return [localNode.initializer.kind === SyntaxKind.TrueKeyword];
        } else if (localNode.initializer && ts.isPropertyAccessExpression(localNode.initializer)) {
            const identifier = this.parseSymbolElements(localNode.initializer);
            return [identifier];
        } else if (localNode.initializer?.elements && localNode.initializer.elements.length > 0) {
            // Node replaced by ts-simple-ast & kind = 265
            return localNode.initializer.elements.map(x => this.parseSymbolElements(x));
        }
    }

    public getSymbolDeps(
        props: ReadonlyArray<ts.ObjectLiteralElementLike>,
        decoratorType: string,
        srcFile: ts.SourceFile,
        _multiLine?: boolean
    ): Array<string> {
        if (props.length === 0) {
            return [];
        }

        let i = 0,
            len = props.length,
            filteredProps = [];

        for (i; i < len; i++) {
            if (props[i].name && props[i].name.text === decoratorType) {
                filteredProps.push(props[i]);
            }
        }

        return filteredProps.map(x => this.parseSymbols(x, srcFile, decoratorType)).pop() || [];
    }

    public getSymbolDepsRaw(
        props: ReadonlyArray<ts.ObjectLiteralElementLike>,
        type: string,
        _multiLine?: boolean
    ): Array<ts.ObjectLiteralElementLike> {
        return props.filter(node => node.name.getText() === type);
    }

    /**
     * Parse the providers / viewProviders array of a decorator into typed
     * `ProviderEntry[]`. Replaces the old string-based
     * `getSymbolDeps(props, 'providers', ...)` + `parseDeepIndentifier` chain
     * for provider keys, which discarded the `provide:` target of object
     * providers and surfaced the last token of whichever `use*` key matched
     * first instead.
     *
     * Accepts the decorator `props` and the key to read (`providers`,
     * `viewProviders` or module `providers`). Returns an empty array when the
     * key is absent or its initializer is not an array literal.
     */
    public getProviderEntries(
        props: ReadonlyArray<ts.ObjectLiteralElementLike>,
        decoratorKey: string,
        srcFile?: ts.SourceFile
    ): ProviderEntry[] {
        let matching: any;
        for (const prop of props) {
            if (prop.name && (prop.name as any).text === decoratorKey) {
                matching = prop;
                break;
            }
        }
        if (!matching) {
            return [];
        }

        let arrayLiteral: ts.ArrayLiteralExpression | undefined;
        const initializer = matching.initializer;
        if (initializer && ts.isArrayLiteralExpression(initializer)) {
            arrayLiteral = initializer;
        } else if (
            srcFile &&
            (ts.isShorthandPropertyAssignment(matching) ||
                (initializer && ts.isIdentifier(initializer)))
        ) {
            // Object-Literal-Shorthand resolution: `@Component({ providers })`
            // resolves to a local `const providers = [Foo]` declaration.
            // Mirrors the shorthand-aware branch in `parseSymbols` but
            // returns the underlying array literal so the typed
            // `ProviderEntry[]` shape is preserved.
            const name = ts.isShorthandPropertyAssignment(matching)
                ? (matching.name as any).text
                : (initializer as any).text;
            arrayLiteral = this.resolveLocalArrayLiteral(name, srcFile);
        }

        if (!arrayLiteral) {
            return [];
        }

        const result: ProviderEntry[] = [];
        for (const element of arrayLiteral.elements) {
            const entry = this.parseProviderElement(element);
            if (entry) {
                result.push(entry);
            }
        }
        return result;
    }

    /**
     * Walk the top-level statements of `srcFile` and return the array literal
     * bound to a `const`/`let` declaration matching `name`. Used by
     * `getProviderEntries` for Object-Literal-Shorthand resolution.
     */
    private resolveLocalArrayLiteral(
        name: string,
        srcFile: ts.SourceFile
    ): ts.ArrayLiteralExpression | undefined {
        for (const stmt of srcFile.statements) {
            if (!ts.isVariableStatement(stmt)) {
                continue;
            }
            for (const decl of stmt.declarationList.declarations) {
                if (
                    ts.isIdentifier(decl.name) &&
                    decl.name.text === name &&
                    decl.initializer &&
                    ts.isArrayLiteralExpression(decl.initializer)
                ) {
                    return decl.initializer;
                }
            }
        }
        return undefined;
    }

    /**
     * Classify a single array element of a `providers: [...]` literal.
     *
     * - `{ provide: X, useClass: Y }` → `{ name: 'X', kind: 'useClass', ... }`
     * - `X` (Identifier, bare class or InjectionToken) → `{ name: 'X', kind: 'class' }`
     * - Any call / property-access / unexpected shape falls back to a best-
     *   effort identifier name with `kind: 'class'` so the downstream filter
     *   and render paths stay consistent.
     */
    private parseProviderElement(element: ts.Node): ProviderEntry | undefined {
        if (!element) {
            return undefined;
        }
        if (ts.isObjectLiteralExpression(element)) {
            return this.parseProviderObjectLiteral(element);
        }
        if (ts.isIdentifier(element)) {
            const name = element.text;
            return { name, kind: 'class', type: this.getType(name) };
        }
        // Fallback: extract best-effort text via the existing element parser
        // (handles CallExpression, PropertyAccessExpression, SpreadElement).
        const text = this.parseSymbolElements(element as any);
        if (!text || typeof text !== 'string') {
            return undefined;
        }
        return { name: text, kind: 'class', type: this.getType(text) };
    }

    /**
     * Walk the properties of a `{ provide: ..., useX: ... }` object literal
     * and build a typed `ProviderEntry`. The `provide:` target becomes the
     * primary `name` lookup key for every downstream consumer; the `use*`
     * payload is captured in its own typed field.
     */
    private parseProviderObjectLiteral(node: ts.ObjectLiteralExpression): ProviderEntry {
        let provideName = '';
        let useClass: string | undefined;
        let useValue: string | undefined;
        let valueKind: ProviderEntry['valueKind'] | undefined;
        let factory: string | undefined;
        let deps: string[] | undefined;
        let useExisting: string | undefined;
        let multi: boolean | undefined;

        for (const property of node.properties) {
            if (!ts.isPropertyAssignment(property) || !property.name) {
                continue;
            }
            const keyText = (property.name as any).text ?? property.name.getText();
            const init = property.initializer;
            switch (keyText) {
                case 'provide':
                    provideName = this.readIdentifierOrLiteralText(init);
                    break;
                case 'useClass':
                    useClass = this.readIdentifierOrLiteralText(init);
                    break;
                case 'useValue':
                    useValue = init.getText();
                    valueKind = this.classifyValueKind(init);
                    break;
                case 'useFactory':
                    factory = this.readIdentifierOrLiteralText(init);
                    break;
                case 'useExisting':
                    useExisting = this.readIdentifierOrLiteralText(init);
                    break;
                case 'deps':
                    if (ts.isArrayLiteralExpression(init)) {
                        deps = [];
                        for (const dep of init.elements) {
                            const depText = this.readIdentifierOrLiteralText(dep);
                            if (depText) {
                                deps.push(depText);
                            }
                        }
                    }
                    break;
                case 'multi':
                    multi = init.kind === SyntaxKind.TrueKeyword;
                    break;
            }
        }

        const kind: ProviderEntry['kind'] = useClass
            ? 'useClass'
            : useValue !== undefined
              ? 'useValue'
              : factory
                ? 'useFactory'
                : useExisting
                  ? 'useExisting'
                  : 'class';

        const entry: ProviderEntry = {
            name: provideName,
            kind,
            provide: provideName,
            type: this.getType(provideName)
        };
        if (useClass) {
            (entry as any).useClass = useClass;
        }
        if (useValue !== undefined) {
            (entry as any).useValue = useValue;
            (entry as any).valueKind = valueKind;
        }
        if (factory) {
            (entry as any).factory = factory;
        }
        if (deps) {
            (entry as any).deps = deps;
        }
        if (useExisting) {
            (entry as any).useExisting = useExisting;
        }
        if (multi) {
            (entry as any).multi = true;
        }
        return entry;
    }

    /**
     * Read the source text of a node that is expected to be an identifier or
     * a simple literal (StringLiteral / NumericLiteral /
     * NoSubstitutionTemplateLiteral). Literal values are returned without
     * their surrounding quotes. Unexpected kinds fall back to the full
     * `getText()` source.
     */
    private readIdentifierOrLiteralText(node: ts.Node): string {
        if (!node) {
            return '';
        }
        if (ts.isIdentifier(node)) {
            return node.text;
        }
        if (
            ts.isStringLiteral(node) ||
            ts.isNoSubstitutionTemplateLiteral(node) ||
            ts.isNumericLiteral(node)
        ) {
            return node.text;
        }
        return node.getText();
    }

    /**
     * Classify the kind of a `useValue` initializer for the render layer.
     * Literal kinds carry their inner content in `useValue`; identifier refs
     * are rendered as linkable tokens; everything else (object literals,
     * arrays, calls, template expressions) is an opaque expression the
     * renderer shows verbatim.
     */
    private classifyValueKind(node: ts.Node): ProviderEntry['valueKind'] {
        if (
            ts.isStringLiteral(node) ||
            ts.isNoSubstitutionTemplateLiteral(node) ||
            ts.isNumericLiteral(node) ||
            node.kind === SyntaxKind.TrueKeyword ||
            node.kind === SyntaxKind.FalseKeyword ||
            node.kind === SyntaxKind.NullKeyword ||
            node.kind === SyntaxKind.UndefinedKeyword
        ) {
            return 'literal';
        }
        if (ts.isIdentifier(node)) {
            return 'identifier';
        }
        return 'expression';
    }
}

export interface IParseDeepIdentifierResult {
    ns?: any;
    name: string;
    file?: string;
    type: string | undefined;
}
