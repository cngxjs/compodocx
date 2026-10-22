import type { ExportAdditionalPage } from '../interfaces/export-data.interface';
import type { PageInterface } from '../interfaces/page.interface';

const forwardSlashes = (value: string): string => value.replaceAll('\\', '/');

const exportPage = (page: PageInterface): ExportAdditionalPage[] => {
    const source = page.additionalPageSource;
    if (!source) {
        return [];
    }
    const children = exportAdditionalPages(page.children);
    return [
        {
            slug: forwardSlashes(source.slug),
            title: page.displayName ?? page.name,
            ...(page.displayName !== undefined && page.displayName !== page.name
                ? { label: page.name }
                : {}),
            file: forwardSlashes(source.file),
            markdown: source.markdown,
            ...(page.aiGenerated ? { aiGenerated: true as const } : {}),
            ...(children.length > 0 ? { children } : {})
        }
    ];
};

/**
 * The export shape of the additional pages (`mainData.additionalPages`), in
 * sidebar order; pages without a source are left out. The page objects are
 * read, never changed.
 */
export const exportAdditionalPages = (
    pages: readonly PageInterface[] | undefined
): ExportAdditionalPage[] => (pages ?? []).flatMap(exportPage);
