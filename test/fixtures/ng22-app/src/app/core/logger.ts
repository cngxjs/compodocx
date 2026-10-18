import { Service } from '@angular/core';

/**
 * Logging contract. The factory supplies the default implementation.
 */
@Service({ factory: () => new ConsoleLogger() })
export abstract class Logger {
    /** Writes one message. */
    abstract log(message: string): void;
}

/**
 * Default logger writing to the console.
 */
export class ConsoleLogger extends Logger {
    log(message: string): void {
        console.log(message);
    }
}
