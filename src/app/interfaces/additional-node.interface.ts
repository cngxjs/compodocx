export interface AdditionalNode {
    title?: string;
    slug?: string;
    label?: string;
    heading?: boolean;
    aliases?: string[];
    file: string;
    children: AdditionalNode[];
}
