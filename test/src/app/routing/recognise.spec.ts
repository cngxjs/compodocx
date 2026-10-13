import { describe, expect, it } from 'vitest';

import { routeArrayDeclarations } from '../../../../src/app/routing';
import { memoryProgram } from './program';

const namesIn = (source: string): readonly string[] => {
    const program = memoryProgram({ '/p/a.ts': source });
    const sourceFile = program.getSourceFile('/p/a.ts');
    return sourceFile ? routeArrayDeclarations(sourceFile).map(d => d.name) : [];
};

describe('route array recognition', () => {
    it('reads a variable annotated with Routes', () => {
        expect(
            namesIn(`import { Routes } from '@angular/router';
export const routes: Routes = [];`)
        ).toEqual(['routes']);
    });

    it('reads Route[], readonly Route[] and Array<Route>', () => {
        expect(
            namesIn(`import type { Route } from '@angular/router';
export const a: Route[] = [];
export const b: readonly Route[] = [];
export const c: Array<Route> = [];`)
        ).toEqual(['a', 'b', 'c']);
    });

    it('reads satisfies and as, and a typed export default', () => {
        expect(
            namesIn(`import { Route, Routes } from '@angular/router';
export const a = [] satisfies Routes;
const b = ([] as Route[]);
export default [{ path: '' }] as Route[];`)
        ).toEqual(['a', 'b', 'default']);
    });

    it('follows an aliased import', () => {
        expect(
            namesIn(`import { Routes as AppRoutes } from '@angular/router';
export const routes: AppRoutes = [];`)
        ).toEqual(['routes']);
    });

    it('follows a namespace import', () => {
        expect(
            namesIn(`import * as ng from '@angular/router';
export const a: ng.Routes = [];
export const b: ng.Route[] = [];`)
        ).toEqual(['a', 'b']);
    });

    it('ignores the same type names from another module and untyped arrays', () => {
        expect(
            namesIn(`import { Routes } from './my-router';
import type { Route } from 'other-router';
export const a: Routes = [];
export const b: Route[] = [];
export const routes = [{ path: '' }];`)
        ).toEqual([]);
    });
});
