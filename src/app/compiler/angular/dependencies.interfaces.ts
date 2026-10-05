export type WcagLevel = 'A' | 'AA' | 'AAA';

export interface IDep {
    id?: string;
    type?: string;
    ctype?: string;
    name: string;
    category?: string;
    docsKind?: 'primary';
    wcagLevel?: WcagLevel;
    a11yNote?: string;
    taggedSelector?: string;
    relatedTo?: string[];
}

export interface IInjectableDep extends IDep {
    file: any;
    properties: Array<any>;
    methods: Array<any>;
    deprecated: boolean;
    deprecationMessage: string;
    category?: string;
    description: string;
    rawdescription: string;
    sourceCode: string;
    exampleUrls?;
    extends?;

    isToken?: boolean;
    tokenClass?: 'InjectionToken' | 'HttpContextToken';
    tokenType?: string;
    providedIn?: string;

    accessors?: Object;
    constructorObj?: Object;
    jsdoctags?: Array<string>;

    since?: string;

    storybookUrl?: string;
    figmaUrl?: string;
    stackblitzUrl?: string;
    githubUrl?: string;
    docsUrl?: string;
}

export interface IInterceptorDep extends IDep {
    file: any;
    properties: Array<any>;
    methods: Array<any>;
    deprecated: boolean;
    deprecationMessage: string;
    category?: string;
    description: string;
    sourceCode: string;

    accessors?: Object;
    constructorObj?: Object;
    jsdoctags?: Array<string>;
}

export interface IGuardDep extends IDep {
    file: any;
    properties: Array<any>;
    methods: Array<any>;
    deprecated: boolean;
    deprecationMessage: string;
    category?: string;
    description: string;
    sourceCode: string;

    accessors?: Object;
    constructorObj?: Object;
    jsdoctags?: Array<string>;
}

export interface IPipeDep extends IDep {
    file: any;
    deprecated: boolean;
    deprecationMessage: string;
    category?: string;
    description: string;
    rawdescription: string;
    sourceCode: string;
    exampleUrls?;

    standalone: boolean;

    methods: Array<any>;
    properties: Array<any>;
    pure: string;
    ngname: string;

    jsdoctags?: Array<string>;

    storybookUrl?: string;
    figmaUrl?: string;
    stackblitzUrl?: string;
    githubUrl?: string;
    docsUrl?: string;
}

export interface IInterfaceDep extends IDep {
    file: any;
    sourceCode: string;

    properties?: Array<any>;
    indexSignatures?: any;
    kind?: any;
    deprecated: boolean;
    deprecationMessage: string;
    category?: string;
    description?: string;
    rawdescription?: string;
    methods?: Array<any>;
    extends?: Array<any>;

    storybookUrl?: string;
    figmaUrl?: string;
    stackblitzUrl?: string;
    githubUrl?: string;
    docsUrl?: string;
}

export interface IFunctionDecDep extends IDep {
    file: any;
    subtype: string;
    deprecated: boolean;
    deprecationMessage: string;
    category?: string;
    description: string;

    factoryKind?: 'provider' | 'feature' | 'inject' | 'factory';

    returnType?: string;
    args?: Array<any>;
    jsdoctags?: string;
}

export interface IEnumDecDep extends IDep {
    childs: Array<any>;
    subtype: string;
    deprecated: boolean;
    deprecationMessage: string;
    category?: string;
    description: string;
    file: any;
}

export interface ITypeAliasDecDep extends IDep {
    subtype: string;
    file: any;
    rawtype: any;
    deprecated: boolean;
    deprecationMessage: string;
    category?: string;
    description: string;

    kind?;
}

import type { HostDirectiveEntry } from './deps/helpers/component-helper';
import type { ProviderEntry } from './deps/helpers/symbol-helper';

export interface Deps {
    id: string;
    name: string;
    type: string;
    subtype?: string;
    rawtype?: any;
    kind?: string;
    label?: string;
    file?: string;
    sourceCode?: string;
    deprecated?: boolean;
    deprecationMessage?: string;
    category?: string;
    description?: string;

    // Component

    animations?: string[]; // TODO
    changeDetection?: string;
    encapsulation?: string;
    entryComponents?: string; // TODO
    exportAs?: string;
    host?: any;
    hostDirectives?: HostDirectiveEntry[];
    inputs?: string[];
    interpolation?: string; // TODO
    moduleId?: string;
    outputs?: string[];
    queries?: Deps[]; // TODO
    selector?: string;
    styleUrls?: string[];
    styles?: string[];
    template?: string;
    templateUrl?: string[];
    viewProviders?: ProviderEntry[];
    exampleUrls?: string[];

    implements?;
    extends?;

    inputsClass?: Object[];
    outputsClass?: Object[];
    propertiesClass?: Object[];
    methodsClass?: Object[];

    hostBindings?: Object[];
    hostListeners?: Object[];

    // common
    providers?: ProviderEntry[];

    // module
    declarations?: Deps[];
    bootstrap?: Deps[];

    imports?: Deps[];
    exports?: Deps[];

    routesTree?;
}

export interface SymbolDeps {
    full: string;
    alias: string;
}
