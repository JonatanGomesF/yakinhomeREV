import { supabase } from "../services/supabase";

export const PRODUCT_AVAILABILITY_KEY = "yakinhome_product_availability";
export const PRODUCT_AVAILABILITY_EVENT = "yakinhome-product-availability-updated";

export type ProductAvailabilityMap = Record<number, boolean>;

type ProductAvailabilityRow = {
  product_id: number;
  available: boolean;
};

function notifyProductAvailabilityUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PRODUCT_AVAILABILITY_EVENT));
}

export function getProductAvailability(): ProductAvailabilityMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PRODUCT_AVAILABILITY_KEY);
    return raw ? (JSON.parse(raw) as ProductAvailabilityMap) : {};
  } catch {
    return {};
  }
}

function saveLocalProductAvailability(availability: ProductAvailabilityMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PRODUCT_AVAILABILITY_KEY, JSON.stringify(availability));
  notifyProductAvailabilityUpdated();
}

function rowsToAvailability(rows: ProductAvailabilityRow[]): ProductAvailabilityMap {
  return rows.reduce<ProductAvailabilityMap>((acc, row) => {
    acc[row.product_id] = row.available;
    return acc;
  }, {});
}

export async function fetchProductAvailability(): Promise<ProductAvailabilityMap> {
  try {
    const { data, error } = await supabase
      .from("product_availability")
      .select("product_id, available");

    if (error) throw error;

    const availability = rowsToAvailability(data ?? []);
    saveLocalProductAvailability(availability);
    return availability;
  } catch (error) {
    console.warn("Nao foi possivel carregar estoque do Supabase.", error);
    return getProductAvailability();
  }
}

export async function setProductAvailability(
  productId: number,
  available: boolean
): Promise<ProductAvailabilityMap> {
  const current = getProductAvailability();
  const next = { ...current, [productId]: available };
  saveLocalProductAvailability(next);

  try {
    const { error } = await supabase
      .from("product_availability")
      .upsert(
        { product_id: productId, available, updated_at: new Date().toISOString() },
        { onConflict: "product_id" }
      );

    if (error) throw error;
  } catch (error) {
    console.warn("Nao foi possivel salvar estoque no Supabase.", error);
  }

  return next;
}

export function subscribeProductAvailability(onChange: () => void) {
  const channel = supabase
    .channel("product-availability-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "product_availability" },
      async () => {
        await fetchProductAvailability();
        onChange();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
