import { registerLineHandler, updateHash } from './hash-router';

/**
 * The text a copy button puts on the clipboard: the code without the line
 * numbers and fold summaries the source viewer adds around it.
 */
const copyableText = (code: Element): string => {
    const clone = code.cloneNode(true) as Element;
    clone.querySelectorAll('.cdx-line-number, .cdx-fold-summary').forEach(el => {
        el.remove();
    });
    return clone.textContent || '';
};

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const flashLine = (el: Element) => {
    el.classList.add('cdx-line-highlight');
    if (!prefersReducedMotion()) {
        el.classList.add('cdx-line-flash');
        el.addEventListener(
            'animationend',
            () => {
                el.classList.remove('cdx-line-flash');
            },
            { once: true }
        );
    }
};

const clearHighlights = (container: Element) => {
    container.querySelectorAll('.cdx-line-highlight').forEach(el => {
        el.classList.remove('cdx-line-highlight', 'cdx-line-flash');
    });
};

const highlightLines = (container: Element, start: number, end: number) => {
    clearHighlights(container);
    const lines = container.querySelectorAll<HTMLElement>('.line[data-cdx-line-nr]');
    let firstMatch: HTMLElement | null = null;

    lines.forEach(line => {
        const nr = parseInt(line.dataset.cdxLineNr || '0', 10);
        if (nr >= start && nr <= end) {
            line.classList.add('cdx-line-highlight');
            if (!firstMatch) {
                firstMatch = line;
            }
        }
    });

    if (firstMatch) {
        const behavior = prefersReducedMotion() ? ('auto' as const) : ('smooth' as const);
        firstMatch.scrollIntoView({ behavior, block: 'center' });
        if (start === end) {
            flashLine(firstMatch);
        }
    }
};

/** Called by hash-router when it resolves a #L{n} deep-link. */
const highlightLineRange = (panel: HTMLElement, start: number, end: number): void => {
    const pre = panel.querySelector<HTMLElement>('.cdx-source-viewer pre');
    if (pre) {
        highlightLines(pre, start, end);
    }
};

export const initCodeBlocks = () => {
    initCopyButtons();
    initLinkToSource();
    initLinePermalinks();
    initSourceScope();
    initExpandableSnippets();
    registerLineHandler(highlightLineRange);
};

/** How long the copy button shows its result before it resets. */
const COPY_RESET_MS = 2000;

let copyBound = false;

/** One polite live region per page, so the result of a copy is announced. */
const announce = (message: string) => {
    let region = document.getElementById('cdx-copy-status');
    if (!region) {
        region = document.createElement('div');
        region.id = 'cdx-copy-status';
        region.className = 'cdx-sr-only';
        region.setAttribute('aria-live', 'polite');
        document.body.appendChild(region);
    }
    region.textContent = '';
    region.textContent = message;
};

/** Select the code so it can be copied by hand when the clipboard refuses. */
const selectCode = (code: Element) => {
    const range = document.createRange();
    range.selectNodeContents(code);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
};

const showCopyResult = (btn: HTMLButtonElement, state: 'copied' | 'failed') => {
    const text = btn.querySelector('.cdx-copy-text');
    const idle = btn.dataset.cdxIdle ?? text?.textContent ?? '';
    btn.dataset.cdxIdle = idle;
    const message = (state === 'copied' ? btn.dataset.cdxCopied : btn.dataset.cdxFailed) ?? '';
    btn.dataset.cdxState = state;
    if (text) {
        text.textContent = message;
    }
    announce(message);
    window.clearTimeout(Number(btn.dataset.cdxTimer));
    btn.dataset.cdxTimer = String(
        window.setTimeout(() => {
            delete btn.dataset.cdxState;
            if (text) {
                text.textContent = idle;
            }
        }, COPY_RESET_MS)
    );
};

/** The code a copy button belongs to: its code block or source viewer. */
const codeOf = (btn: Element): Element | null =>
    btn.closest('.cdx-code-block, .cdx-source-viewer')?.querySelector('pre code, pre') ?? null;

const copyFrom = (btn: HTMLButtonElement) => {
    const code = codeOf(btn);
    if (!code) {
        return;
    }
    const fail = () => {
        selectCode(code);
        showCopyResult(btn, 'failed');
    };
    if (!navigator.clipboard?.writeText) {
        fail();
        return;
    }
    navigator.clipboard
        .writeText(copyableText(code))
        .then(() => showCopyResult(btn, 'copied'), fail);
};

/**
 * Scrollable code is a focusable region, and every copy button rendered by
 * the server (code blocks, source viewer headers) copies its block. One
 * delegated listener serves pages the SPA router swaps in later.
 */
const initCopyButtons = () => {
    document.querySelectorAll<HTMLElement>('pre:has(> code), pre.shiki').forEach(pre => {
        if (!pre.hasAttribute('role')) {
            pre.setAttribute('tabindex', '0');
            pre.setAttribute('role', 'region');
            pre.setAttribute('aria-label', 'Source code');
        }
        pre.querySelectorAll('.cdx-line-number, .line-number, .line-numbers-rows span').forEach(
            el => {
                el.setAttribute('aria-hidden', 'true');
            }
        );
    });
    if (copyBound) {
        return;
    }
    copyBound = true;
    document.addEventListener('click', event => {
        const btn = (event.target as Element | null)?.closest<HTMLButtonElement>(
            'button[data-cdx-copy]'
        );
        if (btn) {
            copyFrom(btn);
        }
    });
};

const initLinkToSource = () => {
    document.querySelectorAll<HTMLAnchorElement>('.cdx-link-to-source').forEach(link => {
        if (link.dataset.cdxBound) {
            return;
        }
        link.dataset.cdxBound = '1';

        link.addEventListener('click', e => {
            e.preventDefault();
            const line = link.getAttribute('data-cdx-line');
            if (line) {
                updateHash(`#L${line}`);
            }
        });
    });
};

const initLinePermalinks = () => {
    document.querySelectorAll<HTMLElement>('.cdx-source-viewer pre').forEach(pre => {
        if (pre.dataset.cdxPermalinks) {
            return;
        }
        pre.dataset.cdxPermalinks = '1';

        let rangeStart: number | null = null;

        pre.addEventListener('click', e => {
            const target = e.target as HTMLElement;
            if (!target.classList.contains('cdx-line-number')) {
                return;
            }

            const lineNr = parseInt(target.dataset.cdxLineNr || '0', 10);
            if (!lineNr) {
                return;
            }

            if (e.shiftKey && rangeStart !== null) {
                const start = Math.min(rangeStart, lineNr);
                const end = Math.max(rangeStart, lineNr);
                updateHash(`#L${start}-L${end}`);
            } else {
                rangeStart = lineNr;
                updateHash(`#L${lineNr}`);
            }
        });
    });
};

/**
 * VS Code-style "sticky scroll" for source viewers.
 *
 * Keeps the current class / method / nested-block declaration lines
 * pinned at the top of the source viewer as the user scrolls past
 * them. Drives two DOM consumers simultaneously:
 *
 *   1. The text scope indicator in the tab header
 *      (`.cdx-source-viewer-header .cdx-source-scope`) - shows the
 *      full dotted scope (e.g. `UserListComponent › ngOnInit`).
 *   2. The sticky scroll stack (`.cdx-source-viewer-sticky-stack`) -
 *      clones up to 3 real decl lines (depth 0, 1, 2) with their
 *      Shiki highlighting preserved, stacked below the header.
 *
 * Driven by a scroll listener on the outer page scroll container
 * (`.content`) - the source viewer itself has no internal scroll in
 * this phase. On every scroll frame we compute, per depth level, the
 * most-recently scrolled-past member line whose natural position is
 * above the sticky stack's pin point, and render the resulting chain.
 */
const STICKY_STACK_MAX_DEPTH = 3;
const STICKY_STACK_LINE_OFFSET = 68; // header (34) + stack top offset (34)

const initSourceScope = () => {
    const viewers = document.querySelectorAll<HTMLElement>('.cdx-source-viewer');
    if (viewers.length === 0) {
        return;
    }

    const scrollRoot =
        document.querySelector<HTMLElement>('.content') ||
        (document.scrollingElement as HTMLElement | null) ||
        document.documentElement;

    viewers.forEach(viewer => {
        // Guard against SPA re-navigation creating duplicate scroll
        // listeners. Duplicate listeners = duplicate chain computations
        // racing on the same stack element = stale pinned lines that
        // don't clear between frames.
        if (viewer.dataset.cdxScopeInit === '1') {
            return;
        }
        viewer.dataset.cdxScopeInit = '1';

        const pre = viewer.querySelector<HTMLElement>('pre');
        if (!pre) {
            return;
        }

        const header = viewer.querySelector<HTMLElement>('.cdx-source-viewer-header');
        const scopeSpan = viewer.querySelector<HTMLElement>(
            '.cdx-source-viewer-header .cdx-source-scope'
        );
        const stackEl = viewer.querySelector<HTMLElement>('.cdx-source-viewer-sticky-stack');

        // Sticky-state detector: insert a 1px sentinel just above the
        // header and observe it. Intersection false = sentinel is
        // scrolled out of view = header is currently pinned. Toggle
        // `.is-stuck` so the CSS can drop the top corner radii while
        // the header is flush with the viewport edge.
        if (header && !viewer.querySelector<HTMLElement>('.cdx-source-viewer-stick-sentinel')) {
            const sentinel = document.createElement('div');
            sentinel.className = 'cdx-source-viewer-stick-sentinel';
            sentinel.setAttribute('aria-hidden', 'true');
            viewer.insertBefore(sentinel, header);

            const stickObserver = new IntersectionObserver(
                ([entry]) => {
                    header.classList.toggle('is-stuck', !entry.isIntersecting);
                },
                { threshold: 0, rootMargin: '0px 0px 0px 0px' }
            );
            stickObserver.observe(sentinel);
        }

        const memberLines = pre.querySelectorAll<HTMLElement>('[data-cdx-member]');
        if (memberLines.length === 0) {
            return;
        }

        const members: Array<{
            el: HTMLElement;
            name: string;
            depth: number;
        }> = [];
        memberLines.forEach(el => {
            members.push({
                el,
                name: el.dataset.cdxMember || '',
                depth: Number.parseInt(el.dataset.cdxMemberDepth || '0', 10)
            });
        });

        let currentScope = '';
        let currentStackKey = '';

        const renderScope = (name: string) => {
            if (!scopeSpan || name === currentScope) {
                return;
            }
            currentScope = name;

            if (!name) {
                scopeSpan.textContent = '';
                return;
            }

            const parts = name.split('.');
            scopeSpan.innerHTML = parts
                .map((part, i) => {
                    const isLast = i === parts.length - 1;
                    const fullName = parts.slice(0, i + 1).join('.');
                    const segment = `<span class="cdx-source-scope-segment" data-cdx-member-ref="${escapeAttr(fullName)}">${escapeHtmlClient(part)}</span>`;
                    return isLast
                        ? segment
                        : `${segment}<span class="cdx-source-scope-sep" aria-hidden="true">&rsaquo;</span>`;
                })
                .join('');
        };

        const renderStack = (chain: Array<{ el: HTMLElement; name: string }>) => {
            if (!stackEl) {
                return;
            }
            const key = chain.map(c => c.name).join('|');
            if (key === currentStackKey) {
                return;
            }
            currentStackKey = key;

            stackEl.innerHTML = '';
            for (const entry of chain) {
                const clone = entry.el.cloneNode(true) as HTMLElement;
                clone.classList.add('cdx-source-sticky-line');
                clone.addEventListener('click', () => {
                    entry.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                });
                stackEl.appendChild(clone);
            }
        };

        const update = () => {
            const viewerRect = viewer.getBoundingClientRect();
            // Viewer has no layout (inside a display:none tab panel
            // on initial load, before user switches to the Source
            // tab). All member rects would also be zero, which would
            // incorrectly mark every decl as "scrolled past" and
            // render a stale chain on mount. Bail out - we'll re-run
            // when the user scrolls after the tab is visible.
            if (viewerRect.width === 0 || viewerRect.height === 0) {
                return;
            }
            // Viewer out of view entirely - nothing to pin.
            if (viewerRect.bottom < 0 || viewerRect.top > window.innerHeight) {
                renderStack([]);
                return;
            }

            // Pin trigger Y coordinate - everything above this is
            // "scrolled past" and eligible for the stack.
            const triggerY = STICKY_STACK_LINE_OFFSET;

            const activeByDepth: Record<number, (typeof members)[number]> = {};
            for (const m of members) {
                const rect = m.el.getBoundingClientRect();
                if (rect.top <= triggerY) {
                    if (m.depth < STICKY_STACK_MAX_DEPTH) {
                        activeByDepth[m.depth] = m;
                    }
                } else {
                    break;
                }
            }

            const chain: Array<(typeof members)[number]> = [];
            for (let d = 0; d < STICKY_STACK_MAX_DEPTH; d++) {
                if (activeByDepth[d]) {
                    chain.push(activeByDepth[d]);
                }
            }

            // Scope text follows the deepest active chain.
            const deepest = chain.at(-1);
            renderScope(deepest ? deepest.name : members[0]?.name || '');
            renderStack(chain);
        };

        // Initial render - pin the first member as the scope so the
        // header is never visually empty on mount.
        update();

        let ticking = false;
        const onScroll = () => {
            if (ticking) {
                return;
            }
            ticking = true;
            requestAnimationFrame(() => {
                update();
                ticking = false;
            });
        };

        scrollRoot.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll, { passive: true });
    });
};

const escapeHtmlClient = (str: string) =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escapeAttr = (str: string) => str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const initExpandableSnippets = () => {
    document.querySelectorAll<HTMLElement>('pre:has(> code), pre.shiki').forEach(pre => {
        if (pre.closest('.cdx-source-viewer') || pre.dataset.cdxExpandChecked) {
            return;
        }
        pre.dataset.cdxExpandChecked = '1';

        const code = pre.querySelector('code');
        if (!code) {
            return;
        }

        const lineCount = (code.textContent || '').split('\n').length;
        if (lineCount <= 10) {
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'cdx-code-expandable';
        pre.parentNode?.insertBefore(wrapper, pre);
        wrapper.appendChild(pre);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cdx-code-expand-btn';
        btn.setAttribute('aria-expanded', 'false');
        btn.textContent = `Show all ${lineCount} lines`;
        btn.addEventListener('click', () => {
            const expanded = wrapper.classList.toggle('cdx-code-expanded');
            btn.setAttribute('aria-expanded', String(expanded));
            btn.textContent = expanded ? 'Show less' : `Show all ${lineCount} lines`;
        });
        wrapper.appendChild(btn);
    });
};
