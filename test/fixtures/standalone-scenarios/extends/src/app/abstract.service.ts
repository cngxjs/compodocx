import { Injectable } from '@angular/core';

const API_ENDPOINT = 'localhost:8080/';

@Injectable()
export abstract class AbstractService {
    protected ENDPOINT = `https://${API_ENDPOINT}`;
    protected WS_ENDPOINT = `wss://${API_ENDPOINT}front`;

    parentProperty: string;

    protected handleError(error: unknown): Promise<string> {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error(errMsg);
        return Promise.reject(errMsg);
    }
}
