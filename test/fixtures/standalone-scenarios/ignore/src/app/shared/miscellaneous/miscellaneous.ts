/**
 * PI constant
 */
export const PI: number = 3.14;

/**
 * @ignore
 */
export let PIT = 4;

/**
 * Directions of the app
 * @ignore
 */
export enum Direction {
    Up,
    Down,
    Left,
    Right
}

/**
 * Todo status
 */
export enum Status {
    Open,
    Done
}

/**
 * @ignore
 */
export type ChartChange = 'creating' | 'created' | 'updating' | 'updated';

/**
 * A documented type alias
 */
export type Name = string;
