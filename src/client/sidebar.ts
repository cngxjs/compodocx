/**
 * Sidebar collapse/expand behavior.
 * Single sidebar DOM serves both desktop and mobile.
 * Default: all sections collapsed when no saved state exists.
 */

const STORAGE_KEY = 'compodocx-sidebar-state';
const LEGACY_STORAGE_KEY = 'compodoc-sidebar-state';
const ANIMATION_MS = 200;

/** Read from new key, fall back to legacy, migrate if found. */
const migrateStorageKey = (): string | null => {
    try {
        const value = localStorage.getItem(STORAGE_KEY);
        if (value) {
            return value;
        }
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy) {
            localStorage.setItem(STORAGE_KEY, legacy);
            localStorage.removeItem(LEGACY_STORAGE_KEY);
            return legacy;
        }
    } catch {
        /* localStorage blocked */
    }
    return null;
};

const saveState = () => {
    try {
        const collapses = document.querySelectorAll<HTMLElement>('.menu .collapse[id]');
        const states: Record<string, boolean> = {};
        collapses.forEach(el => {
            states[el.id] = el.classList.contains('in');
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
    } catch {
        /* localStorage blocked */
    }
};

/** Apply saved state to all collapses. Without saved state, respect server-rendered state. */
const restoreState = () => {
    try {
        const saved = migrateStorageKey();
        const states: Record<string, boolean> = saved ? JSON.parse(saved) : {};

        document.querySelectorAll<HTMLElement>('.menu .collapse[id]').forEach(el => {
            // Use saved state if available, otherwise keep server-rendered state
            // (server renders expanded/collapsed based on groupDepth)
            const serverOpen = el.classList.contains('in');
            const open = states[el.id] ?? serverOpen;
            if (open) {
                el.classList.add('in');
                el.style.display = 'block';
            } else {
                el.classList.remove('in');
                el.style.display = 'none';
            }
        });
    } catch {
        /* localStorage blocked or invalid JSON */
    }
};

const toggleCollapse = (targetId: string) => {
    // Use getElementById to handle IDs with special chars (e.g. slashes from folder paths)
    const id = targetId.startsWith('#') ? targetId.slice(1) : targetId;
    const target = document.getElementById(id) as HTMLElement | null;
    if (!target) {
        return;
    }

    const isOpen = target.classList.contains('in');
    if (isOpen) {
        target.style.overflow = 'hidden';
        target.style.maxHeight = `${target.scrollHeight}px`;
        requestAnimationFrame(() => {
            target.style.maxHeight = '0';
            target.style.transition = `max-height ${ANIMATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`;
        });
        setTimeout(() => {
            target.classList.remove('in');
            target.style.display = 'none';
            target.style.maxHeight = '';
            target.style.overflow = '';
            target.style.transition = '';
        }, ANIMATION_MS);
    } else {
        target.style.display = 'block';
        target.classList.add('in');
        target.style.overflow = 'hidden';
        target.style.maxHeight = '0';
        requestAnimationFrame(() => {
            target.style.maxHeight = `${target.scrollHeight}px`;
            target.style.transition = `max-height ${ANIMATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`;
        });
        setTimeout(() => {
            target.style.maxHeight = '';
            target.style.overflow = '';
            target.style.transition = '';
        }, ANIMATION_MS);
    }

    // Toggle chevron rotation + aria-expanded
    const toggler = document.querySelector(`[data-cdx-target="${targetId}"]`);
    if (toggler) {
        const chevron = toggler.querySelector('.cdx-chevron');
        if (chevron) {
            chevron.classList.toggle('cdx-chevron--open');
        }
        const wasOpen = toggler.getAttribute('aria-expanded') === 'true';
        toggler.setAttribute('aria-expanded', String(!wasOpen));
    }

    setTimeout(saveState, ANIMATION_MS + 50);
};

const bindTogglers = () => {
    document.querySelectorAll<HTMLElement>('[data-cdx-toggle="collapse"]').forEach(toggler => {
        toggler.addEventListener('click', e => {
            const target = toggler.getAttribute('data-cdx-target');
            if (!target) {
                return;
            }

            const clickedEl = e.target as HTMLElement;

            // Feature-bucket two-hit-zone: the row IS the toggler, but
            // it also wraps a real `<a data-cdx-bucket-link>`. When the
            // click originates inside the anchor, let the browser run
            // its native navigation (incl. Cmd/middle-click new-tab)
            // — we deliberately avoid `event.stopPropagation()` on the
            // anchor itself so modifier-key flows stay intact.
            if (clickedEl.closest('[data-cdx-bucket-link]')) {
                return;
            }

            const link = toggler.closest('a');

            if (toggler.classList.contains('simple')) {
                e.preventDefault();
                e.stopPropagation();
                toggleCollapse(target);
            } else if (link && toggler.classList.contains('linked')) {
                if (clickedEl.classList.contains('link-name')) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                toggleCollapse(target);
            } else {
                e.preventDefault();
                toggleCollapse(target);
            }
        });

        // Keyboard support for bucket rows: the row carries
        // `role="button"` + `tabindex="0"`, so Enter/Space must toggle
        // the same as a click — unless focus is on the inner anchor,
        // where the browser's native Enter handles navigation.
        if (toggler.matches('[data-cdx-bucket-row]')) {
            toggler.addEventListener('keydown', e => {
                if (e.key !== 'Enter' && e.key !== ' ') {
                    return;
                }
                if (document.activeElement?.matches('[data-cdx-bucket-link]')) {
                    return;
                }
                const target = toggler.getAttribute('data-cdx-target');
                if (!target) {
                    return;
                }
                e.preventDefault();
                toggleCollapse(target);
            });
        }
    });
};

/** Sync chevron rotation and aria-expanded with actual collapse state */
const syncChevrons = () => {
    document.querySelectorAll<HTMLElement>('.menu .collapse[id]').forEach(el => {
        const isOpen = el.classList.contains('in');
        const toggler = document.querySelector(`[data-cdx-target="#${el.id}"]`);
        if (!toggler) {
            return;
        }
        const chevron = toggler.querySelector('.cdx-chevron');
        if (chevron) {
            chevron.classList.toggle('cdx-chevron--open', isOpen);
        }
        toggler.setAttribute('aria-expanded', String(isOpen));
    });
};

/* ----------------------------------------------------------------
   Mobile sidebar slide-over
   ---------------------------------------------------------------- */

let sidebarEl: HTMLElement | null = null;
let backdropEl: HTMLElement | null = null;
let toggleBtn: HTMLElement | null = null;

const isMobileSidebarOpen = (): boolean =>
    sidebarEl?.classList.contains('cdx-sidebar--open') ?? false;

const openMobileSidebar = () => {
    if (!sidebarEl || !backdropEl) {
        return;
    }
    sidebarEl.classList.add('cdx-sidebar--open');
    backdropEl.style.display = 'block';
    requestAnimationFrame(() => backdropEl!.classList.add('cdx-backdrop--visible'));
    document.body.style.overflow = 'hidden';
    toggleBtn?.setAttribute('aria-expanded', 'true');

    // Focus the first focusable element in sidebar
    const firstFocusable = sidebarEl.querySelector<HTMLElement>('a, button, input');
    firstFocusable?.focus();
};

const closeMobileSidebar = () => {
    if (!sidebarEl || !backdropEl) {
        return;
    }
    sidebarEl.classList.remove('cdx-sidebar--open');
    backdropEl.classList.remove('cdx-backdrop--visible');
    document.body.style.overflow = '';
    toggleBtn?.setAttribute('aria-expanded', 'false');

    setTimeout(() => {
        if (!isMobileSidebarOpen()) {
            backdropEl!.style.display = 'none';
        }
    }, ANIMATION_MS);

    // Return focus to hamburger
    toggleBtn?.focus();
};

const bindMobileMenu = () => {
    sidebarEl = document.getElementById('sidebar');
    backdropEl = document.querySelector('.cdx-backdrop');

    document.querySelectorAll<HTMLElement>('[data-cdx-mobile-toggle]').forEach(btn => {
        toggleBtn = btn;
        btn.addEventListener('click', () => {
            if (isMobileSidebarOpen()) {
                closeMobileSidebar();
            } else {
                openMobileSidebar();
            }
        });
    });

    // Close button
    sidebarEl?.querySelector('.cdx-sidebar-close')?.addEventListener('click', closeMobileSidebar);

    // Backdrop click closes sidebar
    backdropEl?.addEventListener('click', closeMobileSidebar);

    // Escape key closes sidebar
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && isMobileSidebarOpen()) {
            closeMobileSidebar();
        }
    });

    // Close sidebar links (navigate)
    sidebarEl?.querySelectorAll('a[data-type]').forEach(link => {
        link.addEventListener('click', () => {
            if (isMobileSidebarOpen()) {
                closeMobileSidebar();
            }
        });
    });

    // Focus trap: cycle Tab within sidebar when mobile overlay is open
    sidebarEl?.addEventListener('keydown', e => {
        if (e.key !== 'Tab' || !isMobileSidebarOpen()) {
            return;
        }
        const focusable = sidebarEl!.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable.length) {
            return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    });

    // Close mobile sidebar on resize to desktop
    const mq = window.matchMedia('(min-width: 1024px)');
    mq.addEventListener('change', e => {
        if (e.matches && isMobileSidebarOpen()) {
            closeMobileSidebar();
        }
    });
};

/** Clear all contains-active indicators */
const clearContainsActive = () => {
    document.querySelectorAll('.cdx-contains-active').forEach(el => {
        el.classList.remove('cdx-contains-active');
    });
};

/**
 * Force-open all ancestor .collapse elements of the active link,
 * mark collapsed ancestors with contains-active indicator,
 * and scroll the active link into view.
 */
export const expandToActive = () => {
    clearContainsActive();

    const active = document.querySelector<HTMLElement>(
        '.menu a.active[data-type="entity-link"], .menu a.active[data-type="chapter-link"]'
    );
    if (!active) {
        return;
    }

    // Walk up the DOM, force-open every .collapse ancestor
    let parent = active.closest('.collapse') as HTMLElement | null;
    while (parent) {
        if (!parent.classList.contains('in')) {
            parent.classList.add('in');
            parent.style.display = 'block';
        }
        // Sync the toggler chevron for this collapse
        const toggler = document.querySelector(`[data-cdx-target="#${parent.id}"]`);
        if (toggler) {
            const chevron = toggler.querySelector('.cdx-chevron');
            if (chevron) {
                chevron.classList.toggle('cdx-chevron--open', true);
            }
            toggler.setAttribute('aria-expanded', 'true');
        }
        parent = parent.parentElement?.closest('.collapse') as HTMLElement | null;
    }

    // Mark collapsed ancestors that contain the active entity
    // (for groups that remain collapsed after state restore).
    // Feature-bucket rows live under `.cdx-bucket-row` instead of
    // `.menu-toggler`, so the selector matches either.
    let ancestor = active.closest('.chapter.inner') as HTMLElement | null;
    while (ancestor) {
        const collapse = ancestor.querySelector(':scope > ul.links.collapse');
        if (collapse && !collapse.classList.contains('in')) {
            const toggler = ancestor.querySelector(
                ':scope > .menu-toggler, :scope > .cdx-bucket-row'
            );
            if (toggler) {
                toggler.classList.add('cdx-contains-active');
            }
        }
        ancestor = ancestor.parentElement?.closest('.chapter.inner') as HTMLElement | null;
    }

    // Scroll active link into view without jarring jump
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    active.scrollIntoView({
        block: 'nearest',
        behavior: prefersReducedMotion ? 'instant' : 'smooth'
    });

    saveState();
};

export const initSidebar = () => {
    bindTogglers();
    restoreState();
    syncChevrons();
    expandToActive();
    bindMobileMenu();
};
