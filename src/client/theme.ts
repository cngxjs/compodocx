/**
 * Dark mode toggle + theme switcher.
 * The inline script in <head> sets .dark on <html> before paint to prevent flash.
 * A second inline script after the theme <link> restores the saved theme CSS.
 * This module binds the icon toggles and theme picker dropdown.
 */

const DARK_STORAGE_KEY = 'compodocx_darkmode-state';
const THEME_STORAGE_KEY = 'compodocx-theme';

const readKey = (key: string): string | null => {
    try {
        return localStorage.getItem(key);
    } catch {
        /* localStorage blocked */
    }
    return null;
};

const getSystemPreference = (): boolean =>
    window.matchMedia('(prefers-color-scheme: dark)').matches;

const applyDarkMode = (dark: boolean) => {
    document.documentElement.classList.toggle('dark', dark);
    document.body.classList.toggle('dark', dark);
    // Sync all dark toggle buttons (sidebar + topbar)
    document.querySelectorAll<HTMLElement>('.cdx-dark-toggle').forEach(btn => {
        btn.setAttribute('aria-pressed', String(dark));
    });
    try {
        localStorage.setItem(DARK_STORAGE_KEY, String(dark));
    } catch {
        /* localStorage blocked */
    }
};

/* ----------------------------------------------------------------
   Theme switcher
   ---------------------------------------------------------------- */

const applyTheme = (themeId: string) => {
    const link = document.getElementById('cdx-theme-link') as HTMLLinkElement | null;
    if (!link) {
        return;
    }
    const base = link.getAttribute('data-base') ?? '';
    link.href = themeId === 'default' ? '' : `${base}styles/${themeId}.css`;

    // Update picker selection
    document.querySelectorAll<HTMLElement>('[data-cdx-theme]').forEach(opt => {
        opt.setAttribute(
            'aria-selected',
            opt.getAttribute('data-cdx-theme') === themeId ? 'true' : 'false'
        );
    });

    try {
        localStorage.setItem(THEME_STORAGE_KEY, themeId);
    } catch {
        /* localStorage blocked */
    }
};

const bindThemePicker = () => {
    document.querySelectorAll<HTMLElement>('[data-cdx-theme-picker]').forEach(picker => {
        const btn = picker.querySelector<HTMLElement>('button');
        const menu = picker.querySelector<HTMLElement>('.cdx-theme-picker-menu');
        if (!btn || !menu) {
            return;
        }

        const open = () => {
            menu.hidden = false;
            btn.setAttribute('aria-expanded', 'true');
        };
        const close = () => {
            menu.hidden = true;
            btn.setAttribute('aria-expanded', 'false');
        };
        const toggle = () => (menu.hidden ? open() : close());

        btn.addEventListener('click', e => {
            e.stopPropagation();
            toggle();
        });

        // Click on option
        menu.querySelectorAll<HTMLElement>('[data-cdx-theme]').forEach(opt => {
            opt.addEventListener('click', () => {
                const themeId = opt.getAttribute('data-cdx-theme');
                if (themeId) {
                    applyTheme(themeId);
                }
                close();
            });
        });

        // Close on outside click
        document.addEventListener('click', e => {
            if (!picker.contains(e.target as Node)) {
                close();
            }
        });

        // Close on Escape
        picker.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                close();
                btn.focus();
            }
        });
    });

    // Sync initial selection from localStorage
    try {
        const saved = readKey(THEME_STORAGE_KEY);
        if (saved) {
            document.querySelectorAll<HTMLElement>('[data-cdx-theme]').forEach(opt => {
                opt.setAttribute(
                    'aria-selected',
                    opt.getAttribute('data-cdx-theme') === saved ? 'true' : 'false'
                );
            });
        }
    } catch {
        /* localStorage blocked */
    }
};

export const initTheme = () => {
    // Dark mode
    const stored = readKey(DARK_STORAGE_KEY);
    const dark = stored !== null ? stored === 'true' : getSystemPreference();
    applyDarkMode(dark);

    // Listen for system preference changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        applyDarkMode(e.matches);
    });

    // Bind dark mode toggle buttons (sidebar + topbar)
    document.querySelectorAll<HTMLElement>('.cdx-dark-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const current = document.documentElement.classList.contains('dark');
            applyDarkMode(!current);
        });
    });

    // Theme picker
    bindThemePicker();
};
