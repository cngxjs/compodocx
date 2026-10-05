import { Pipe, PipeTransform } from '@angular/core';

/**
 * Uppercase the first letter of the string
 */
@Pipe({
    name: 'firstUpper'
})
export class FirstUpperPipe implements PipeTransform {
    transform(value: string): string {
        return value.charAt(0).toUpperCase() + value.slice(1);
    }
}
