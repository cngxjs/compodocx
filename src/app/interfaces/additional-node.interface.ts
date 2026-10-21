export interface AdditionalNode {
    title: string;
    slug?: string;
    file: string;
    children: AdditionalNode[];
}
