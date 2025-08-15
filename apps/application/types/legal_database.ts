export type NationalNormativeDocument = {
    id: string;
    title: string;
    category: string;
    number: string;
    date: number; // Changed from string to number (timestamp)
    id_norma: number;

}

export type ProvinceNormativeDocument = {
    id: string;
    content: string;
    date: number; // Changed from string to number (timestamp)
    documentId: string;
    number: string;
    object?: string;
    title: string;
    type: string;
    url: string;
    province?: string;
}