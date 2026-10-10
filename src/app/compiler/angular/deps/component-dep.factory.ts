import * as crypto from 'node:crypto';
import type { ComponentPlaygroundBlock } from '../../../../templates/helpers/jsdoc';
import { cleanLifecycleHooksFromMethods } from '../../../../utils';
import Configuration from '../../../configuration';
import type { IDep } from '../dependencies.interfaces';
import type { ComponentHelper, HostDirectiveEntry, HostEntry } from './helpers/component-helper';
import type { ProviderEntry } from './helpers/symbol-helper';

export class ComponentDepFactory {
    constructor(private helper: ComponentHelper) {}

    public create(file: any, srcFile: any, name: any, props: any, IO: any): IComponentDep {
        // console.log(util.inspect(props, { showHidden: true, depth: 10 }));
        const sourceCode = srcFile.getText();
        const hash = crypto.createHash('sha512').update(sourceCode).digest('hex');
        const componentDep: IComponentDep = {
            name,
            id: `component-${name}-${hash}`,
            file: file,
            // animations?: string[]; // TODO
            changeDetection: this.helper.getComponentChangeDetection(props, srcFile),
            encapsulation: this.helper.getComponentEncapsulation(props, srcFile),
            exportAs: this.helper.getComponentExportAs(props, srcFile),
            host: this.helper.getComponentHost(props),
            hostStructured: this.helper.getComponentHostStructured(props),
            inputs: this.helper.getComponentInputsMetadata(props, srcFile),
            // interpolation?: string; // TODO waiting doc infos
            moduleId: this.helper.getComponentModuleId(props, srcFile),
            outputs: this.helper.getComponentOutputs(props, srcFile),
            providers: this.helper.getComponentProviders(props, srcFile),
            // queries?: Deps[]; // TODO
            selector: this.helper.getComponentSelector(props, srcFile),
            styleUrls: this.helper.getComponentStyleUrls(props, srcFile),
            styles: this.helper.getComponentStyles(props, srcFile), // TODO fix args
            template: this.helper.getComponentTemplate(props, srcFile),
            templateUrl: this.helper.getComponentTemplateUrl(props, srcFile),
            viewProviders: this.helper.getComponentViewProviders(props, srcFile),
            hostDirectives: [...this.helper.getComponentHostDirectives(props, srcFile)],
            inputsClass: IO.inputs,
            outputsClass: IO.outputs,
            propertiesClass: IO.properties,
            methodsClass: IO.methods,

            deprecated: IO.deprecated,
            deprecationMessage: IO.deprecationMessage,

            // Custom JSDoc tags (Phase 4.6)
            signal: IO.signal || false,
            zoneless: IO.zoneless || false,
            beta: IO.beta || false,
            since: IO.since || '',
            breaking: IO.breaking || '',
            aiGenerated: IO.aiGenerated || false,
            route: IO.route || '',
            group: IO.group || '',
            order: IO.order || 0,
            storybookUrl: IO.storybookUrl || '',
            figmaUrl: IO.figmaUrl || '',
            stackblitzUrl: IO.stackblitzUrl || '',
            githubUrl: IO.githubUrl || '',
            docsUrl: IO.docsUrl || '',
            slots: IO.slots || [],
            playgrounds: IO.playgrounds || [],
            ...(IO.wcagLevel && { wcagLevel: IO.wcagLevel }),
            ...(IO.a11yNote && { a11yNote: IO.a11yNote }),
            ...(IO.taggedSelector && { taggedSelector: IO.taggedSelector }),
            ...(IO.relatedTo && IO.relatedTo.length > 0 && { relatedTo: IO.relatedTo }),

            hostBindings: IO.hostBindings,
            hostListeners: IO.hostListeners,

            standalone: !!this.helper.getComponentStandalone(props, srcFile),
            imports: this.helper.getComponentImports(props, srcFile),

            description: IO.description,
            rawdescription: IO.rawdescription,
            type: 'component',
            sourceCode: srcFile.getText(),
            exampleUrls: this.helper.getComponentExampleUrls(srcFile.getText()),

            tag: this.helper.getComponentTag(props, srcFile),
            styleUrl: this.helper.getComponentStyleUrl(props, srcFile),
            shadow: this.helper.getComponentShadow(props, srcFile),
            scoped: this.helper.getComponentScoped(props, srcFile),
            assetsDir: this.helper.getComponentAssetsDir(props, srcFile),
            assetsDirs: this.helper.getComponentAssetsDirs(props, srcFile),
            styleUrlsData: '',
            stylesData: ''
        };
        if (typeof this.helper.getComponentPreserveWhitespaces(props, srcFile) !== 'undefined') {
            componentDep.preserveWhitespaces = this.helper.getComponentPreserveWhitespaces(
                props,
                srcFile
            );
        }
        if (Configuration.mainData.disableLifeCycleHooks) {
            componentDep.methodsClass = cleanLifecycleHooksFromMethods(componentDep.methodsClass);
        }
        if (IO.jsdoctags && IO.jsdoctags.length > 0) {
            // IO.jsdoctags is already a flat array of tag objects (post-
            // markedtags), not the legacy compodoc shape `[{ tags: [...] }]`.
            // Stripping the [0].tags accessor used to drop every @example /
            // @see / @since the user wrote on a class.
            componentDep.jsdoctags = IO.jsdoctags;
        }
        if (IO.constructor && !Configuration.mainData.disableConstructors) {
            componentDep.constructorObj = IO.constructor;
        }
        if (IO.extends) {
            componentDep.extends = IO.extends;
        }
        if (IO.implements && IO.implements.length > 0) {
            componentDep.implements = IO.implements;
        }
        if (IO.accessors) {
            componentDep.accessors = IO.accessors;
        }
        if (IO.properties) {
            const { inputSignals, outputSignals, properties } = this.helper.getInputOutputSignals(
                IO.properties
            );

            componentDep.inputsClass = componentDep.inputsClass.concat(inputSignals);
            componentDep.outputsClass = componentDep.outputsClass.concat(outputSignals);
            componentDep.propertiesClass = properties;
        }

        // Parse host: {} metadata into structured hostBindings/hostListeners
        if (componentDep.host && typeof componentDep.host === 'object') {
            const hostEntries =
                componentDep.host instanceof Map
                    ? Array.from(componentDep.host.entries())
                    : Object.entries(componentDep.host);

            for (const [key, value] of hostEntries) {
                const k = String(key).trim();
                const v = String(value).trim();
                if (k.startsWith('(') && k.endsWith(')')) {
                    // Event listener: (click) -> onClick()
                    const eventName = k.slice(1, -1);
                    componentDep.hostListeners.push({
                        name: eventName,
                        args: [],
                        description: `host: { '(${eventName})': '${v}' }`,
                        line: 0,
                        signalKind: 'host-listener'
                    });
                } else if (k.startsWith('[') && k.endsWith(']')) {
                    // Property/attribute/class binding: [class.active] -> isActive
                    const bindingName = k.slice(1, -1);
                    componentDep.hostBindings.push({
                        name: bindingName,
                        defaultValue: v,
                        type: '',
                        description: `host: { '${k}': '${v}' }`,
                        line: 0,
                        signalKind: 'host-binding'
                    });
                }
            }
        }

        return componentDep;
    }
}

export interface IComponentDep extends IDep {
    file: any;
    changeDetection: any;
    encapsulation: any;
    exportAs: any;
    host: any;
    hostStructured?: HostEntry[];
    hostDirectives: HostDirectiveEntry[];
    inputs: Array<any>;
    outputs: Array<any>;
    providers: ProviderEntry[];
    moduleId: string;
    selector: string;
    styleUrls: Array<string>;
    styleUrlsData: string;
    styles: Array<string>;
    stylesData: string;
    template: string;
    templateUrl: Array<string>;
    viewProviders: Array<any>;
    inputsClass: Array<any>;
    outputsClass: Array<any>;
    propertiesClass: Array<any>;
    methodsClass: Array<any>;

    deprecated: boolean;
    deprecationMessage: string;

    // Custom JSDoc tags
    signal?: boolean;
    zoneless?: boolean;
    beta?: boolean;
    since?: string;
    breaking?: string;
    route?: string;
    group?: string;
    order?: number;
    storybookUrl?: string;
    figmaUrl?: string;
    stackblitzUrl?: string;
    githubUrl?: string;
    docsUrl?: string;
    slots?: Array<{ name: string; description: string }>;

    /**
     * Author-supplied runnable playground blocks (one per `@playground <title>`
     * JSDoc tag on the class). Drives the Playground tab + StackBlitz launcher.
     * Empty when the component declares no `@playground` blocks.
     */
    playgrounds?: ComponentPlaygroundBlock[];

    standalone: boolean;
    imports: Array<any>;

    hostBindings: Array<any>;
    hostListeners: Array<any>;

    description: string;
    rawdescription: string;
    sourceCode: string;
    exampleUrls: Array<string>;

    constructorObj?: Object;
    jsdoctags?: Array<string>;
    extends?: any;
    implements?: any;
    accessors?: Object;

    tag?: string;
    styleUrl?: string;
    shadow?: string;
    scoped?: string;
    assetsDir?: string;
    assetsDirs?: Array<string>;

    preserveWhitespaces?: any;
}
