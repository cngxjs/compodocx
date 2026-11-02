import { httpResource } from '@angular/common/http';
import {
    afterRenderEffect,
    booleanAttribute,
    Component,
    effect,
    input,
    numberAttribute,
    resource,
    signal
} from '@angular/core';
import { outputFromObservable, rxResource } from '@angular/core/rxjs-interop';
import { interval, of } from 'rxjs';
import { Todo } from '../models/todo.model';

/** Settings the showcase loads over HTTP. */
export interface ShowcaseSettings {
    /** Page size of lists. */
    pageSize: number;
    /** Whether compact rows are used. */
    compact: boolean;
}

/**
 * Covers the member variants of the API tab that the other fixtures leave out:
 * resources, effects, input transforms, outputs from observables, deprecated
 * members, static and protected members, async methods and overloads.
 *
 * @playground Disabled showcase
 * ```html
 * <app-api-showcase [disabled]="false" pageSize="20" />
 * ```
 */
@Component({
    selector: 'app-api-showcase',
    template: '<p>{{ label() }}</p>',
    styleUrls: ['./api-showcase.component.scss', './api-showcase.tokens.css']
})
export class ApiShowcaseComponent {
    /** Default page size of every showcase instance. */
    static readonly DEFAULT_PAGE_SIZE = 10;

    /** Disables the showcase; accepts the bare attribute. */
    readonly disabled = input(false, { transform: booleanAttribute });

    /** Rows per page; accepts a string attribute. */
    readonly pageSize = input(ApiShowcaseComponent.DEFAULT_PAGE_SIZE, {
        transform: numberAttribute
    });

    /** Emits once a second while the showcase is shown. */
    readonly tick = outputFromObservable(interval(1000));

    /** Id of the todo the resources load. */
    readonly todoId = signal(1);

    /** The todo with the current id, loaded with `resource()`. */
    readonly todo = resource<Todo, number>({
        params: () => this.todoId(),
        loader: ({ params }) => fetch(`/api/todos/${params}`).then(r => r.json())
    });

    /** The same todo, loaded with `rxResource()`. */
    readonly todo$ = rxResource<Todo, number>({
        params: () => this.todoId(),
        stream: ({ params }) => of({ id: params } as unknown as Todo)
    });

    /** Settings loaded with `httpResource()`. */
    readonly settings = httpResource<ShowcaseSettings>(() => '/api/settings');

    /** Logs every id change. */
    readonly logId = effect(() => console.log(this.todoId()));

    /** Measures the rendered list after each render. */
    readonly measure = afterRenderEffect(() => this.todoId());

    /**
     * Label shown in the template.
     *
     * @deprecated Use `title` of the loaded todo instead.
     */
    readonly label = signal('Showcase');

    /** Counter only subclasses read. */
    protected readonly renders = signal(0);

    /**
     * Saves the current todo.
     *
     * @param force - Saves even without changes.
     * @returns The saved todo.
     * @throws {Error} When no todo is loaded.
     */
    async save(force = false): Promise<Todo> {
        const todo = this.todo.value();
        if (!todo) {
            throw new Error('No todo loaded');
        }
        return force ? todo : { ...todo };
    }

    /**
     * Reloads the todos.
     *
     * @deprecated Call `todo.reload()` directly.
     */
    reload(): void {
        this.todo.reload();
    }

    /** Selects a todo by id. */
    select(id: number): void;
    /** Selects a todo. */
    select(todo: Todo): void;
    select(target: number | Todo): void {
        this.todoId.set(typeof target === 'number' ? target : target.id);
    }

    /**
     * Formats a value for the label.
     *
     * @param value - The value.
     * @param options - Formatting options.
     * @returns The formatted text.
     */
    static format<T extends { toString(): string }>(
        value: T,
        options: { readonly upper?: boolean } = {}
    ): string {
        const text = value.toString();
        return options.upper ? text.toUpperCase() : text;
    }
}
