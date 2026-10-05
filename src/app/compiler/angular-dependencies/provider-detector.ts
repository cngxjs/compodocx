import { ts } from 'ts-morph';
import type { IFunctionDecDep } from '../angular/dependencies.interfaces';

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
            if (ts.isCallExpression(element)) {
                const callName = element.expression.getText();
                const features: string[] = [];

                // Extract feature functions from arguments (e.g. withComponentInputBinding())
                for (const arg of element.arguments) {
                    if (ts.isCallExpression(arg)) {
                        features.push(arg.expression.getText());
                    }
                }

                providers.push({ name: callName, features });
            } else if (ts.isSpreadElement(element) && ts.isCallExpression(element.expression)) {
                providers.push({
                    name: element.expression.expression.getText(),
                    features: []
                });
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

    public getInjectionTokenProvidedIn(initializer: any): string {
        if (!initializer || !ts.isNewExpression(initializer)) {
            return '';
        }
        // Second argument to InjectionToken constructor is the options object
        const args = initializer.arguments;
        if (args && args.length >= 2 && ts.isObjectLiteralExpression(args[1])) {
            const providedInProp = args[1].properties.find(
                (p: any) =>
                    ts.isPropertyAssignment(p) &&
                    ts.isIdentifier(p.name) &&
                    p.name.text === 'providedIn'
            );
            if (providedInProp && ts.isPropertyAssignment(providedInProp)) {
                // Same convention as `@Injectable`: bare value for string
                // literals, source text for class or module references.
                const value = providedInProp.initializer;
                return ts.isStringLiteralLike(value) ? value.text : value.getText();
            }
        }
        return '';
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
            /CanActivateFn|CanActivate|CanDeactivate|CanMatch|CanLoad|boolean\s*\|\s*UrlTree/.test(
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
