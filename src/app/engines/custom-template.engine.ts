import * as path from 'node:path';
import { REMOVED_OVERRIDES, RENAMED_OVERRIDES } from '../../migrate/override-names';
import * as helpers from '../../templates/helpers';
import { logger } from '../../utils/logger';
import FileEngine from './file.engine';

export type CustomTemplateFn = (data: any, helpers: typeof templateHelpers) => string;

/** All template helpers exposed to custom JS templates. */
const templateHelpers = {
    ...helpers
};

/** Loaded custom templates: name -> render function */
const customTemplates: Record<string, CustomTemplateFn> = {};

/**
 * Load custom JS templates from a directory.
 * Scans `templatePath/partials/` for `.js` files that export a render function.
 * Each file should: `module.exports = function(data, helpers) { return '...'; }`
 */
export function loadCustomTemplates(templatePath: string): void {
    if (!templatePath) {
        return;
    }

    const resolvedPath = path.isAbsolute(templatePath)
        ? templatePath
        : path.resolve(process.cwd() + path.sep + templatePath);

    if (!FileEngine.existsSync(resolvedPath)) {
        logger.warn(`Template path specified but does not exist: ${resolvedPath}`);
        return;
    }

    const partialsDir = path.resolve(`${resolvedPath + path.sep}partials`);
    if (!FileEngine.existsSync(partialsDir)) {
        return;
    }

    // Scan for .js files
    const fs = require('node:fs');
    const files: string[] = fs.readdirSync(partialsDir);

    for (const file of files) {
        if (!file.endsWith('.js')) {
            continue;
        }
        const name = file.replace('.js', '');
        const fullPath = path.resolve(partialsDir + path.sep + file);
        const replacement = RENAMED_OVERRIDES[name];
        if (REMOVED_OVERRIDES.includes(name) || replacement !== undefined) {
            const hint = replacement
                ? `renamed to "${replacement}", rename the file`
                : 'its page no longer exists';
            logger.warn(`Custom template ${file} is ignored (${hint}); see \`compodocx migrate\``);
            continue;
        }

        try {
            const mod = require(fullPath);
            const fn = typeof mod === 'function' ? mod : mod.default;
            if (typeof fn === 'function') {
                customTemplates[name] = fn;
                logger.info(`Loaded custom template: ${name}`);
            } else {
                logger.warn(`Custom template ${file} does not export a function`);
            }
        } catch (err) {
            logger.error(`Failed to load custom template ${file}: ${err}`);
        }
    }
}

/**
 * Get a custom template override by name (e.g. 'component', 'block-constructor').
 * Returns null if no custom template is loaded for that name.
 */
export function getCustomTemplate(name: string): CustomTemplateFn | null {
    return customTemplates[name] ?? null;
}

/**
 * Render a custom template if one exists for the given name.
 * Returns the rendered string, or null if no custom template.
 */
export function renderCustomTemplate(name: string, data: any): string | null {
    const fn = customTemplates[name];
    if (!fn) {
        return null;
    }
    return fn(data, templateHelpers);
}

/** Check if any custom templates are loaded. */
export function hasCustomTemplates(): boolean {
    return Object.keys(customTemplates).length > 0;
}

/** Register an in-memory template (used in tests and programmatic setups). */
export function registerCustomTemplate(name: string, fn: CustomTemplateFn): void {
    customTemplates[name] = fn;
}

/** Reset loaded templates (for testing). */
export function clearCustomTemplates(): void {
    for (const key of Object.keys(customTemplates)) {
        delete customTemplates[key];
    }
}
