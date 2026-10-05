export const RouterUtils = {
    getLazyModule: () => () => import('./lazy/lazy.routes').then(m => m.LAZY_ROUTES),
    config: {
        pathMatch: 'full'
    },
    titles: {
        dashboard: 'Dashboard',
        home: 'Home'
    },
    breadcrumbs: {
        main: 'Main Navigation'
    },
    matcher: {
        full: 'full',
        prefix: 'prefix'
    }
};
