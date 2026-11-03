import { api } from "../lib/api";

export interface Category {
  id: number;
  name: string;
  slug: string;
  parent: number | null;
  order: number;
}

export interface Brand {
  id: number;
  name: string;
  slug: string;
}

export interface Size {
  id: number;
  kind: string;
  kind_label: string;
  name: string;
  order: number;
}

export const referenceService = {
  getCategories: () => api.get<Category[]>("/v1/categories/").then((r) => r.data),
  getBrands: () => api.get<Brand[]>("/v1/brands/").then((r) => r.data),
  getSizes: () => api.get<Size[]>("/v1/sizes/").then((r) => r.data),
};
