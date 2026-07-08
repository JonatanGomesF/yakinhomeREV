import { products, type Product } from "../data/products";

export type MenuCategory = {
  id: string;
  name: string;
  order: number;
};

export type MenuProduct = Product & {
  categoryId: string;
  order: number;
};

export type MenuCatalog = {
  categories: MenuCategory[];
  products: MenuProduct[];
};

const STORAGE_KEY = "yakinhome_menu_catalog";
const DEFAULT_CATEGORY_ID = "yakissobas";

function normalizeCatalog(catalog: MenuCatalog): MenuCatalog {
  return {
    categories: [...catalog.categories].sort((a, b) => a.order - b.order),
    products: [...catalog.products].sort((a, b) => a.order - b.order),
  };
}

export function getDefaultMenuCatalog(): MenuCatalog {
  return normalizeCatalog({
    categories: [{ id: DEFAULT_CATEGORY_ID, name: "Yakissobas", order: 0 }],
    products: products.map((product, index) => ({
      ...product,
      categoryId: DEFAULT_CATEGORY_ID,
      order: index,
    })),
  });
}

export function getMenuCatalog(): MenuCatalog {
  if (typeof localStorage === "undefined") return getDefaultMenuCatalog();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultMenuCatalog();

    const parsed = JSON.parse(raw) as MenuCatalog;
    if (!Array.isArray(parsed.categories) || !Array.isArray(parsed.products)) {
      return getDefaultMenuCatalog();
    }

    return normalizeCatalog(parsed);
  } catch {
    return getDefaultMenuCatalog();
  }
}

export function saveMenuCatalog(catalog: MenuCatalog) {
  const normalized = normalizeCatalog(catalog);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent("yakinhome-menu-catalog-updated"));
  return normalized;
}

export function createCategoryId(name: string) {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `${base || "categoria"}-${Date.now()}`;
}

export function createProductId(catalog: MenuCatalog) {
  const highestId = catalog.products.reduce((max, product) => Math.max(max, product.id), 0);
  return highestId + 1;
}
