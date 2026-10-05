import { Pipe, PipeTransform } from '@angular/core';

/**
 * Uppercase the first letter of the string
 *
 * @deprecated This pipe is deprecated
 */
@Pipe({
    name: 'firstUpper'
})
export class FirstUpperPipe2 implements PipeTransform {
    /**
     * the transform function
     * @deprecated the transform function is deprecated
     * @param  {string} value the value of the pipe
     */
    transform(value: string): string {
        return value.charAt(0).toUpperCase() + value.slice(1);
    }
}
