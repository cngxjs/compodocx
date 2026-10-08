import { ts } from 'ts-morph';
import type { IFunctionDecDep } from '../angular/dependencies.interfaces';

/** A provider written as a call: `provideFoo(withBar())` or `...provideFoo()`. */
export interface ProviderCall {
    readonly callee: string;
    /** Callee names of the arguments that are calls (feature functions); others are dropped. */
    readonly args: readonly string[];
}

/**
 * The call of a `providers` array element, or undefined when the element is
 * not a call. A spread of a call keeps the callee and no arguments.
 */
export const providerCallOf = (element: ts.Node): ProviderCall | undefined => {
    if (ts.isCallExpression(element)) {
        return {
            callee: element.expression.getText(),
            // Feature functions from arguments (e.g. withComponentInputBinding())
            args: element.arguments.filter(ts.isCallExpression).map(arg => arg.expression.getText())
        };
    }
    if (ts.isSpreadElement(element) && ts.isCallExpression(element.expression)) {
        return { callee: element.expression.expression.getText(), args: [] };
    }
    return undefined;
};

export class ProviderDetector {
    /**
     * Extract provider function calls from an ApplicationConfig initializer.
     * Walks the `providers` array in the object literal and extracts call expressions.
     */
    public extractProviderCalls(initializer: any): Array<{ name: string; features: string[] }> {
        const providers: Array<{ name: string; features: string[] }> = [];
        if (!initializer || !ts.isObjectLiteralExpression(initializer)) {
            return providers;
        }

        const providersProp = initializer.properties.find(
            (p: any) =>
                ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'providers'
        );
        if (!providersProp || !ts.isPropertyAssignment(providersProp)) {
            return providers;
        }
        const arr = providersProp.initializer;
        if (!ts.isArrayLiteralExpression(arr)) {
            return providers;
        }

        for (const element of arr.elements) {
            const call = providerCallOf(element);
            if (call) {
                providers.push({ name: call.callee, features: [...call.args] });
            }
        }
        return providers;
    }

    public isInjectionToken(initializer: any): boolean {
        if (!initializer) {
            return false;
        }
        // Match: new InjectionToken(...) and new HttpContextToken(...) —
        // both follow the DI-key-as-const idiom, semantically distinct
        // from `@Injectable()` service classes.
        if (ts.isNewExpression(initializer)) {
            const expr = initializer.expression;
            if (expr && ts.isIdentifier(expr)) {
                return expr.text === 'InjectionToken' || expr.text === 'HttpContextToken';
            }
        }
        return false;
    }

    /** Constructor name of a token declaration; call only after `isInjectionToken`. */
    public getTokenConstructorName(initializer: any): 'InjectionToken' | 'HttpContextToken' {
        const expr = initializer?.expression;
        return expr && ts.isIdentifier(expr) && expr.text === 'HttpContextToken'
            ? 'HttpContextToken'
            : 'InjectionToken';
    }

    public getInjectionTokenType(initializer: any): string {
        if (!initializer || !ts.isNewExpression(initializer)) {
            return '';
        }
        // Extract generic type argument: InjectionToken<SomeType>
        if (initializer.typeArguments && initializer.typeArguments.length > 0) {
            return initializer.typeArguments[0].getText();
        }
        return '';
    }

    /** The value of option `name` in `new InjectionToken(desc, { ... })`. */
    private injectionTokenOption(initializer: any, name: string): ts.Expression | undefined {
        if (!initializer || !ts.isNewExpression(initializer)) {
            return undefined;
        }
        // Second argument to InjectionToken constructor is the options object
        const options = initializer.arguments?.[1];
        if (!options || !ts.isObjectLiteralExpression(options)) {
            return undefined;
        }
        const property = options.properties.find(
            (p): p is ts.PropertyAssignment =>
                ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === name
        );
        return property?.initializer;
    }

    public getInjectionTokenProvidedIn(initializer: any): string {
        const value = this.injectionTokenOption(initializer, 'providedIn');
        if (!value) {
            return '';
        }
        // Same convention as `@Injectable`: bare value for string
        // literals, source text for class or module references.
        return ts.isStringLiteralLike(value) ? value.text : value.getText();
    }

    /** Source text of the token's `factory` option; empty without one. */
    public getInjectionTokenFactory(initializer: any): string {
        return this.injectionTokenOption(initializer, 'factory')?.getText() ?? '';
    }

    public detectFunctionalAngularKind(
        returnType: string | undefined,
        name: string
    ): string | undefined {
        if (!returnType) {
            return undefined;
        }
        const rt = returnType.trim();
        // Check return type annotations
        if (
            /CanActivateFn|CanActivateChildFn|CanDeactivateFn|CanMatchFn|boolean\s*\|\s*UrlTree/.test(
                rt
            )
        ) {
            return 'guard';
        }
        if (/ResolveFn|Resolve</.test(rt)) {
            return 'resolver';
        }
        if (/HttpInterceptorFn|HttpHandlerFn/.test(rt)) {
            return 'interceptor';
        }
        // Check variable type annotations (for arrow function exports)
        if (/Guard/i.test(name) && /boolean|Observable<boolean>|Promise<boolean>/.test(rt)) {
            return 'guard';
        }
        return undefined;
    }

    public detectFactoryKind(name: string): IFunctionDecDep['factoryKind'] | undefined {
        if (/^provide[A-Z]/.test(name)) {
            return 'provider';
        }
        if (/^with[A-Z]/.test(name)) {
            return 'feature';
        }
        if (/^inject[A-Z]/.test(name)) {
            return 'inject';
        }
        if (/^create[A-Z]/.test(name)) {
            return 'factory';
        }
        return undefined;
    }
}
