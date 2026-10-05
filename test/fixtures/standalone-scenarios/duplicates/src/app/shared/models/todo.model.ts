export class Tada {}

/**
 * The todo class
 * See {@link TodoStore} for service using it
 */
export class Todo extends Tada {
    /**
     * Completed status
     */
    completed: boolean;
    /**
     * Editing status
     */
    editing: boolean;
}
