/**
 * StackBlitz integration. Two surfaces:
 *
 * 1. Author-supplied @stackblitz JSDoc tag links (legacy) - open the linked
 *    project in a new tab via `window.open` with no SDK loaded.
 * 2. `@playground` blocks - click on a `.cdx-playground-launch` button
 *    materializes the SDK lazily via dynamic `import('@stackblitz/sdk')`
 *    and calls `openProject(project, { openFile, startScript, newWindow: true })`.
 *    Static doc pages do not pay the SDK byte cost until the user opts in.
 *
 * `initStackblitz()` runs on first page load AND on every SPA navigation
 * (`reinitPage()` in `router.ts`). Each binding step uses module-level
 * `WeakSet`s so re-running the init never produces duplicate handlers.
 */

const URL_DECORATED = new WeakSet<Element>();
const TAG_BOUND = new WeakSet<HTMLElement>();
const LAUNCH_BOUND = new WeakSet<HTMLButtonElement>();

function createOpenButton(url: string, container: Element): void {
    if (URL_DECORATED.has(container)) {
        return;
    }
    URL_DECORATED.add(container);
    const btn = document.createElement('a');
    btn.className = 'cdx-stackblitz-btn';
    btn.textContent = 'Open in StackBlitz';
    btn.href = url.startsWith('http') ? url : `https://stackblitz.com/edit/${url}`;
    btn.target = '_blank';
    btn.rel = 'noopener noreferrer';
    container.appendChild(btn);
}

async function launchPlayground(buttonEl: HTMLButtonElement): Promise<void> {
    const manifestId = buttonEl.dataset.cdxStackblitzManifest;
    if (!manifestId) {
        return;
    }
    const manifestNode = document.querySelector<HTMLScriptElement>(
        `script[data-cdx-stackblitz-manifest-data="${manifestId}"]`
    );
    if (!manifestNode) {
        console.error('[compodocx] missing playground manifest:', manifestId);
        return;
    }
    let manifest: any;
    try {
        manifest = JSON.parse(manifestNode.textContent ?? '{}');
    } catch (err) {
        console.error('[compodocx] could not parse playground manifest:', err);
        return;
    }
    // SDK contract: { title, description, template, files, dependencies, tags } as
    // the project payload, { openFile, startScript, newWindow } as options.
    // `startScript: 'start'` makes WebContainer run `npm start` (= `ng serve`)
    // after install - without it, the dev server never boots.
    const { openFile, startScript, ...project } = manifest;
    try {
        const mod = await import('@stackblitz/sdk');
        const sdk = (mod as any).default ?? mod;
        sdk.openProject(project, {
            newWindow: true,
            openFile: openFile ?? 'src/app/app.component.ts',
            startScript: startScript ?? 'start'
        });
    } catch (err) {
        console.error('[compodocx] StackBlitz SDK failed to load:', err);
    }
}

function initPlaygroundLaunchers(): void {
    const buttons = document.querySelectorAll<HTMLButtonElement>('.cdx-playground-launch');
    buttons.forEach(btn => {
        if (LAUNCH_BOUND.has(btn)) {
            return;
        }
        LAUNCH_BOUND.add(btn);
        btn.addEventListener('click', () => {
            launchPlayground(btn);
        });
    });
}

export function initStackblitz(): void {
    // Handle [data-stackblitz-url] elements
    const elements = document.querySelectorAll<HTMLElement>('[data-stackblitz-url]');
    elements.forEach(el => {
        const url = el.dataset.stackblitzUrl;
        if (url) {
            createOpenButton(url, el);
        }
    });

    // Handle @stackblitz JSDoc tag link buttons
    const tagButtons = document.querySelectorAll<HTMLElement>('.cdx-stackblitz-tag');
    tagButtons.forEach(el => {
        if (TAG_BOUND.has(el)) {
            return;
        }
        const url = el.dataset.url;
        if (!url) {
            return;
        }
        TAG_BOUND.add(el);
        el.addEventListener('click', () => {
            window.open(
                url.startsWith('http') ? url : `https://stackblitz.com/edit/${url}`,
                '_blank',
                'noopener,noreferrer'
            );
        });
    });

    initPlaygroundLaunchers();
}
