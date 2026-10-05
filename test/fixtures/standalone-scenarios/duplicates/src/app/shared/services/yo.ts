import { Injectable } from '@angular/core';

export function LogClass() {
    return (target: unknown) => target;
}

@Injectable({
    providedIn: 'root'
})
@LogClass()
export class MyService {}
