/**
 * StackBlitz integration for `@playground` blocks: a click on a
 * `.cdx-playground-launch` button materializes the SDK lazily via dynamic
 * `import('@stackblitz/sdk')` and calls
 * `openProject(project, { openFile, startScript, newWindow: true })`.
 * Static doc pages do not pay the SDK byte cost until the user opts in.
 *
 * `initStackblitz()` runs on first page load AND on every SPA navigation
 * (`reinitPage()` in `router.ts`). A module-level `WeakSet` keeps re-running
 * the init from producing duplicate handlers.
 */

const LAUNCH_BOUND = new WeakSet<HTMLButtonElement>();

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
    initPlaygroundLaunchers();
}
