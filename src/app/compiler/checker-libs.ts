import { createRequire } from 'node:module';
import * as path from 'node:path';
import { ts } from 'ts-morph';

/**
 * Declaration files the crawler checker reads besides the project: the
 * TypeScript lib and a small `@angular/core` declaration for the signal
 * factories. Both live in a virtual folder; nothing is read from the
 * project's `node_modules`.
 */
export const CHECKER_LIB_FOLDER = '/compodocx-lib';

/** The default lib: ES2022 with the DOM, like an Angular app. */
export const CHECKER_DEFAULT_LIB = `${CHECKER_LIB_FOLDER}/lib.es2022.full.d.ts`;

/** Root file of the crawler program that declares the signal factories. */
export const ANGULAR_SIGNALS_FILE = `${CHECKER_LIB_FOLDER}/angular-signals.d.ts`;

/**
 * The public signatures of `signal`, `computed`, `linkedSignal`, `input`,
 * `model` and `inject`, so that `this.count()` inside a `computed()` callback
 * has the value type of `count` and `this.store.items()` the value type of
 * `items` of an injected `Store`. An ambient module needs no module
 * resolution; other imports from `@angular/core` stay unresolved, as without
 * this file.
 */
const ANGULAR_SIGNALS = `declare module '@angular/core' {
    const SIGNAL: unique symbol;
    export type Signal<T> = (() => T) & { [SIGNAL]: unknown };
    export interface WritableSignal<T> extends Signal<T> {
        set(value: T): void;
        update(updateFn: (value: T) => T): void;
        asReadonly(): Signal<T>;
    }
    export function signal<T>(initialValue: T, options?: unknown): WritableSignal<T>;
    export function computed<T>(computation: () => T, options?: unknown): Signal<T>;
    export function linkedSignal<D>(computation: () => D, options?: unknown): WritableSignal<D>;
    export function linkedSignal<S, D>(options: {
        source: () => S;
        computation: (source: NoInfer<S>, previous?: { source: NoInfer<S>; value: NoInfer<D> }) => D;
        equal?: unknown;
    }): WritableSignal<D>;

    interface InputOptions<T, TransformT> {
        alias?: string;
        transform?: (v: TransformT) => T;
        debugName?: string;
    }
    type InputOptionsWithoutTransform<T> = Omit<InputOptions<T, T>, 'transform'> & {
        transform?: undefined;
    };
    type InputOptionsWithTransform<T, TransformT> = Required<Pick<InputOptions<T, TransformT>, 'transform'>> & InputOptions<T, TransformT>;
    const INPUT_SIGNAL_BRAND_READ_TYPE: unique symbol;
    const INPUT_SIGNAL_BRAND_WRITE_TYPE: unique symbol;
    export interface InputSignalWithTransform<T, TransformT> extends Signal<T> {
        [INPUT_SIGNAL_BRAND_READ_TYPE]: T;
        [INPUT_SIGNAL_BRAND_WRITE_TYPE]: TransformT;
    }
    export interface InputSignal<T> extends InputSignalWithTransform<T, T> {}
    interface InputFunction {
        <T>(): InputSignal<T | undefined>;
        <T>(initialValue: T, opts?: InputOptionsWithoutTransform<T>): InputSignal<T>;
        <T>(initialValue: undefined, opts: InputOptionsWithoutTransform<T>): InputSignal<T | undefined>;
        <T, TransformT>(initialValue: T, opts: InputOptionsWithTransform<T, TransformT>): InputSignalWithTransform<T, TransformT>;
        <T, TransformT>(initialValue: undefined, opts: InputOptionsWithTransform<T | undefined, TransformT>): InputSignalWithTransform<T | undefined, TransformT>;
        required: {
            <T>(opts?: InputOptionsWithoutTransform<T>): InputSignal<T>;
            <T, TransformT>(opts: InputOptionsWithTransform<T, TransformT>): InputSignalWithTransform<T, TransformT>;
        };
    }
    export const input: InputFunction;

    interface OutputRef<T> {
        subscribe(callback: (value: T) => void): { unsubscribe(): void };
    }
    interface ModelOptions {
        alias?: string;
        debugName?: string;
    }
    export interface ModelSignal<T> extends WritableSignal<T>, InputSignal<T>, OutputRef<T> {}
    interface ModelFunction {
        <T>(): ModelSignal<T | undefined>;
        <T>(initialValue: T, opts?: ModelOptions): ModelSignal<T>;
        required: {
            <T>(opts?: ModelOptions): ModelSignal<T>;
        };
    }
    export const model: ModelFunction;

    export interface AbstractType<T> extends Function {
        prototype: T;
    }
    export const Type: FunctionConstructor;
    export interface Type<T> extends Function {
        new (...args: any[]): T;
    }
    export class InjectionToken<T> {
        protected _desc: string;
        constructor(_desc: string, options: {
            providedIn: Type<any> | 'any';
            factory: () => T;
        });
        constructor(_desc: string, options?: {
            providedIn?: Type<any> | 'root' | 'platform' | 'any' | null;
            factory: () => T;
        });
        toString(): string;
    }
    export class HostAttributeToken {
        private attributeName;
        constructor(attributeName: string);
        toString(): string;
    }
    export interface InjectOptions {
        optional?: boolean;
        skipSelf?: boolean;
        self?: boolean;
        host?: boolean;
    }
    export type ProviderToken<T> = Type<T> | AbstractType<T> | InjectionToken<T>;
    export function inject<T>(token: ProviderToken<T>): T;
    export function inject<T>(token: ProviderToken<T>, options: InjectOptions & {
        optional?: false;
    }): T;
    export function inject<T>(token: ProviderToken<T>, options: InjectOptions): T | null;
    export function inject(token: HostAttributeToken): string;
    export function inject(token: HostAttributeToken, options: {
        optional: true;
    }): string | null;
    export function inject(token: HostAttributeToken, options: {
        optional: false;
    }): string;
}
`;

const parsed = new Map<string, ts.SourceFile>();
let libTexts: ReadonlyMap<string, string> | undefined;

/** The lib files ts-morph ships for its TypeScript version, by file name. */
const libFiles = (): ReadonlyMap<string, string> => {
    if (!libTexts) {
        const require = createRequire(createRequire(import.meta.url).resolve('ts-morph'));
        const common: { getLibFiles(): { fileName: string; text: string }[] } =
            require('@ts-morph/common');
        libTexts = new Map(common.getLibFiles().map(file => [file.fileName, file.text]));
    }
    return libTexts;
};

const textOf = (baseName: string): string | undefined =>
    baseName === path.posix.basename(ANGULAR_SIGNALS_FILE)
        ? ANGULAR_SIGNALS
        : libFiles().get(baseName);

/**
 * A file of the virtual folder, parsed once per process; undefined for any
 * other path. The files never change, so every program shares them.
 */
export const checkerLibFile = (fileName: string): ts.SourceFile | undefined => {
    // a drive letter may be prefixed on Windows
    const normalized = fileName.replaceAll('\\', '/');
    if (!path.posix.dirname(normalized).endsWith(CHECKER_LIB_FOLDER)) {
        return undefined;
    }
    const baseName = path.posix.basename(normalized);
    const cached = parsed.get(baseName);
    if (cached) {
        return cached;
    }
    const text = textOf(baseName);
    if (text === undefined) {
        return undefined;
    }
    const sourceFile = ts.createSourceFile(
        `${CHECKER_LIB_FOLDER}/${baseName}`,
        text,
        ts.ScriptTarget.Latest,
        false
    );
    parsed.set(baseName, sourceFile);
    return sourceFile;
};
