import { ts } from 'ts-morph';
import { compilerHost } from '../../utils';
import { ClassHelper } from './angular/deps/helpers/class-helper';
import { ComponentHelper } from './angular/deps/helpers/component-helper';
import { ANGULAR_SIGNALS_FILE } from './checker-libs';

/**
 * Options of the semantic program the crawler takes over to resolve imports
 * the way the project does. `module` comes along with `moduleResolution`
 * (`bundler` needs an ES module kind).
 */
const RESOLUTION_OPTIONS = [
    'baseUrl',
    'paths',
    'pathsBasePath',
    'rootDirs',
    'moduleResolution',
    'module',
    'moduleSuffixes'
] as const;

/** The defined resolution options of `options`. */
const resolutionOptionsOf = (options: ts.CompilerOptions | undefined): ts.CompilerOptions =>
    Object.fromEntries(
        RESOLUTION_OPTIONS.filter(key => options?.[key] !== undefined).map(key => [
            key,
            options[key]
        ])
    );

export class FrameworkDependencies {
    public files: string[];
    public program: ts.Program;
    public typeChecker: ts.TypeChecker;
    public classHelper: ClassHelper;
    public componentHelper: ComponentHelper;

    constructor(files: string[], options: any) {
        this.files = files;

        const transpileOptions = {
            target: ts.ScriptTarget.ES5,
            module: ts.ModuleKind.CommonJS,
            tsconfigDirectory: options.tsconfigDirectory,
            allowJs: true,
            ...resolutionOptionsOf(options.resolution)
        };
        this.program = ts.createProgram(
            [...this.files, ANGULAR_SIGNALS_FILE],
            transpileOptions,
            compilerHost(
                transpileOptions,
                options.sharedSourceFile,
                options.resolution !== undefined
            )
        );
        this.typeChecker = this.program.getTypeChecker();
        this.classHelper = new ClassHelper(this.typeChecker);
        this.componentHelper = new ComponentHelper(this.classHelper);
    }
}
