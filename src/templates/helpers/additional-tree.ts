/** A page below a top-level additional entry, as the menu data carry it. */
export interface AdditionalTreePage {
    readonly depth: number;
}

/** A page with the pages nested below it. */
export interface AdditionalTreeNode<T extends AdditionalTreePage> {
    readonly page: T;
    readonly children: AdditionalTreeNode<T>[];
}

/**
 * Rebuilds the nesting of the pages below a top-level additional entry. The
 * menu data list them flat in sidebar order with their `depth`; a page goes
 * below the nearest page before it with a smaller depth, else to the top.
 */
export const additionalTree = <T extends AdditionalTreePage>(
    pages: readonly T[]
): AdditionalTreeNode<T>[] => {
    const roots: AdditionalTreeNode<T>[] = [];
    const open: AdditionalTreeNode<T>[] = [];
    for (const page of pages) {
        const node: AdditionalTreeNode<T> = { page, children: [] };
        while (open.length > 0 && open[open.length - 1].page.depth >= page.depth) {
            open.pop();
        }
        const parent = open[open.length - 1];
        (parent ? parent.children : roots).push(node);
        open.push(node);
    }
    return roots;
};
