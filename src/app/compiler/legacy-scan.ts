import * as path from 'node:path';
import { ts } from 'ts-morph';

/**
 * Pre-standalone Angular constructs that compodocx no longer documents.
 * The scan is pure syntax, independent of the extractors, so the notice keeps
 * working after the extraction paths for these constructs are gone.
 */
export type LegacyKind =
    | 'ng-module'
    | 'module-with-providers'
    | 'bootstrap-module'
    | 'entry-components'
    | 'router-for-root'
    | 'router-for-child'
    | 'string-load-children'
    | 'input-decorator'
    | 'output-decorator'
    | 'host-binding-decorator'
    | 'host-listener-decorator'
    | 'constructor-injection'
    | 'class-guard'
    | 'class-interceptor'
    | 'class-resolver'
    | 'standalone-false';

export interface LegacyFinding {
    readonly kind: LegacyKind;
    /** Class, member or call the finding is about. */
    readonly name: string;
    /** Relative to the process cwd, forward slashes. */
    readonly file: string;
    /** 1-based. */
    readonly line: number;
}

/** Report order of the kind groups. */
const KIND_ORDER: readonly LegacyKind[] = [
    'ng-module',
    'module-with-providers',
    'bootstrap-module',
    'entry-components',
    'router-for-root',
    'router-for-child',
    'string-load-children',
    'input-decorator',
    'output-decorator',
    'host-binding-decorator',
    'host-listener-decorator',
    'constructor-injection',
    'class-guard',
    'class-interceptor',
    'class-resolver',
    'standalone-false'
];

/**
 * Class decorators of constructs that are not documented. A class carrying one
 * is skipped by the extractors instead of falling back to a plain class page.
 */
export const LEGACY_CLASS_DECORATORS: readonly string[] = ['NgModule'];

const MEMBER_DECORATOR_KINDS: Readonly<Record<string, LegacyKind>> = {
    Input: 'input-decorator',
    Output: 'output-decorator',
    HostBinding: 'host-binding-decorator',
    HostListener: 'host-listener-decorator'
};

const IMPLEMENTS_KINDS: Readonly<Record<string, LegacyKind>> = {
    CanActivate: 'class-guard',
    CanActivateChild: 'class-guard',
    CanDeactivate: 'class-guard',
    CanLoad: 'class-guard',
    CanMatch: 'class-guard',
    Resolve: 'class-resolver',
    HttpInterceptor: 'class-interceptor'
};

const INJECTION_DECORATORS = new Set(['Component', 'Directive', 'Pipe', 'Injectable']);
const DECLARABLE_DECORATORS = new Set(['Component', 'Directive', 'Pipe']);

/** Last identifier of `Name`, `ns.Name` or `Name(...)`. */
const expressionName = (expression: ts.Expression): string => {
    if (ts.isCallExpression(expression)) {
        return expressionName(expression.expression);
    }
    if (ts.isPropertyAccessExpression(expression)) {
        return expression.name.text;
    }
    if (ts.isIdentifier(expression)) {
        return expression.text;
    }
    return '';
};

const decoratorsOf = (node: ts.Node): readonly ts.Decorator[] =>
    (ts.canHaveDecorators(node) && ts.getDecorators(node)) || [];

const decoratorNames = (node: ts.Node): readonly string[] =>
    decoratorsOf(node).map(decorator => expressionName(decorator.expression));

const propertyName = (name: ts.PropertyName | undefined): string =>
    name && (ts.isIdentifier(name) || ts.isStringLiteral(name)) ? name.text : '';

/** Object literal argument of a `@Decorator({...})` call. */
const decoratorMetadata = (decorator: ts.Decorator): ts.ObjectLiteralExpression | undefined => {
    const call = decorator.expression;
    if (!ts.isCallExpression(call)) {
        return undefined;
    }
    const [arg] = call.arguments;
    return arg && ts.isObjectLiteralExpression(arg) ? arg : undefined;
};

const metadataProperty = (
    metadata: ts.ObjectLiteralExpression,
    name: string
): ts.PropertyAssignment | undefined =>
    metadata.properties.find(
        (property): property is ts.PropertyAssignment =>
            ts.isPropertyAssignment(property) && propertyName(property.name) === name
    );

const className = (node: ts.ClassLikeDeclaration): string => node.name?.text ?? 'default';

const memberName = (owner: string, member: ts.ClassElement, sourceFile: ts.SourceFile): string =>
    `${owner}.${member.name?.getText(sourceFile) ?? ''}`;

const isRouterCall = (node: ts.CallExpression, method: string): boolean =>
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === method &&
    expressionName(node.expression.expression) === 'RouterModule';

const returnsModuleWithProviders = (node: ts.MethodDeclaration | ts.FunctionDeclaration): boolean =>
    !!node.type &&
    ts.isTypeReferenceNode(node.type) &&
    (ts.isIdentifier(node.type.typeName)
        ? node.type.typeName.text
        : node.type.typeName.right.text) === 'ModuleWithProviders';

const toRelative = (fileName: string, cwd: string): string =>
    path.relative(cwd, fileName).split(path.sep).join('/');

/** Order findings by file, then line. */
export const sortLegacyFindings = (findings: readonly LegacyFinding[]): readonly LegacyFinding[] =>
    [...findings].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

/** Every legacy construct in one source file, sorted by line. */
export const scanLegacy = (
    sourceFile: ts.SourceFile,
    cwd: string = process.cwd()
): readonly LegacyFinding[] => {
    const file = toRelative(sourceFile.fileName, cwd);
    const findings: LegacyFinding[] = [];
    const add = (kind: LegacyKind, name: string, node: ts.Node): void => {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        findings.push({ kind, name, file, line: line + 1 });
    };

    const scanClass = (node: ts.ClassLikeDeclaration): void => {
        const owner = className(node);
        const decorators = decoratorsOf(node);
        const names = decorators.map(decorator => expressionName(decorator.expression));

        if (names.some(name => LEGACY_CLASS_DECORATORS.includes(name))) {
            add('ng-module', owner, node);
        }
        for (const decorator of decorators) {
            const metadata = decoratorMetadata(decorator);
            if (!metadata) {
                continue;
            }
            const entryComponents = metadataProperty(metadata, 'entryComponents');
            if (entryComponents) {
                add('entry-components', owner, entryComponents);
            }
            const standalone = metadataProperty(metadata, 'standalone');
            const isDeclarable = DECLARABLE_DECORATORS.has(expressionName(decorator.expression));
            if (isDeclarable && standalone?.initializer.kind === ts.SyntaxKind.FalseKeyword) {
                add('standalone-false', owner, standalone);
            }
        }

        const implemented = (node.heritageClauses ?? [])
            .filter(clause => clause.token === ts.SyntaxKind.ImplementsKeyword)
            .flatMap(clause => clause.types.map(type => expressionName(type.expression)));
        const implementedKinds = new Set(implemented.map(name => IMPLEMENTS_KINDS[name]));
        for (const kind of KIND_ORDER.filter(kind => implementedKinds.has(kind))) {
            add(kind, owner, node);
        }

        const injects = names.some(name => INJECTION_DECORATORS.has(name));
        for (const member of node.members) {
            if (injects && ts.isConstructorDeclaration(member) && member.parameters.length > 0) {
                add('constructor-injection', owner, member);
            }
            for (const name of decoratorNames(member)) {
                const kind = MEMBER_DECORATOR_KINDS[name];
                if (kind) {
                    add(kind, memberName(owner, member, sourceFile), member);
                }
            }
        }
    };

    const visit = (node: ts.Node): void => {
        if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
            scanClass(node);
        }
        if (
            (ts.isMethodDeclaration(node) || ts.isFunctionDeclaration(node)) &&
            returnsModuleWithProviders(node)
        ) {
            const owner =
                ts.isMethodDeclaration(node) && ts.isClassLike(node.parent)
                    ? `${className(node.parent)}.`
                    : '';
            add('module-with-providers', `${owner}${node.name?.getText(sourceFile) ?? ''}`, node);
        }
        if (ts.isCallExpression(node)) {
            if (isRouterCall(node, 'forRoot')) {
                add('router-for-root', 'RouterModule.forRoot', node);
            }
            if (isRouterCall(node, 'forChild')) {
                add('router-for-child', 'RouterModule.forChild', node);
            }
            if (
                ts.isPropertyAccessExpression(node.expression) &&
                node.expression.name.text === 'bootstrapModule'
            ) {
                const [target] = node.arguments;
                add(
                    'bootstrap-module',
                    target ? target.getText(sourceFile) : 'bootstrapModule',
                    node
                );
            }
        }
        if (
            ts.isPropertyAssignment(node) &&
            propertyName(node.name) === 'loadChildren' &&
            ts.isStringLiteralLike(node.initializer)
        ) {
            add('string-load-children', node.initializer.text, node);
        }
        ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return sortLegacyFindings(findings);
};

const MAX_LOCATIONS = 10;

/**
 * Warning lines for the legacy notice: a count line, then one line per kind
 * with the first {@link MAX_LOCATIONS} locations. Empty when nothing was found.
 */
export const formatLegacyNotice = (findings: readonly LegacyFinding[]): readonly string[] => {
    if (findings.length === 0) {
        return [];
    }
    const sorted = sortLegacyFindings(findings);
    const noun = findings.length === 1 ? 'construct is' : 'constructs are';
    const groups = KIND_ORDER.map(kind => sorted.filter(finding => finding.kind === kind))
        .filter(group => group.length > 0)
        .map(group => {
            const shown = group
                .slice(0, MAX_LOCATIONS)
                .map(finding => `${finding.file}:${finding.line} ${finding.name}`)
                .join(', ');
            const rest = group.length - MAX_LOCATIONS;
            const more = rest > 0 ? `, ... and ${rest} more` : '';
            return `  ${group[0].kind} (${group.length}): ${shown}${more}`;
        });
    return [`Angular 21+ only: ${findings.length} legacy ${noun} not documented`, ...groups];
};
