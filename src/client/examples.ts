const BOUND = new WeakSet<HTMLIFrameElement>();
const TRACKED: HTMLIFrameElement[] = [];

const measureContentHeight = (doc: Document): number => {
    const body = doc.body;
    if (body) {
        const rect = body.getBoundingClientRect();
        const styles = doc.defaultView?.getComputedStyle(body);
        const marginTop = styles ? parseFloat(styles.marginTop) || 0 : 0;
        const marginBottom = styles ? parseFloat(styles.marginBottom) || 0 : 0;
        return Math.ceil(rect.height + marginTop + marginBottom);
    }
    return doc.documentElement?.scrollHeight ?? 0;
};

/**
 * Whether the frame shares protocol and host with the page. Only then is its
 * document read; WebKit logs every attempt on a foreign frame as an error,
 * even when the access is caught. On `file://` every file is an origin of
 * its own, so no frame counts as same-origin there.
 */
export const isSameOriginFrame = (src: string, page: string): boolean => {
    try {
        const frame = new URL(src, page);
        const here = new URL(page);
        return (
            here.protocol !== 'file:' &&
            frame.protocol === here.protocol &&
            frame.host === here.host
        );
    } catch {
        return false;
    }
};

const documentOf = (iframe: HTMLIFrameElement): Document | null =>
    isSameOriginFrame(iframe.getAttribute('src') ?? '', globalThis.location.href)
        ? iframe.contentDocument
        : null;

const resizeIframe = (iframe: HTMLIFrameElement): void => {
    try {
        const doc = documentOf(iframe);
        if (!doc) {
            return;
        }
        const height = measureContentHeight(doc);
        if (height > 0) {
            iframe.style.height = `${height}px`;
        }
    } catch {
        // cross-origin - keep CSS min-height fallback
    }
};

const observeContent = (iframe: HTMLIFrameElement): void => {
    try {
        const doc = documentOf(iframe);
        if (!doc) {
            return;
        }
        const target = doc.body ?? doc.documentElement;
        if (!target) {
            return;
        }
        const ro = new ResizeObserver(() => resizeIframe(iframe));
        ro.observe(target);
    } catch {
        // cross-origin - silent
    }
};

const isParentDark = (): boolean => document.documentElement.classList.contains('dark');

const applyThemeToIframe = (iframe: HTMLIFrameElement): void => {
    const dark = isParentDark();
    // Same-origin path: toggle .dark on the iframe's <html> + <body> so the
    // example HTML can react via plain CSS (`.dark` selector or
    // `@media (prefers-color-scheme: dark)` fallback).
    try {
        const doc = documentOf(iframe);
        if (doc?.documentElement) {
            doc.documentElement.classList.toggle('dark', dark);
            doc.body?.classList.toggle('dark', dark);
        }
    } catch {
        // cross-origin - fall through to postMessage
    }
    // Cross-origin or opt-in subscribers: postMessage protocol.
    try {
        iframe.contentWindow?.postMessage({ type: 'cdx-iframe-theme', dark }, '*');
    } catch {
        // contentWindow can throw on detached frames
    }
};

const bind = (iframe: HTMLIFrameElement): void => {
    if (BOUND.has(iframe)) {
        return;
    }
    BOUND.add(iframe);
    TRACKED.push(iframe);

    iframe.addEventListener('load', () => {
        applyThemeToIframe(iframe);
        resizeIframe(iframe);
        observeContent(iframe);
    });

    // Already-loaded iframes (cached / SPA-restored)
    try {
        if (documentOf(iframe)?.readyState === 'complete') {
            applyThemeToIframe(iframe);
            resizeIframe(iframe);
            observeContent(iframe);
        }
    } catch {
        // cross-origin
    }
};

let themeObserver: MutationObserver | null = null;

const ensureThemeObserver = (): void => {
    if (themeObserver) {
        return;
    }
    themeObserver = new MutationObserver(() => {
        for (const iframe of TRACKED) {
            if (iframe.isConnected) {
                applyThemeToIframe(iframe);
            }
        }
    });
    themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class']
    });
};

export const initExamples = (): void => {
    document.querySelectorAll<HTMLIFrameElement>('iframe.cdx-example-container').forEach(bind);
    ensureThemeObserver();
};
