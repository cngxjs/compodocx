import { Routes } from '@angular/router';

import { AboutComponent } from './about.component';
import { TodoMVCComponent } from './todomvc/todomvc.component';
import { CompodocComponent } from './compodoc/compodoc.component';

import { ABOUT_ENUMS } from './about-routes.enum';

import { pathMatchStrategy } from './path-match';

import { utils, oneFunction } from './utils';

import { TodoStore } from '../shared/services/todo.store';

const extract = function(s: string) {};

/**
 * About routes
 *
 * Exposing just two routes, one for Compodoc, the other one for TodoMVC
 */
export const ABOUT_ROUTES: Routes = [
    {
        path: ABOUT_ENUMS.todomvc,
        component: AboutComponent,
        providers: [TodoStore],
        children: [
            {
                path: '',
                redirectTo: 'todomvc',
                pathMatch: pathMatchStrategy.full,
                data: utils.doWork()
            },
            { path: 'todomvc', component: TodoMVCComponent, data: { title: extract('Home') } },
            { path: 'compodoc', component: CompodocComponent, data: oneFunction() }
        ]
    }
];
