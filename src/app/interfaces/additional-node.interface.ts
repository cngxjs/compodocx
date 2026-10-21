export interface AdditionalNode {
    title?: string;
    slug?: string;
    label?: string;
    heading?: boolean;
    file: string;
    children: AdditionalNode[];
}
