import { Component, inject, input } from '@angular/core';
import { NgIf } from '@angular/common';

import { Todo } from '../../shared/models/todo.model';

import { TodoStore } from '../../shared/services/todo.store';
import { DoNothingDirective } from 'app/shared/directives/do-nothing.directive';
import { FirstUpperPipe } from 'app/shared/pipes/first-upper.pipe';

/**
 * The todo component
 * ```html
 * <todo>
 *    [todo]="todo"
 * </todo>
 * ```
 *
 * <example-url>/demo/mysample.component.html</example-url>
 */
@Component({
    selector: 'todo',
    templateUrl: './todo.component.html',
    imports: [NgIf, DoNothingDirective, FirstUpperPipe]
})
export class TodoComponent {
    /**
     * The entry todo from the parent list
     */
    todo = input.required<Todo>();

    unionVariable: string[] | Todo;

    public filter(term: string, fields?: (string | number)[]): void;

    /**
     * Local reference of TodoStore
     */
    todoStore = inject(TodoStore);

    remove(todo: Todo) {
        this.todoStore.remove(todo);
    }

    toggleCompletion(todo: Todo) {
        this.todoStore.toggleCompletion(todo);
    }

    editTodo(todo: Todo) {
        todo.editing = true;
    }

    stopEditing(todo: Todo, editedTitle: string) {
        todo.title = editedTitle;
        todo.editing = false;
    }

    cancelEditingTodo(todo: Todo) {
        todo.editing = false;
    }

    updateEditingTodo(todo: Todo, editedTitle: string) {
        editedTitle = editedTitle.trim();
        todo.editing = false;

        if (editedTitle.length === 0) {
            return this.todoStore.remove(todo);
        }

        todo.title = editedTitle;

        this.todoStore.update();
    }
}
