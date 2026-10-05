import { Injectable } from '@angular/core';

import { Todo } from '../models/todo.model';

/**
 * This service is a todo store
 * See {@link Todo} for details about the main data of this store
 * @deprecated This service is deprecated
 */
@Injectable()
export class TodoStore {
    /**
     *  Local array of Todos
     *  See {@link Todo}
     */
    todos: Array<Todo> = [];

    /**
     *  Get all todos
     * @returns {Array} All todos
     * @deprecated This current API is deprecated
     */
    getThemAll() {
        return this.todos;
    }

    /**
     *  Get completed todos
     * @returns {Array} All completed todos
     */
    getCompleted() {
        return this.todos.filter(todo => todo.completed);
    }
}
