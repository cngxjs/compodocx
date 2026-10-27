import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import type { MainDataInterface } from '../interfaces/main-data.interface';
import { type LogoLayout, logoAspect, logoLayoutFor } from '../page-generator/brand-images';

/**
 * The layout of the custom logo, read once per run: `logoLayout` as set, or
 * for `auto` from the file's aspect ratio. A file that cannot be read keeps
 * the logo-only layout (the copy step reports the missing file).
 */
export const resolveLogoLayout = async (mainData: MainDataInterface): Promise<LogoLayout> => {
    if (mainData.logoLayout !== 'auto') {
        return mainData.logoLayout;
    }
    const bytes = await readFile(path.resolve(process.cwd(), mainData.customLogo)).catch(
        () => undefined
    );
    return logoLayoutFor('auto', bytes ? logoAspect(bytes, mainData.customLogo) : undefined);
};
