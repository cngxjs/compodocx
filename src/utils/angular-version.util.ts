import { logger } from './logger';

export class AngularVersionUtil {
    private static readonly CorePackage = '@angular/core';

    private static instance: AngularVersionUtil;
    private constructor() {}
    public static getInstance() {
        if (!AngularVersionUtil.instance) {
            AngularVersionUtil.instance = new AngularVersionUtil();
        }
        return AngularVersionUtil.instance;
    }

    public cleanVersion(version: string): string {
        return version
            .replace('~', '')
            .replace('^', '')
            .replace('=', '')
            .replace('<', '')
            .replace('>', '');
    }

    public getAngularVersionOfProject(packageData): string {
        let _result = '';

        if (packageData.dependencies) {
            const angularCore = packageData.dependencies[AngularVersionUtil.CorePackage];
            if (angularCore) {
                _result = this.cleanVersion(angularCore);
            }
        }
        logger.debug('Angular version from dependencies', _result);
        return _result;
    }

    /**
     * Major version of `@angular/core` the project declares, from
     * `dependencies`, then `peerDependencies`, then `devDependencies`
     * (libraries usually declare Angular as a peer). The lowest major a range
     * names; undefined without one or for a range without a number.
     */
    public getAngularMajorOfProject(packageData): number | undefined {
        for (const field of ['dependencies', 'peerDependencies', 'devDependencies']) {
            const range = packageData?.[field]?.[AngularVersionUtil.CorePackage];
            if (typeof range === 'string') {
                const major = /(\d+)/.exec(range)?.[1];
                return major ? Number(major) : undefined;
            }
        }
        return undefined;
    }
}

export default AngularVersionUtil.getInstance();
