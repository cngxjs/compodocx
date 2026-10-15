import * as path from 'node:path';

import fg from 'fast-glob';
import { describe, expect, it } from 'vitest';

import { createSemanticProgram } from '../../../../src/app/compiler/semantic';
import { buildRouting, declarationKey, lazyResolver } from '../../../../src/app/routing';
import { routeTree } from './tree';

const CWD = process.cwd();

/** The route tree of a fixture, through its real semantic program (no symbol table). */
const treeOf = (dir: string): string => {
    const root = path.join(CWD, dir);
    const files = fg
        .sync('**/*.ts', {
            cwd: root,
            absolute: true,
            ignore: ['**/node_modules/**', '**/*.spec.ts']
        })
        .sort();
    const program = createSemanticProgram(path.join(root, 'tsconfig.json'), files);
    if (program.ok === false) {
        throw new Error(program.message);
    }
    const symbolOf = declarationKey(CWD);
    return routeTree(
        buildRouting({
            program: program.value,
            files,
            cwd: CWD,
            symbolOf,
            lazy: notes => lazyResolver(program.value, symbolOf, CWD, notes)
        })
    );
};

describe('route trees of the fixtures', () => {
    it('reads the standalone app', () => {
        expect(
            treeOf('test/fixtures/standalone-app/src')
        ).toBe(`router bootstrap=test/fixtures/standalone-app/src/main.ts(AppComponent) config=appConfig array=routes features=[withComponentInputBinding()]
  / -> redirect dashboard pathMatch=full
  /dashboard -> DashboardComponent (lazy)
  /users -> UserListComponent (lazy) canActivate=[authGuard]
    /users/:id -> UserDetailComponent (lazy)
  /settings -> SettingsComponent (lazy) canDeactivate=[unsavedChangesGuard]
  /admin -> AdminPanelComponent (lazy) canActivate=[adminGuard, roleGuard('admin', 'superadmin')] canMatch=[featureFlagGuard] data={{ featureFlag: 'beta' }}`);
    });

    it('reads the kitchen sink', () => {
        expect(
            treeOf('test/fixtures/kitchen-sink-standalone')
        ).toBe(`router bootstrap=test/fixtures/kitchen-sink-standalone/src/main.ts(AppComponent) config=appConfig array=routes features=[withComponentInputBinding(), withViewTransitions(), withPreloading(PreloadAllModules), withRouterConfig({ onSameUrlNavigation: 'reload' })]
  / -> redirect dashboard pathMatch=full
  /dashboard -> DashboardComponent (lazy) canActivate=[authGuard]
  /users -> UserListComponent (lazy) canActivate=[authGuard, roleGuard]
    /users/:id -> UserDetailComponent (lazy)
  /admin -> AdminPanelComponent (lazy) canActivate=[authGuard, roleGuard] canDeactivate=[unsavedChangesGuard]
  /experimental -> DashboardComponent (lazy) canActivate=[featureFlagGuard]
  /** -> redirect dashboard`);
    });

    it('reads todomvc', () => {
        expect(
            treeOf('test/fixtures/todomvc-ng2/src')
        ).toBe(`router bootstrap=test/fixtures/todomvc-ng2/src/main.ts(AppComponent) config=appConfig
  /{PATHS.home.url} -> HomeComponent
  /about -> children ABOUT_ROUTES (lazy)
    /about/{ABOUT_ENUMS.todomvc} -> AboutComponent providers=[TodoStore]
      /about/{ABOUT_ENUMS.todomvc} -> redirect todomvc data={utils.doWork()}
      /about/{ABOUT_ENUMS.todomvc}/todomvc -> TodoMVCComponent data={{ title: extract('Home') }}
      /about/{ABOUT_ENUMS.todomvc}/compodoc -> CompodocComponent data={oneFunction()}
  / -> redirect homeenumimported pathMatch=full
  /** -> redirect homeenuminfile pathMatch=full`);
    });

    it('reads the routing app', () => {
        expect(
            treeOf('test/fixtures/routing-app')
        ).toBe(`router bootstrap=test/fixtures/routing-app/src/main.ts(RtaShell) config=baseConfig array=APP_ROUTES features=[withComponentInputBinding(), withHashLocation()]
  / -> redirect home pathMatch=full
  /home -> RtaHome title=Home
  /start -> redirect {rtaStartRedirect}
  /settings -> RtaSettings (lazy) canDeactivate=[rtaLeaveGuard]
  /account -> RtaAccount canActivate=[rtaAuthGuard] canActivateChild=[rtaChildGuard] providers=[provideRtaAccountScope()] runGuardsAndResolvers={'always'}
    /account/profile -> RtaProfile resolve={user: rtaUserResolver}
  /account/profile/edit -> RtaProfile canActivate=[rtaRoleGuard('owner', 'admin')]
  /help -> RtaHelp title={rtaHelpTitle}
    /help/faq -> RtaFaq
  /preview -> RtaPreview outlet=aside
  /{rtaLegacyMatcher} -> RtaLegacy matcher={rtaLegacyMatcher}
  /{rtaPathFor('reports')} -> (none)
    /{rtaPathFor('reports')}/{rtaReportRoutes('reports')} -> built by {rtaReportRoutes('reports')}
  /admin -> children default (lazy) canMatch=[rtaAdminMatch]
    /admin -> RtaAdminDashboard (lazy)
    /admin/users -> RtaAdminUsers (lazy)
    /admin/audit -> children AUDIT_ROUTES (lazy)
      /admin/audit -> RtaAuditLog
      /admin/audit/:entry -> children ENTRY_ROUTES (lazy)
        /admin/audit/:entry -> RtaAuditEntry
  /remote -> children external @rta/remote#REMOTE_ROUTES (lazy)
  /** -> redirect {() => '/home'}
unmounted array=PARTNER_ROUTES
  /partners -> RtaPartnerList title=Partners`);
    });

    it('reads the simple routing scenario', () => {
        expect(
            treeOf('test/fixtures/standalone-scenarios/routing/simple')
        ).toBe(`router bootstrap=test/fixtures/standalone-scenarios/routing/simple/src/main.ts(AppComponent) config=appConfig
  /home -> HomeComponent
  /login -> (none)
  /about -> children ABOUT_ROUTES (lazy)
    /about -> AboutComponent
  / -> redirect home pathMatch=full
  /** -> redirect home pathMatch=full`);
    });

    it('reads the async lazy scenario', () => {
        expect(
            treeOf('test/fixtures/standalone-scenarios/routing/lazy-async')
        ).toBe(`router bootstrap=test/fixtures/standalone-scenarios/routing/lazy-async/src/main.ts(AppComponent) config=appConfig
  /home -> HomeComponent
  /about -> children ABOUT_ROUTES (lazy)
    /about -> AboutComponent
  /toto -> children unresolved {async () => (await import(\`./toto/toto.routes\`)).TOTO_ROUTES} (lazy)
  / -> redirect home pathMatch=full
  /** -> redirect home pathMatch=full`);
    });

    it('reads the trailing-comma scenario', () => {
        expect(
            treeOf('test/fixtures/standalone-scenarios/routing/lazy-trailing-comma')
        ).toBe(`router bootstrap=test/fixtures/standalone-scenarios/routing/lazy-trailing-comma/src/main.ts(AppComponent) config=appConfig
  /home -> HomeComponent
  /about -> children ABOUT_ROUTES (lazy)
    /about -> AboutComponent
  / -> redirect home pathMatch=full
  /** -> redirect home pathMatch=full`);
    });

    it('reads the bootstrap-in-if scenario', () => {
        expect(
            treeOf('test/fixtures/standalone-scenarios/routing/bootstrap-if')
        ).toBe(`router bootstrap=test/fixtures/standalone-scenarios/routing/bootstrap-if/src/main.ts(AppComponent) config=appConfig
  /home -> HomeComponent
  /about -> AboutComponent (lazy)
  / -> redirect home pathMatch=full
  /** -> redirect home pathMatch=full`);
    });

    it('reads the routing-coverage scenario', () => {
        expect(
            treeOf('test/fixtures/standalone-scenarios/routing-coverage')
        ).toBe(`router bootstrap=test/fixtures/standalone-scenarios/routing-coverage/src/main.ts(AppComponent) config=appConfig array=APP_ROUTES
  /home -> unresolved {'HomeComponent'}
  /welcome -> unresolved {'WelcomeComponent'}
  /admin -> unresolved {'AdminComponent'}
  /dashboard -> unresolved {'DashboardComponent'}
  /{RoutePaths.DASHBOARD} -> children unresolved {RouterUtils.getLazyModule()} (lazy) data={{ title: RouterUtils.titles.dashboard, breadcrumb: RouterUtils.breadcrumbs.main }}
  /user-profile -> FALLBACK_COMPONENT
    /user-profile/profile -> unresolved {'ProfileComponent'}
    /user-profile/settings -> unresolved {'SettingsComponent'}
  /** -> redirect {RoutePaths.HOME}`);
    });
});
