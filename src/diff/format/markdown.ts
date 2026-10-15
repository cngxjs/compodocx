/**
 * Markdown formatter for `compodocx diff --md` - output suitable for
 * pasting into a CHANGELOG entry or PR description.
 *
 * Layout:
 *
 *   ## API changes - <fromVersion> → <toVersion>
 *
 *   ### Breaking changes (<n>)
 *   - **`Foo`** removed
 *
 *   ### Additive (<n>)
 *   - **`Bar`** added
 *
 *   ### Documentation (<n>)
 *   - `Baz` description updated
 *
 * Empty severity sections are omitted so a docs-only diff doesn't render
 * three empty `<n>=0` headings. Markdown renderers treat the output as a
 * regular section - no front-matter, no HTML.
 */

import type { DiffResult, EntityChange, Severity } from '../types';

const isAdded = (change: EntityChange): boolean => change.kind.endsWith('-added');
const isRemoved = (change: EntityChange): boolean => change.kind.endsWith('-removed');

const lineFor = (change: EntityChange): string => {
    if (isRemoved(change)) {
        return `- **\`${change.name}\`** removed`;
    }
    if (isAdded(change)) {
        return `- **\`${change.name}\`** added`;
    }
    const sample = change.changes[0];
    if (!sample) {
        return `- **\`${change.name}\`** changed`;
    }
    if (sample.field === 'description') {
        return `- \`${change.name}\` description updated`;
    }
    if (sample.kind === 'member-added') {
        return `- **\`${change.name}\`** added member \`${sample.field.split('.').pop()}\``;
    }
    if (sample.kind === 'member-removed') {
        return `- **\`${change.name}\`** removed member \`${sample.field.split('.').pop()}\``;
    }
    return `- **\`${change.name}\`** changed (\`${sample.field}\`)`;
};

const sectionFor = (
    title: string,
    severity: Severity,
    changes: ReadonlyArray<EntityChange>
): string | null => {
    const filtered = changes.filter(c => c.severity === severity);
    if (filtered.length === 0) {
        return null;
    }
    const lines = filtered.map(lineFor).join('\n');
    return `### ${title} (${filtered.length})\n\n${lines}\n`;
};

export const renderMarkdown = (result: DiffResult): string => {
    const fromVersion = result.from.compodocxVersion || 'previous';
    const toVersion = result.to.compodocxVersion || 'current';
    const sections = [
        sectionFor('Breaking changes', 'breaking', result.changes),
        sectionFor('Additive', 'additive', result.changes),
        sectionFor('Documentation', 'docs-only', result.changes)
    ].filter((s): s is string => s !== null);
    const heading = `## API changes — ${fromVersion} → ${toVersion}`;
    if (sections.length === 0) {
        return `${heading}\n\nNo changes detected.\n`;
    }
    return `${heading}\n\n${sections.join('\n')}`;
};
