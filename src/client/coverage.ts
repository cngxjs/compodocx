/**
 * Coverage page — sort + filter (client-side).
 * Also handles generic table sorting for UnitTestReport.
 */

let filterTimeout: ReturnType<typeof setTimeout> | null = null;

/* ---- Table sorting ---- */

const sortTable = (th: HTMLTableCellElement) => {
    const table = th.closest('table');
    if (!table) return;

    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    if (!thead || !tbody) return;

    const colIndex = Array.from(th.parentElement!.children).indexOf(th);
    const sortKey = th.getAttribute('data-cdx-sort') ?? th.getAttribute('data-sort') ?? '';
    const currentSort = th.getAttribute('aria-sort');
    const ascending = currentSort !== 'ascending';

    // Reset all headers in this table
    thead.querySelectorAll('th[aria-sort]').forEach(h => {
        h.setAttribute('aria-sort', 'none');
        const arrow = h.querySelector('.cdx-coverage-sort-arrow');
        if (arrow) arrow.textContent = '';
    });
    th.setAttribute('aria-sort', ascending ? 'ascending' : 'descending');
    const arrow = th.querySelector('.cdx-coverage-sort-arrow');
    if (arrow) arrow.textContent = ascending ? '\u25B2' : '\u25BC';

    const rows = Array.from(tbody.querySelectorAll('tr'));
    rows.sort((a, b) => {
        let av: string | number;
        let bv: string | number;

        if (sortKey === 'coverage') {
            av = Number(a.getAttribute('data-cdx-coverage-pct') ?? a.cells[colIndex]?.getAttribute('data-sort') ?? '0');
            bv = Number(b.getAttribute('data-cdx-coverage-pct') ?? b.cells[colIndex]?.getAttribute('data-sort') ?? '0');
        } else if (sortKey === 'file') {
            av = a.getAttribute('data-cdx-coverage-file') ?? a.cells[colIndex]?.textContent?.trim().toLowerCase() ?? '';
            bv = b.getAttribute('data-cdx-coverage-file') ?? b.cells[colIndex]?.textContent?.trim().toLowerCase() ?? '';
        } else if (sortKey === 'name') {
            av = a.getAttribute('data-cdx-coverage-name') ?? a.cells[colIndex]?.textContent?.trim().toLowerCase() ?? '';
            bv = b.getAttribute('data-cdx-coverage-name') ?? b.cells[colIndex]?.textContent?.trim().toLowerCase() ?? '';
        } else {
            // Generic: try data-sort attribute on the cell, fall back to text
            const cellA = a.cells[colIndex];
            const cellB = b.cells[colIndex];
            const rawA = cellA?.getAttribute('data-sort') ?? cellA?.textContent?.trim() ?? '';
            const rawB = cellB?.getAttribute('data-sort') ?? cellB?.textContent?.trim() ?? '';
            const numA = Number(rawA);
            const numB = Number(rawB);
            if (!isNaN(numA) && !isNaN(numB)) {
                av = numA;
                bv = numB;
            } else {
                av = rawA.toLowerCase();
                bv = rawB.toLowerCase();
            }
        }

        if (av < bv) return ascending ? -1 : 1;
        if (av > bv) return ascending ? 1 : -1;
        return 0;
    });

    for (const row of rows) {
        tbody.appendChild(row);
    }
};

/* ---- Filter (coverage page only) ---- */

const applyFilter = (query: string) => {
    const groups = document.querySelectorAll<HTMLDetailsElement>('[data-cdx-coverage-group]');
    const noResults = document.querySelector<HTMLElement>('[data-cdx-coverage-no-results]');
    const clearBtn = document.querySelector<HTMLElement>('[data-cdx-coverage-filter-clear]');
    const q = query.toLowerCase().trim();
    let anyVisible = false;

    if (clearBtn) {
        clearBtn.classList.toggle('cdx-coverage-filter-clear--visible', q.length > 0);
    }

    groups.forEach(group => {
        const rows = group.querySelectorAll<HTMLTableRowElement>('tbody tr');
        let groupHasVisible = false;

        rows.forEach(row => {
            const name = row.getAttribute('data-cdx-coverage-name') ?? '';
            const file = row.getAttribute('data-cdx-coverage-file') ?? '';
            const matches = q === '' || name.includes(q) || file.includes(q);
            row.classList.toggle('cdx-coverage-row--hidden', !matches);
            if (matches) groupHasVisible = true;
        });

        group.classList.toggle('cdx-coverage-group--hidden', !groupHasVisible);
        // Auto-open groups with matches when filtering, restore state when cleared
        if (q.length > 0 && groupHasVisible) {
            group.setAttribute('open', '');
        }
        if (groupHasVisible) anyVisible = true;
    });

    if (noResults) {
        noResults.classList.toggle('cdx-coverage-no-results--visible', !anyVisible && q.length > 0);
    }
};

/* ---- Init ---- */

export const initCoverage = () => {
    // Sort: coverage page tables
    document.querySelectorAll<HTMLTableCellElement>('th[data-cdx-sort]').forEach(th => {
        th.addEventListener('click', () => sortTable(th));
    });

    // Sort: generic tables with data-sort headers (UnitTestReport)
    document.querySelectorAll<HTMLTableCellElement>('#coverage-table th[data-sort-default]').forEach(th => {
        th.style.cursor = 'pointer';
        th.setAttribute('aria-sort', 'none');
        th.setAttribute('data-sort', '');
        th.addEventListener('click', () => sortTable(th));
    });

    // Filter
    const filterInput = document.querySelector<HTMLInputElement>('[data-cdx-coverage-filter]');
    if (filterInput) {
        filterInput.addEventListener('input', () => {
            if (filterTimeout) clearTimeout(filterTimeout);
            filterTimeout = setTimeout(() => applyFilter(filterInput.value), 150);
        });

        filterInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                filterInput.value = '';
                applyFilter('');
            }
        });
    }

    // Clear button
    const clearBtn = document.querySelector<HTMLElement>('[data-cdx-coverage-filter-clear]');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (filterInput) {
                filterInput.value = '';
                applyFilter('');
                filterInput.focus();
            }
        });
    }

    // --- Utilities filter ---
    initMiscFilter();
};

/* ---- Utilities filter ---- */

let miscFilterTimeout: ReturnType<typeof setTimeout> | null = null;

const applyMiscFilter = (query: string) => {
    const entries = document.querySelectorAll<HTMLElement>('[data-cdx-misc-name]');
    const noResults = document.querySelector<HTMLElement>('[data-cdx-misc-no-results]');
    const clearBtn = document.querySelector<HTMLElement>('[data-cdx-misc-filter-clear]');
    const q = query.toLowerCase().trim();
    let anyVisible = false;

    if (clearBtn) {
        clearBtn.classList.toggle('cdx-coverage-filter-clear--visible', q.length > 0);
    }

    entries.forEach(entry => {
        const name = entry.getAttribute('data-cdx-misc-name') ?? '';
        const matches = q === '' || name.includes(q);
        entry.style.display = matches ? '' : 'none';
        if (matches) anyVisible = true;
    });

    if (noResults) {
        noResults.classList.toggle('cdx-coverage-no-results--visible', !anyVisible && q.length > 0);
    }
};

const initMiscFilter = () => {
    const filterInput = document.querySelector<HTMLInputElement>('[data-cdx-misc-filter]');
    if (!filterInput) return;

    filterInput.addEventListener('input', () => {
        if (miscFilterTimeout) clearTimeout(miscFilterTimeout);
        miscFilterTimeout = setTimeout(() => applyMiscFilter(filterInput.value), 150);
    });

    filterInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            filterInput.value = '';
            applyMiscFilter('');
        }
    });

    const clearBtn = document.querySelector<HTMLElement>('[data-cdx-misc-filter-clear]');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            filterInput.value = '';
            applyMiscFilter('');
            filterInput.focus();
        });
    }
};
