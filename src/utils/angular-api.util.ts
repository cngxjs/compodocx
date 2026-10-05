import { createRequire } from 'node:module';
import * as path from 'node:path';

import type { IApiSourceResult } from './api-source-result.interface';

const require = createRequire(import.meta.url);

// Try multiple paths to find api-list.json - supports both source and bundled contexts
let apiListPath = '../src/data/api-list.json';
try {
    // First try relative path (works from source)
    require.resolve(apiListPath);
} catch (_e) {
    // Fallback to absolute path from cwd (works from bundled/test contexts)
    apiListPath = path.join(process.cwd(), 'src/data/api-list.json');
}

const AngularAPIs: Array<IAngularMainApi> = require(apiListPath);

export class AngularApiUtil {
    private static instance: AngularApiUtil;
    private constructor() {}
    public static getInstance() {
        if (!AngularApiUtil.instance) {
            AngularApiUtil.instance = new AngularApiUtil();
        }
        return AngularApiUtil.instance;
    }

    public findApi(type: string): IApiSourceResult<IAngularApi> {
        let foundedApi;
        AngularAPIs.forEach(mainApi => {
            mainApi.items.forEach(api => {
                if (api.title === type) {
                    foundedApi = api;
                }
            });
        });
        return {
            source: 'external',
            data: foundedApi,
            score: foundedApi ? 1 : 0
        };
    }
}

export default AngularApiUtil.getInstance();

export interface IAngularMainApi {
    title: string;
    name: string;
    items: IAngularApi[];
}

export interface IAngularApi {
    title: string;
    path: string;
    docType: string;
    stability: string;
    securityRisk: boolean;
}
