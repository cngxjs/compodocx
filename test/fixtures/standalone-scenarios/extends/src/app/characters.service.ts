import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AbstractService } from './abstract.service';

export interface GameCharacter {
    id: number;
    name: string;
}

@Injectable()
export class CharactersService extends AbstractService {
    private http = inject(HttpClient);

    /**
     * List of characters availables in the game
     */
    characters: GameCharacter[] = [];

    loadCharacters(): Observable<GameCharacter[]> {
        return this.http.get<GameCharacter[]>(`${this.ENDPOINT}gameCharacters`);
    }
}
