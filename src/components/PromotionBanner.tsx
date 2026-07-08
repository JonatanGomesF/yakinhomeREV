import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { getMenuCatalog } from "../lib/menuCatalog";

type Promotion = {
  id: number;
  title: string;
  description: string;
  discount: number;
  product_id: number;
  active: boolean;
};

export default function PromotionBanner() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState(() => getMenuCatalog().products);

  useEffect(() => {
    loadPromotions();
    const updateProducts = () => setProducts(getMenuCatalog().products);
    window.addEventListener("storage", updateProducts);
    window.addEventListener("yakinhome-menu-catalog-updated", updateProducts);
    return () => {
      window.removeEventListener("storage", updateProducts);
      window.removeEventListener("yakinhome-menu-catalog-updated", updateProducts);
    };
  }, []);

  async function loadPromotions() {
    const { data } = await supabase
      .from("promotions")
      .select("*")
      .eq("active", true);

    if (data) {
      setPromotions(data);
    }
  }

  if (promotions.length === 0) return null;

  // Duplicate items array to make the marquee flow seamlessly
  const marqueeItems = [...promotions, ...promotions, ...promotions, ...promotions];

  return (
    <div className="relative overflow-hidden py-8 bg-gradient-to-r from-orange-50/50 via-white to-orange-50/50 border-y border-orange-100/30">
      {/* Absolute fades on edges for infinite scroll feel */}
      <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

      <div className="animate-banner flex gap-6 w-max px-6">
        {marqueeItems.map((promotion, idx) => {
          const product = products.find(
            (p) => p.id === promotion.product_id
          );

          return (
            <div
              key={`${promotion.id}-${idx}`}
              className="flex items-center gap-5 px-6 py-4 rounded-2xl bg-white border border-orange-100/60 shadow-md shadow-orange-600/5 min-w-[380px] md:min-w-[450px] hover:border-orange-300 hover:shadow-lg hover:shadow-orange-600/10 transition-all duration-300 cursor-pointer"
            >
              {product && (
                <div className="relative w-20 h-20 rounded-xl overflow-hidden shadow-inner bg-gray-50 flex-shrink-0">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-1 left-1 bg-red-500 text-white font-black text-[9px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shadow-sm">
                    <span>OFF</span>
                  </div>
                </div>
              )}

              <div className="text-gray-900 flex-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-black text-red-500 uppercase tracking-wider bg-red-50 px-2 py-0.5 rounded-full mb-1">
                  🔥 PROMOÇÃO
                </span>

                <h3 className="font-bold text-sm md:text-base text-gray-800 line-clamp-1 leading-snug">
                  {promotion.title}
                </h3>

                <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                  {promotion.description}
                </p>

                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs font-semibold text-gray-400">Economize</span>
                  <span className="font-black text-sm md:text-base text-green-600">
                    R$ {promotion.discount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
