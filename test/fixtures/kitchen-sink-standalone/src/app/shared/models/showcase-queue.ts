/**
 * Base of the showcase queues: a plain class with a constructor, an abstract
 * method, an index signature and overloads.
 */
export abstract class ShowcaseQueueBase<T> {
    /** Extra values by key. */
    [key: string]: unknown;

    /**
     * @param capacity - Maximum number of items.
     * @param name - Name in log lines.
     */
    constructor(
        protected readonly capacity: number,
        readonly name = 'queue'
    ) {}

    /** Takes the next item, or `undefined` when empty. */
    abstract take(): T | undefined;
}

/** First-in, first-out queue of the showcase. */
export class ShowcaseQueue<T> extends ShowcaseQueueBase<T> {
    private readonly items: T[] = [];

    /** Number of queued items. */
    get size(): number {
        return this.items.length;
    }

    /**
     * Adds items.
     *
     * @param items - Items to add.
     * @returns Whether every item fit.
     */
    put(...items: T[]): boolean {
        const room = this.capacity - this.items.length;
        this.items.push(...items.slice(0, room));
        return items.length <= room;
    }

    take(): T | undefined {
        return this.items.shift();
    }
}

/** Registry of named showcase queues; built with `create()` only. */
export class ShowcaseRegistry {
    private readonly queues = new Map<string, ShowcaseQueue<unknown>>();

    private constructor() {}

    /** Creates an empty registry. */
    static create(): ShowcaseRegistry {
        return new ShowcaseRegistry();
    }

    /**
     * Queue registered under a name.
     *
     * @param name - Name of the queue.
     */
    get(name: string): ShowcaseQueue<unknown> | undefined {
        return this.queues.get(name);
    }
}
