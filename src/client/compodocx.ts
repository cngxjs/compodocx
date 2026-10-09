import { initAnimations } from './animate';
import { initApiReference } from './api-reference';
import { initCodeBlocks } from './code-blocks';
import { initCommandPalette } from './command-palette';
import { initCoverage } from './coverage';
import { initExamples } from './examples';
import { initGraphs } from './graphs';
import { initHashRouter } from './hash-router';
import { initKeyboard } from './keyboard';
import { initRouter } from './router';
import { initSidebar } from './sidebar';
import { initStackblitz } from './stackblitz';
import { initTabs } from './tabs';
import { initTheme } from './theme';
import { initVersionSwitcher } from './version-switcher';

// import { initToc } from './toc';

// Theme must run before DOMContentLoaded to prevent flash
initTheme();

const init = () => {
    initSidebar();
    initTabs();
    initCodeBlocks();
    initHashRouter();
    initRouter();
    initCommandPalette();
    initGraphs();
    initStackblitz();
    initCoverage();
    initExamples();
    initKeyboard();
    initAnimations();
    initVersionSwitcher();
    initApiReference();
    // initToc(); // TODO: enable when ToC styling is finalized
};

// ESM modules are deferred — DOMContentLoaded may have already fired
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
