import { registerLineHandler, updateHash } from './hash-router';

const LANG_MAP: Record<string, string> = {
    typescript: 'TypeScript',
    javascript: 'JavaScript',
    html: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    json: 'JSON',
    bash: 'Shell',
    markdown: 'Markdown'
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
    initLanguageChips();
    initExpandableSnippets();
    registerLineHandler(highlightLineRange);
};

const initCopyButtons = () => {
    // Floating copy button for bare <pre> blocks outside a source viewer
    // (inline code snippets in markdown, examples, etc.)
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

        // Source-viewer blocks have their own copy button in the header.
        if (pre.closest('.cdx-source-viewer')) {
            return;
        }
        // Idempotency: skip if either the button or its wrapping container
        // is already in place (covers SPA re-init and pre-existing markup).
        if (
            pre.parentElement?.querySelector(':scope > .cdx-code-copy') ||
            pre.parentElement?.classList.contains('cdx-code-copy-wrap')
        ) {
            return;
        }

        const btn = document.createElement('button');
        btn.className = 'cdx-code-copy';
        btn.textContent = 'Copy';
        btn.setAttribute('aria-label', 'Copy code');
        btn.addEventListener('click', () => {
            const code = pre.querySelector('code');
            if (code) {
                navigator.clipboard.writeText(code.textContent || '').then(() => {
                    btn.textContent = 'Copied!';
                    btn.setAttribute('aria-label', 'Copied!');
                    btn.classList.add('cdx-code-copy--copied');
                    setTimeout(() => {
                        btn.textContent = 'Copy';
                        btn.setAttribute('aria-label', 'Copy code');
                        btn.classList.remove('cdx-code-copy--copied');
                    }, 2000);
                });
            }
        });
        // Place the button OUTSIDE `<pre>` so it doesn't scroll with the
        // horizontally-scrolling code content. If `<pre>` is already wrapped
        // by `.cdx-code-snippet` (markdown-rendered fences) we reuse that
        // positioned wrapper; otherwise we insert a thin one.
        const existingWrapper = pre.parentElement?.classList.contains('cdx-code-snippet')
            ? pre.parentElement
            : null;
        let wrapper: HTMLElement;
        if (existingWrapper) {
            wrapper = existingWrapper;
        } else {
            wrapper = document.createElement('div');
            wrapper.className = 'cdx-code-copy-wrap';
            pre.parentNode?.insertBefore(wrapper, pre);
            wrapper.appendChild(pre);
        }
        wrapper.appendChild(btn);
    });

    // Wire up the integrated `.cdx-source-viewer-copy` button in each
    // source viewer tab header.
    document.querySelectorAll<HTMLButtonElement>('.cdx-source-viewer-copy').forEach(btn => {
        if (btn.dataset.cdxBound) {
            return;
        }
        btn.dataset.cdxBound = '1';
        btn.addEventListener('click', () => {
            const viewer = btn.closest('.cdx-source-viewer');
            const code = viewer?.querySelector('pre code');
            if (!code) {
                return;
            }
            navigator.clipboard.writeText(code.textContent || '').then(() => {
                btn.classList.add('cdx-source-viewer-copy--copied');
                btn.setAttribute('aria-label', 'Copied!');
                setTimeout(() => {
                    btn.classList.remove('cdx-source-viewer-copy--copied');
                    btn.setAttribute('aria-label', 'Copy source');
                }, 2000);
            });
        });
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
 *      (`.cdx-source-viewer-header .cdx-source-scope`) — shows the
 *      full dotted scope (e.g. `UserListComponent › ngOnInit`).
 *   2. The sticky scroll stack (`.cdx-source-viewer-sticky-stack`) —
 *      clones up to 3 real decl lines (depth 0, 1, 2) with their
 *      Shiki highlighting preserved, stacked below the header.
 *
 * Driven by a scroll listener on the outer page scroll container
 * (`.content`) — the source viewer itself has no internal scroll in
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
            // render a stale chain on mount. Bail out — we'll re-run
            // when the user scrolls after the tab is visible.
            if (viewerRect.width === 0 || viewerRect.height === 0) {
                return;
            }
            // Viewer out of view entirely — nothing to pin.
            if (viewerRect.bottom < 0 || viewerRect.top > window.innerHeight) {
                renderStack([]);
                return;
            }

            // Pin trigger Y coordinate — everything above this is
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

        // Initial render — pin the first member as the scope so the
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

const initLanguageChips = () => {
    document.querySelectorAll<HTMLElement>('pre:has(> code), pre.shiki').forEach(pre => {
        if (pre.querySelector('.cdx-code-lang-chip') || pre.closest('.cdx-source-viewer')) {
            return;
        }

        const code = pre.querySelector('code');
        if (!code) {
            return;
        }

        const langClass = Array.from(code.classList).find(c => c.startsWith('language-'));
        if (!langClass) {
            return;
        }

        const lang = langClass.replace('language-', '');
        const label = LANG_MAP[lang] || lang.toUpperCase();

        const chip = document.createElement('span');
        chip.className = 'cdx-code-lang-chip';
        chip.textContent = label;
        pre.style.position = 'relative';
        pre.appendChild(chip);
    });
};

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
        btn.className = 'cdx-code-expand-btn';
        btn.textContent = `Show all ${lineCount} lines`;
        btn.setAttribute('aria-label', `Expand code block to show all ${lineCount} lines`);
        btn.addEventListener('click', () => {
            wrapper.classList.add('cdx-code-expanded');
        });
        wrapper.appendChild(btn);
    });
};
