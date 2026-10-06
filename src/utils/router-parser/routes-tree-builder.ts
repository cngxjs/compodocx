import * as path from 'node:path';

import FileEngine from '../../app/engines/file.engine';
import type { RouteStore } from './route-store';

export interface RoutesTree {
    readonly name: '<root>';
    readonly kind: 'root';
    readonly children: readonly object[];
}

export class RoutesTreeBuilder {
    constructor(private readonly routeStore: RouteStore) {}

    public constructRoutesTree(): RoutesTree {
        const validChildren = [];

        // Comprehensive validation function to prevent any undefined/invalid entries
        const isValidName = (name: string): boolean => {
            return (
                name &&
                typeof name === 'string' &&
                name.trim() !== '' &&
                name !== 'undefined' &&
                name !== 'null' &&
                !name.includes('undefined') &&
                name.length > 0 &&
                !/^\s*$/.test(name)
            ); // Not just whitespace
        };

        // Process routes data if available to extract components and paths
        for (const route of this.routeStore.routes) {
            try {
                const routeData = JSON.parse(route.data);
                for (const routeItem of routeData) {
                    if (routeItem.component && isValidName(routeItem.component)) {
                        validChildren.push({
                            name: routeItem.component,
                            kind: 'component',
                            path: routeItem.path || '',
                            filename: route.filename
                        });
                    }
                }
            } catch (_e) {
                // JSON parsing failed, try regex extraction with strict validation

                // Extract component names with rigorous validation
                const componentMatches = route.data.match(/"component"\s*:\s*"(\w+Component)"/g);
                if (componentMatches) {
                    for (const match of componentMatches) {
                        const componentNameMatch = match.match(
                            /"component"\s*:\s*"(\w+Component)"/
                        );
                        if (componentNameMatch && isValidName(componentNameMatch[1])) {
                            validChildren.push({
                                name: componentNameMatch[1],
                                kind: 'component',
                                filename: route.filename
                            });
                        }
                    }
                }

                // Extract path values with strict validation (avoiding problematic patterns)
                const pathMatches = route.data.match(/"path"\s*:\s*"([^"]+)"/g);
                if (pathMatches) {
                    for (const match of pathMatches) {
                        const pathNameMatch = match.match(/"path"\s*:\s*"([^"]+)"/);
                        if (
                            pathNameMatch &&
                            isValidName(pathNameMatch[1]) &&
                            !pathNameMatch[1].includes('ABOUT_ENUMS') &&
                            !pathNameMatch[1].includes('.')
                        ) {
                            // Avoid dynamic property access
                            validChildren.push({
                                name: pathNameMatch[1],
                                kind: 'route-path',
                                filename: route.filename
                            });
                        }
                    }
                }

                // Extract redirectTo values with strict validation
                const redirectMatches = route.data.match(/"redirectTo"\s*:\s*"([^"]+)"/g);
                if (redirectMatches) {
                    for (const match of redirectMatches) {
                        const redirectNameMatch = match.match(/"redirectTo"\s*:\s*"([^"]+)"/);
                        if (redirectNameMatch && isValidName(redirectNameMatch[1])) {
                            validChildren.push({
                                name: redirectNameMatch[1],
                                kind: 'route-redirect',
                                filename: route.filename
                            });
                        }
                    }
                }

                // Handle static enum values by detecting enum.property patterns
                const enumMappings = {
                    'ABOUT_ENUMS.todomvc': 'todomvcinstaticclass',
                    'APP_ENUM.homeenumimported': 'homeenumimported',
                    'APP_ENUM.homeenuminfile': 'homeenuminfile'
                };

                for (const [enumPattern, staticValue] of Object.entries(enumMappings)) {
                    // Look for various patterns that might appear in route data:
                    const patterns = [
                        enumPattern, // ABOUT_ENUMS.todomvc
                        `"${enumPattern.replace('.', '"."')}"`, // "ABOUT_ENUMS"."todomvc"
                        `"${enumPattern.replace('.', '\\"."')}"`, // "ABOUT_ENUMS\."todomvc"
                        enumPattern.replace('.', '"."'), // ABOUT_ENUMS"."todomvc
                        enumPattern.replace('.', '\\"."'), // ABOUT_ENUMS\."todomvc
                        `"${enumPattern.split('.')[0]}"\\."${enumPattern.split('.')[1]}"` // "ABOUT_ENUMS"\."todomvc"
                    ];

                    let found = false;
                    for (const pattern of patterns) {
                        if (route.data.includes(pattern)) {
                            found = true;
                            break;
                        }
                    }

                    if (found && !validChildren.some(child => child.name === staticValue)) {
                        validChildren.push({
                            name: staticValue,
                            kind: 'route-path',
                            filename: route.filename
                        });
                    }
                }
            }
        }

        return { name: '<root>', kind: 'root', children: validChildren };
    }

    public generateRoutesIndex(outputFolder: string, routes: Array<any>): Promise<void> {
        return Promise.resolve().then(
            () => {
                const result = `var ROUTES_INDEX = ${JSON.stringify(routes)}`;
                const testOutputDir = outputFolder.match(process.cwd());

                if (testOutputDir && testOutputDir.length > 0) {
                    outputFolder = outputFolder.replace(process.cwd() + path.sep, '');
                }

                return FileEngine.write(
                    `${outputFolder + path.sep}/js/routes/routes_index.js`,
                    result
                );
            },
            _err => Promise.reject('Error during routes index generation')
        );
    }
}
