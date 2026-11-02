/** The visible text of generated markup: tags removed, entities kept. */
export const textOf = (html: string): string => html.replace(/<[^>]+>/g, '');
