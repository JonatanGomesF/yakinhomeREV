import { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import type { Product } from "../data/products";
import { getMenuCatalog } from "../lib/menuCatalog";
import {
  fetchProductAvailability,
  getProductAvailability,
  PRODUCT_AVAILABILITY_EVENT,
  setProductAvailability,
  subscribeProductAvailability,
} from "../lib/productAvailability";
import { ToggleLeft, ToggleRight } from "lucide-react";

export default function AdminProdutos() {
  const [availability, setAvailability] = useState<Record<number, boolean>>({});
  const [products, setProducts] = useState(() => getMenuCatalog().products);
  const [savingProductId, setSavingProductId] = useState<number | null>(null);

  useEffect(() => {
    setAvailability(getProductAvailability());
    fetchProductAvailability().then(setAvailability);

    const updateProducts = () => setProducts(getMenuCatalog().products);
    const updateAvailability = () => setAvailability(getProductAvailability());
    const unsubscribeAvailability = subscribeProductAvailability(updateAvailability);

    window.addEventListener("storage", updateProducts);
    window.addEventListener("storage", updateAvailability);
    window.addEventListener("yakinhome-menu-catalog-updated", updateProducts);
    window.addEventListener(PRODUCT_AVAILABILITY_EVENT, updateAvailability);

    return () => {
      window.removeEventListener("storage", updateProducts);
      window.removeEventListener("storage", updateAvailability);
      window.removeEventListener("yakinhome-menu-catalog-updated", updateProducts);
      window.removeEventListener(PRODUCT_AVAILABILITY_EVENT, updateAvailability);
      unsubscribeAvailability();
    };
  }, []);

  const toggleAvailability = async (product: Product) => {
    const nextState = !(availability[product.id] !== false);
    setSavingProductId(product.id);
    const nextAvailability = await setProductAvailability(product.id, nextState);
    setAvailability(nextAvailability);
    setSavingProductId(null);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="rounded-3xl p-6 border border-white/[0.06] bg-[#141414] shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-white font-black text-xl tracking-tight">Estoque</h1>
              <p className="text-white/40 text-xs font-medium mt-2 max-w-2xl">
                Pause e despausa produtos individuais para mostrar aos clientes quais itens estão esgotados.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          {products.map((product) => {
            const isAvailable = availability[product.id] !== false;
            return (
              <div
                key={product.id}
                className="rounded-3xl border border-white/[0.06] bg-white/5 p-4 flex flex-col md:flex-row items-center gap-4"
              >
                <div className="w-full md:w-32 h-24 rounded-3xl overflow-hidden bg-gray-900 border border-white/[0.08] flex-shrink-0">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-white font-black text-base leading-snug">{product.name}</h2>
                      <p className="text-white/40 text-sm mt-1 truncate">{product.description}</p>
                    </div>
                    <span className="text-sm font-black text-white/70">{product.size}</span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-white/60">
                      R$ {product.price.toFixed(2)}{product.promotionalPrice ? ` • Promo: R$ ${product.promotionalPrice.toFixed(2)}` : ""}
                    </span>
                    {!isAvailable && (
                      <span className="inline-flex items-center rounded-full bg-red-600/15 text-red-300 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em]">
                        ESGOTADO
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => toggleAvailability(product)}
                  disabled={savingProductId === product.id}
                  className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition-all duration-200 ${
                    isAvailable
                      ? "bg-white/10 text-white border border-white/[0.08] hover:bg-white/15"
                      : "bg-red-600/15 text-red-100 border border-red-500/20 hover:bg-red-600/10"
                  } disabled:cursor-wait disabled:opacity-60`}
                >
                  {isAvailable ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
                  {savingProductId === product.id ? "Salvando..." : isAvailable ? "Pausar" : "Liberar"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
}
