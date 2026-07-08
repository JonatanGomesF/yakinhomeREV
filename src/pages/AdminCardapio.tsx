import { useEffect, useMemo, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import {
  createCategoryId,
  createProductId,
  getMenuCatalog,
  saveMenuCatalog,
  type MenuCatalog,
  type MenuProduct,
} from "../lib/menuCatalog";
import { GripVertical, ImagePlus, Pencil, Plus, Save, Trash2, X } from "lucide-react";

type ProductForm = {
  id: number | null;
  name: string;
  description: string;
  price: string;
  size: string;
  image: string;
  categoryId: string;
};

const emptyForm: ProductForm = {
  id: null,
  name: "",
  description: "",
  price: "",
  size: "",
  image: "",
  categoryId: "yakissobas",
};

function toForm(product: MenuProduct): ProductForm {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: String(product.price),
    size: product.size,
    image: product.image,
    categoryId: product.categoryId,
  };
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items];
  const [removed] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, removed);
  return next;
}

export default function AdminCardapio() {
  const [catalog, setCatalog] = useState<MenuCatalog>(() => getMenuCatalog());
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [categoryName, setCategoryName] = useState("");
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null);
  const [draggedProductId, setDraggedProductId] = useState<number | null>(null);

  useEffect(() => {
    setCatalog(getMenuCatalog());
  }, []);

  const selectedCategory = useMemo(
    () => catalog.categories.find((category) => category.id === form.categoryId) ?? catalog.categories[0],
    [catalog.categories, form.categoryId]
  );

  const persist = (nextCatalog: MenuCatalog) => {
    setCatalog(saveMenuCatalog(nextCatalog));
  };

  const resetForm = () => {
    setForm({ ...emptyForm, categoryId: selectedCategory?.id ?? "yakissobas" });
  };

  const addCategory = () => {
    const name = categoryName.trim();
    if (!name) return;

    const category = {
      id: createCategoryId(name),
      name,
      order: catalog.categories.length,
    };

    persist({ ...catalog, categories: [...catalog.categories, category] });
    setCategoryName("");
  };

  const removeCategory = (categoryId: string) => {
    if (categoryId === "yakissobas") {
      alert("A categoria Yakissobas nao pode ser removida.");
      return;
    }

    const hasProducts = catalog.products.some((product) => product.categoryId === categoryId);
    if (hasProducts && !confirm("Remover esta categoria tambem remove os itens dentro dela. Continuar?")) return;

    persist({
      categories: catalog.categories.filter((category) => category.id !== categoryId).map((category, order) => ({ ...category, order })),
      products: catalog.products.filter((product) => product.categoryId !== categoryId),
    });
  };

  const saveProduct = () => {
    const price = Number(form.price.replace(",", "."));
    if (!form.name.trim() || !form.description.trim() || !form.size.trim() || !form.image || !price || price <= 0) {
      alert("Preencha nome, descricao, preco, tamanho e imagem.");
      return;
    }

    if (form.id) {
      persist({
        ...catalog,
        products: catalog.products.map((product) =>
          product.id === form.id
            ? {
                ...product,
                name: form.name.trim(),
                description: form.description.trim(),
                price,
                size: form.size.trim(),
                image: form.image,
                categoryId: form.categoryId,
              }
            : product
        ),
      });
      resetForm();
      return;
    }

    const productsInCategory = catalog.products.filter((product) => product.categoryId === form.categoryId);
    const newProduct: MenuProduct = {
      id: createProductId(catalog),
      name: form.name.trim(),
      description: form.description.trim(),
      price,
      size: form.size.trim(),
      image: form.image,
      categoryId: form.categoryId,
      order: productsInCategory.length,
    };

    persist({ ...catalog, products: [...catalog.products, newProduct] });
    resetForm();
  };

  const removeProduct = (productId: number) => {
    if (!confirm("Remover este item do cardapio?")) return;
    persist({ ...catalog, products: catalog.products.filter((product) => product.id !== productId) });
    if (form.id === productId) resetForm();
  };

  const handleImageFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({ ...current, image: String(reader.result || "") }));
    };
    reader.readAsDataURL(file);
  };

  const reorderCategories = (targetCategoryId: string) => {
    if (!draggedCategoryId || draggedCategoryId === targetCategoryId) return;

    const fromIndex = catalog.categories.findIndex((category) => category.id === draggedCategoryId);
    const toIndex = catalog.categories.findIndex((category) => category.id === targetCategoryId);
    if (fromIndex < 0 || toIndex < 0) return;

    persist({
      ...catalog,
      categories: moveItem(catalog.categories, fromIndex, toIndex).map((category, order) => ({ ...category, order })),
    });
    setDraggedCategoryId(null);
  };

  const reorderProducts = (targetProductId: number, categoryId: string) => {
    if (!draggedProductId || draggedProductId === targetProductId) return;

    const categoryProducts = catalog.products.filter((product) => product.categoryId === categoryId);
    const otherProducts = catalog.products.filter((product) => product.categoryId !== categoryId);
    const fromIndex = categoryProducts.findIndex((product) => product.id === draggedProductId);
    const toIndex = categoryProducts.findIndex((product) => product.id === targetProductId);
    if (fromIndex < 0 || toIndex < 0) return;

    const reordered = moveItem(categoryProducts, fromIndex, toIndex).map((product, order) => ({ ...product, order }));
    persist({ ...catalog, products: [...otherProducts, ...reordered] });
    setDraggedProductId(null);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="rounded-3xl p-6 border border-white/[0.06] bg-[#141414] shadow-2xl">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-white font-black text-xl tracking-tight">Cardapio</h1>
              <p className="text-white/40 text-xs font-medium mt-2 max-w-2xl">
                Crie categorias, cadastre itens com imagem e arraste para reorganizar a ordem exibida no site.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                placeholder="Nova categoria"
                className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white text-sm outline-none placeholder:text-white/20"
              />
              <button onClick={addCategory} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#c0261a] px-4 py-2.5 text-sm font-black text-white">
                <Plus size={15} />
                Categoria
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-5">
          <div className="rounded-3xl border border-white/[0.06] bg-[#141414] p-5 h-fit">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-white font-black text-lg">{form.id ? "Editar item" : "Novo item"}</h2>
                <p className="text-white/35 text-xs mt-1">Imagem, preco e categoria do produto.</p>
              </div>
              {form.id && (
                <button onClick={resetForm} className="p-2 rounded-xl border border-white/[0.08] text-white/40 hover:text-white">
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Imagem</span>
                <div className="mt-2 rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.03] p-3">
                  {form.image ? (
                    <img src={form.image} alt="Preview" className="w-full h-36 object-cover rounded-xl" />
                  ) : (
                    <div className="h-36 rounded-xl bg-black/20 flex items-center justify-center text-white/25">
                      <ImagePlus size={28} />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => handleImageFile(event.target.files?.[0])}
                    className="mt-3 block w-full text-xs text-white/50 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white"
                  />
                </div>
              </label>

              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nome do item" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm outline-none placeholder:text-white/20" />
              <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Descricao" rows={3} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm outline-none resize-none placeholder:text-white/20" />

              <div className="grid grid-cols-2 gap-3">
                <input value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} placeholder="Preco" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm outline-none placeholder:text-white/20" />
                <input value={form.size} onChange={(event) => setForm({ ...form, size: event.target.value })} placeholder="Tamanho" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm outline-none placeholder:text-white/20" />
              </div>

              <select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} className="w-full bg-[#101010] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm outline-none">
                {catalog.categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>

              <button onClick={saveProduct} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#c0261a] px-4 py-3 text-sm font-black text-white hover:bg-[#d93025]">
                <Save size={16} />
                {form.id ? "Salvar alteracoes" : "Criar item"}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {catalog.categories.map((category) => {
              const categoryProducts = catalog.products.filter((product) => product.categoryId === category.id);

              return (
                <section
                  key={category.id}
                  draggable
                  onDragStart={() => setDraggedCategoryId(category.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => reorderCategories(category.id)}
                  className="rounded-3xl border border-white/[0.06] bg-[#141414] p-4"
                >
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <GripVertical size={16} className="text-white/25 cursor-grab flex-shrink-0" />
                      <div>
                        <h2 className="text-white font-black text-base">{category.name}</h2>
                        <p className="text-white/30 text-xs">{categoryProducts.length} item(ns)</p>
                      </div>
                    </div>
                    <button onClick={() => removeCategory(category.id)} className="p-2 rounded-xl border border-red-500/20 text-red-400/70 hover:text-red-300">
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {categoryProducts.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/[0.08] p-8 text-center text-white/25 text-sm">Nenhum item nesta categoria.</div>
                  ) : (
                    <div className="grid gap-3">
                      {categoryProducts.map((product) => (
                        <div
                          key={product.id}
                          draggable
                          onDragStart={() => setDraggedProductId(product.id)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => reorderProducts(product.id, category.id)}
                          className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-3 flex items-center gap-3"
                        >
                          <GripVertical size={16} className="text-white/25 cursor-grab flex-shrink-0" />
                          <img src={product.image} alt={product.name} className="w-16 h-16 rounded-xl object-cover bg-black/20 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h3 className="text-white font-black text-sm truncate">{product.name}</h3>
                            <p className="text-white/35 text-xs truncate mt-0.5">{product.description}</p>
                            <div className="mt-2 flex items-center gap-2 text-xs text-white/45">
                              <span>R$ {product.price.toFixed(2)}</span>
                              <span>{product.size}</span>
                            </div>
                          </div>
                          <button onClick={() => setForm(toForm(product))} className="p-2 rounded-xl border border-white/[0.08] text-white/45 hover:text-white">
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => removeProduct(product.id)} className="p-2 rounded-xl border border-red-500/20 text-red-400/70 hover:text-red-300">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
