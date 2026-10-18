import * as path from 'node:path';
import * as helpers from '../../templates/helpers';
import { logger } from '../../utils/logger';
import FileEngine from './file.engine';
import { REMOVED_OVERRIDES, RENAMED_OVERRIDES } from './override-names';

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

    const handlebarsCount = files.filter(file => file.endsWith('.hbs')).length;
    if (handlebarsCount > 0) {
        logger.warn(
            `Found ${handlebarsCount} .hbs file(s) in ${partialsDir}: Handlebars templates are no longer supported and must be rewritten as .js overrides; see docs/custom-templates.md and the cookbook in MIGRATION.md`
        );
    }

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
            logger.warn(`Custom template ${file} is ignored (${hint}); see MIGRATION.md`);
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
