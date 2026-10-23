/**
 * Keyboard-first navigation.
 * Shortcuts: ? (overlay), / (search), j/k (member nav), n/p (entity nav), Escape.
 */

import { openCommandPalette } from './command-palette';
import { updateHash } from './hash-router';

const DIALOG_ID = 'cdx-shortcuts-dialog';
let currentMemberIndex = -1;

/** Check if shortcuts should be suppressed (input focus, open dialog) */
const isSuppressed = (): boolean => {
    const el = document.activeElement;
    if (!el) {
        return false;
    }
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return true;
    }
    if ((el as HTMLElement).isContentEditable) {
        return true;
    }
    // Suppress when any dialog is open (command palette, shortcut overlay)
    if (document.querySelector('dialog[open]')) {
        return true;
    }
    return false;
};

/** Create the shortcuts overlay dialog (once) */
const createDialog = (): HTMLDialogElement => {
    const existing = document.getElementById(DIALOG_ID) as HTMLDialogElement;
    if (existing) {
        return existing;
    }

    const dialog = document.createElement('dialog');
    dialog.id = DIALOG_ID;
    dialog.className = 'cdx-cp';
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', 'Keyboard shortcuts');
    const mod = navigator.platform.includes('Mac') ? '⌘' : 'Ctrl';
    const row = (key: string, desc: string) =>
        `<div class="cdx-shortcut-row"><dt>${key}</dt><dd>${desc}</dd></div>`;
    const kbd = (k: string, cls = '') => `<kbd${cls ? ` class="${cls}"` : ''}>${k}</kbd>`;
    const section = (title: string, rows: string) =>
        `<section><h3>${title}</h3><dl>${rows}</dl></section>`;

    dialog.innerHTML =
        '<div class="cdx-shortcuts-panel">' +
        '<h2>Keyboard Shortcuts</h2>' +
        '<div class="cdx-shortcuts-grid">' +
        section('Navigation', row(kbd('p'), 'Previous entity') + row(kbd('n'), 'Next entity')) +
        section('Page', row(kbd('j'), 'Next member') + row(kbd('k'), 'Previous member')) +
        section(
            'Search',
            row(kbd('/'), 'Open search') +
                row(kbd(mod, 'cdx-kbd-mod') + kbd('K'), 'Open search') +
                row(kbd('?'), 'This dialog')
        ) +
        '</div></div>';
    document.body.appendChild(dialog);

    // Close on click outside panel
    dialog.addEventListener('click', e => {
        const panel = dialog.querySelector('.cdx-shortcuts-panel');
        if (panel && !panel.contains(e.target as Node)) {
            dialog.close();
        }
    });

    return dialog;
};

const MEMBER_SELECTOR = '.cdx-member-card, .cdx-io-member[id]';

const membersOf = (panel: Element | null): HTMLElement[] =>
    panel ? Array.from(panel.querySelectorAll<HTMLElement>(MEMBER_SELECTOR)) : [];

/** j/k member card navigation; switches to the first tab with members (normally API) */
const navigateMember = (direction: 1 | -1) => {
    let cards = membersOf(document.querySelector('.cdx-tab-panel.active'));
    if (!cards.length) {
        const panel = Array.from(document.querySelectorAll<HTMLElement>('.cdx-tab-panel')).find(
            p => membersOf(p).length > 0
        );
        if (!panel) {
            return;
        }
        // Same path as clicking the tab: ARIA, active panel and URL hash stay in sync
        updateHash(`#${panel.id}`);
        cards = membersOf(panel);
        currentMemberIndex = direction === 1 ? -1 : cards.length;
    }

    // Remove previous focus
    document
        .querySelectorAll('.cdx-member-card--focused')
        .forEach(el => el.classList.remove('cdx-member-card--focused'));

    currentMemberIndex += direction;
    if (currentMemberIndex < 0) {
        currentMemberIndex = 0;
    }
    if (currentMemberIndex >= cards.length) {
        currentMemberIndex = cards.length - 1;
    }

    const card = cards[currentMemberIndex];
    card.classList.add('cdx-member-card--focused');

    // Scroll into view
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    card.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion ? 'auto' : 'smooth' });
};

/** Entity preview panel state */
let previewDismissTimer: ReturnType<typeof setTimeout> | null = null;
let focusedEntityIdx = -1;

/** Remove any existing preview panel and sidebar focus */
const dismissPreview = () => {
    if (previewDismissTimer) {
        clearTimeout(previewDismissTimer);
        previewDismissTimer = null;
    }
    document
        .querySelectorAll('.cdx-sidebar-focused')
        .forEach(el => el.classList.remove('cdx-sidebar-focused'));
    document.querySelectorAll('.cdx-entity-preview').forEach(el => el.remove());
    focusedEntityIdx = -1;
};

/** Build preview panel HTML from data-cdx-* attributes */
const buildPreviewHtml = (link: HTMLAnchorElement): string => {
    const entityType = link.getAttribute('data-cdx-entity-type') || '';
    const selector = link.getAttribute('data-cdx-selector');
    const io = link.getAttribute('data-cdx-io');
    const desc = link.getAttribute('data-cdx-desc');

    let html = '';
    if (entityType) {
        html += `<span class="cdx-badge cdx-badge--entity-${entityType}">${entityType.charAt(0).toUpperCase() + entityType.slice(1)}</span>`;
    }
    if (selector) {
        html += ` <code class="cdx-entity-preview-selector">${selector}</code>`;
    }
    if (io) {
        const [inputs, outputs] = io.split('/');
        html += ` <span class="cdx-entity-preview-io">${inputs} inputs, ${outputs} outputs</span>`;
    }
    if (desc) {
        html += `<p class="cdx-entity-preview-desc">${desc}</p>`;
    }
    return html;
};

/** Sidebar entity links that are rendered; links inside collapsed nodes are skipped */
const visibleEntityLinks = (): HTMLAnchorElement[] =>
    Array.from(
        document.querySelectorAll<HTMLAnchorElement>('.menu a[data-type="entity-link"]')
    ).filter(link => link.getClientRects().length > 0);

/** n/p entity sidebar navigation with preview */
const navigateEntity = (direction: 1 | -1) => {
    const links = visibleEntityLinks();
    if (!links.length) {
        return;
    }

    // If no preview is active, start from the current active link (first/last when it is hidden)
    if (focusedEntityIdx === -1) {
        const activeLink = document.querySelector<HTMLAnchorElement>(
            '.menu a.active[data-type="entity-link"]'
        );
        focusedEntityIdx = activeLink ? links.indexOf(activeLink) : -1;
    }

    let nextIdx = focusedEntityIdx + direction;
    if (nextIdx < 0) {
        nextIdx = links.length - 1;
    }
    if (nextIdx >= links.length) {
        nextIdx = 0;
    }
    focusedEntityIdx = nextIdx;

    const target = links[nextIdx];
    if (!target) {
        return;
    }

    // Clear previous focus/preview
    document
        .querySelectorAll('.cdx-sidebar-focused')
        .forEach(el => el.classList.remove('cdx-sidebar-focused'));
    document.querySelectorAll('.cdx-entity-preview').forEach(el => el.remove());

    // Focus the target's parent li
    const li = target.closest('li');
    if (li) {
        li.classList.add('cdx-sidebar-focused');
    }

    // Scroll focused item into view
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion ? 'auto' : 'smooth' });

    // Build and insert preview panel
    const previewHtml = buildPreviewHtml(target);
    if (previewHtml) {
        const panel = document.createElement('div');
        panel.className = 'cdx-entity-preview';
        panel.setAttribute('role', 'tooltip');
        panel.setAttribute('aria-live', 'polite');
        panel.innerHTML = previewHtml;
        if (li) {
            li.appendChild(panel);
        }
    }

    // Auto-dismiss after 5 seconds
    if (previewDismissTimer) {
        clearTimeout(previewDismissTimer);
    }
    previewDismissTimer = setTimeout(dismissPreview, 5000);
};

/** Navigate to the focused entity (Enter key) */
const confirmEntityNavigation = () => {
    const links = visibleEntityLinks();
    if (focusedEntityIdx >= 0 && focusedEntityIdx < links.length) {
        const target = links[focusedEntityIdx];
        dismissPreview();
        target.click(); // Triggers SPA router
    }
};

/** Main keydown handler */
const onKeydown = (e: KeyboardEvent) => {
    // Always allow Escape to close dialogs and dismiss previews
    if (e.key === 'Escape') {
        const dialog = document.getElementById(DIALOG_ID) as HTMLDialogElement;
        if (dialog?.open) {
            dialog.close();
            return;
        }
        // Dismiss entity preview if active
        if (focusedEntityIdx !== -1) {
            dismissPreview();
            return;
        }
        // Clear member focus
        document
            .querySelectorAll('.cdx-member-card--focused')
            .forEach(el => el.classList.remove('cdx-member-card--focused'));
        currentMemberIndex = -1;
        return;
    }

    // Enter confirms entity navigation when preview is active
    if (e.key === 'Enter' && focusedEntityIdx !== -1) {
        e.preventDefault();
        confirmEntityNavigation();
        return;
    }

    if (isSuppressed()) {
        return;
    }

    switch (e.key) {
        case '?':
            e.preventDefault();
            createDialog().showModal();
            break;
        case '/':
            e.preventDefault();
            openCommandPalette();
            break;
        case 'j':
            e.preventDefault();
            navigateMember(1);
            break;
        case 'k':
            e.preventDefault();
            navigateMember(-1);
            break;
        case 'p':
            e.preventDefault();
            navigateEntity(-1);
            break;
        case 'n':
            e.preventDefault();
            navigateEntity(1);
            break;
    }
};

/** Reset member navigation index (call on SPA navigation) */
export const resetKeyboardState = () => {
    currentMemberIndex = -1;
    document
        .querySelectorAll('.cdx-member-card--focused')
        .forEach(el => el.classList.remove('cdx-member-card--focused'));
    dismissPreview();
};

export const initKeyboard = () => {
    document.addEventListener('keydown', onKeydown);
};
