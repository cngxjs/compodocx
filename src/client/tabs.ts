/**
 * Keyboard navigation for tabs (WAI-ARIA roving tabindex).
 * Click handling lives in hash-router.ts via event delegation.
 */

import { updateHash } from './hash-router';

/** Switch tab from keyboard - updates the URL hash and moves focus. */
const activateTab = (tab: HTMLElement) => {
    const href = tab.getAttribute('href');
    if (href) {
        updateHash(href);
    }
    tab.focus();
};

export const initTabs = () => {
    document.querySelectorAll<HTMLElement>('.cdx-tab-bar, [role="tablist"]').forEach(tabList => {
        const tabs = Array.from(tabList.querySelectorAll<HTMLElement>('[role="tab"]'));
        if (!tabs.length) {
            return;
        }

        // Keyboard navigation
        tabList.addEventListener('keydown', e => {
            const current = document.activeElement as HTMLElement;
            if (!current?.matches('[role="tab"]')) {
                return;
            }

            const idx = tabs.indexOf(current);
            if (idx === -1) {
                return;
            }

            let next: number | null = null;

            switch (e.key) {
                case 'ArrowRight':
                    next = (idx + 1) % tabs.length;
                    break;
                case 'ArrowLeft':
                    next = (idx - 1 + tabs.length) % tabs.length;
                    break;
                case 'Home':
                    next = 0;
                    break;
                case 'End':
                    next = tabs.length - 1;
                    break;
                default:
                    return;
            }

            e.preventDefault();
            activateTab(tabs[next]);
        });
    });
};
