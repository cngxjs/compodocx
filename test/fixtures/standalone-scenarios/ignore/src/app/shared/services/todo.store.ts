import { Injectable } from '@angular/core';

import { Todo } from '../models/todo.model';

/**
 * This service is a todo store
 * @ignore
 * See {@link Todo} for details about the main data of this store
 */
@Injectable()
export class TodoStore {
    todos: Array<Todo> = [];
}
