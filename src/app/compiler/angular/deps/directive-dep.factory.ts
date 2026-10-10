import * as crypto from 'node:crypto';
import type { ComponentPlaygroundBlock } from '../../../../templates/helpers/jsdoc';
import { cleanLifecycleHooksFromMethods } from '../../../../utils';
import Configuration from '../../../configuration';
import type { IDep } from '../dependencies.interfaces';
import type { ComponentHelper, HostDirectiveEntry, HostEntry } from './helpers/component-helper';
import type { ProviderEntry } from './helpers/symbol-helper';

export class DirectiveDepFactory {
    constructor(private helper: ComponentHelper) {}

    public create(file: any, srcFile: any, name: any, props: any, IO: any): IDirectiveDep {
        const sourceCode = srcFile.getText();
        const hash = crypto.createHash('sha512').update(sourceCode).digest('hex');
        const directiveDeps: IDirectiveDep = {
            name,
            id: `directive-${name}-${hash}`,
            file: file,
            type: 'directive',
            description: IO.description,
            rawdescription: IO.rawdescription,
            sourceCode: srcFile.getText(),
            selector: this.helper.getComponentSelector(props, srcFile),
            providers: this.helper.getComponentProviders(props, srcFile),
            exportAs: this.helper.getComponentExportAs(props, srcFile),
            hostDirectives: [...this.helper.getComponentHostDirectives(props, srcFile)],
            hostStructured: this.helper.getComponentHostStructured(props),

            standalone: !!this.helper.getComponentStandalone(props, srcFile),

            inputsClass: IO.inputs,
            outputsClass: IO.outputs,

            deprecated: IO.deprecated,
            deprecationMessage: IO.deprecationMessage,

            // Custom JSDoc tags
            signal: IO.signal || false,
            zoneless: IO.zoneless || false,
            beta: IO.beta || false,
            since: IO.since || '',
            breaking: IO.breaking || '',
            aiGenerated: IO.aiGenerated || false,
            group: IO.group || '',
            storybookUrl: IO.storybookUrl || '',
            figmaUrl: IO.figmaUrl || '',
            stackblitzUrl: IO.stackblitzUrl || '',
            githubUrl: IO.githubUrl || '',
            docsUrl: IO.docsUrl || '',

            hostBindings: IO.hostBindings,
            hostListeners: IO.hostListeners,

            propertiesClass: IO.properties,
            methodsClass: IO.methods,
            playgrounds: IO.playgrounds || [],
            slots: IO.slots || [],
            exampleUrls: this.helper.getComponentExampleUrls(srcFile.getText()),
            ...(IO.wcagLevel && { wcagLevel: IO.wcagLevel }),
            ...(IO.a11yNote && { a11yNote: IO.a11yNote }),
            ...(IO.taggedSelector && { taggedSelector: IO.taggedSelector }),
            ...(IO.relatedTo && IO.relatedTo.length > 0 && { relatedTo: IO.relatedTo })
        };

        if (Configuration.mainData.disableLifeCycleHooks) {
            directiveDeps.methodsClass = cleanLifecycleHooksFromMethods(directiveDeps.methodsClass);
        }
        if (IO.jsdoctags && IO.jsdoctags.length > 0) {
            // IO.jsdoctags is already a flat array of tag objects (post-
            // markedtags), not the legacy compodoc shape `[{ tags: [...] }]`.
            // Stripping the [0].tags accessor used to drop every @example /
            // @see / @since the user wrote on a class.
            directiveDeps.jsdoctags = IO.jsdoctags;
        }
        if (IO.extends) {
            directiveDeps.extends = IO.extends;
        }
        if (IO.implements && IO.implements.length > 0) {
            directiveDeps.implements = IO.implements;
        }
        if (IO.constructor && !Configuration.mainData.disableConstructors) {
            directiveDeps.constructorObj = IO.constructor;
        }
        if (IO.accessors) {
            directiveDeps.accessors = IO.accessors;
        }
        if (IO.properties) {
            const { inputSignals, outputSignals, properties } = this.helper.getInputOutputSignals(
                IO.properties
            );

            directiveDeps.inputsClass = directiveDeps.inputsClass.concat(inputSignals);
            directiveDeps.outputsClass = directiveDeps.outputsClass.concat(outputSignals);
            directiveDeps.propertiesClass = properties;
        }

        // Parse host: {} metadata into structured hostBindings/hostListeners
        const host = this.helper.getComponentHost(props);
        if (host && typeof host === 'object') {
            const hostEntries =
                host instanceof Map ? Array.from(host.entries()) : Object.entries(host);

            for (const [key, value] of hostEntries) {
                const k = String(key).trim();
                const v = String(value).trim();
                if (k.startsWith('(') && k.endsWith(')')) {
                    const eventName = k.slice(1, -1);
                    directiveDeps.hostListeners.push({
                        name: eventName,
                        args: [],
                        description: `host: { '(${eventName})': '${v}' }`,
                        line: 0,
                        signalKind: 'host-listener'
                    });
                } else if (k.startsWith('[') && k.endsWith(']')) {
                    const bindingName = k.slice(1, -1);
                    directiveDeps.hostBindings.push({
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

        return directiveDeps;
    }
}

export interface IDirectiveDep extends IDep {
    file: any;
    description: string;
    rawdescription: string;
    sourceCode: string;

    selector: string;
    providers: ProviderEntry[];
    exportAs: string;

    inputsClass: any;
    outputsClass: any;

    standalone: boolean;

    deprecated: boolean;
    deprecationMessage: string;

    // Custom JSDoc tags
    signal?: boolean;
    zoneless?: boolean;
    beta?: boolean;
    since?: string;
    breaking?: string;
    group?: string;
    storybookUrl?: string;
    figmaUrl?: string;
    stackblitzUrl?: string;
    githubUrl?: string;
    docsUrl?: string;

    hostBindings: any;
    hostDirectives: HostDirectiveEntry[];
    hostListeners: any;
    hostStructured?: HostEntry[];

    propertiesClass: any;
    methodsClass: any;
    playgrounds?: ComponentPlaygroundBlock[];
    slots?: Array<{ name: string; description: string }>;
    exampleUrls: Array<string>;

    constructorObj?: Object;
    jsdoctags?: Array<string>;
    implements?: any;
    accessors?: Object;
    extends?: any;
}
