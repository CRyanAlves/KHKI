export interface Review {
  id: string;
  author: string;
  cleanliness: number;
  structure: number;
  comment: string | null;
  createdAt: string;
}
