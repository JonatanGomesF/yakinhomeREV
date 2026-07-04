import { useEffect, useState, useRef } from "react";
import { supabase } from "../services/supabase";
import { printUsbText } from "../services/usbPrinter";
import AdminLayout from "../components/AdminLayout";
import {
  RefreshCw,
  Search,
  ChevronDown,
  Eye,
  Trash2,
  X,
  Clock,
  Phone,
  MapPin,
  CreditCard,
  Package,
  LayoutGrid,
  List,
  ChefHat,
  Truck,
  CheckCircle,
  XCircle,
} from "lucide-react";

type OrderItem = {
  name: string;
  size?: string;
  quantity: number;
  price: number;
  extras?: Array<{ name: string; price: number }>;
  observation?: string;
};
type Order = {
  id: number;
  customer_name: string;
  customer_phone: string;
  street: string;
  number: string;
  district: string;
  items: OrderItem[];
  total: number;
  payment_method: string;
  change_for: number | null;
  status: string;
  notes: string;
  created_at: string;
};

const STATUSES = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendentes" },
  { value: "preparing", label: "Preparando" },
  { value: "delivery", label: "Em entrega" },
  { value: "delivered", label: "Entregues" },
  { value: "cancelled", label: "Cancelados" },
];

const STATUS_META: Record<string, { label: string; color: string; next?: string; nextLabel?: string }> = {
  pending: { label: "Pendente", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20", next: "preparing", nextLabel: "Preparar" },
  preparing: { label: "Preparando", color: "bg-blue-500/15 text-blue-400 border-blue-500/20", next: "delivery", nextLabel: "Entregar" },
  delivery: { label: "Em entrega", color: "bg-purple-500/15 text-purple-400 border-purple-500/20", next: "delivered", nextLabel: "Entregue" },
  delivered: { label: "Entregue", color: "bg-green-500/15 text-green-400 border-green-500/20" },
  cancelled: { label: "Cancelado", color: "bg-red-500/15 text-red-400 border-red-500/20" },
};

const KANBAN_COLUMNS = [
  { value: "pending", label: "Pendente", color: "border-yellow-500/15 bg-yellow-500/[0.02]", iconColor: "text-yellow-400" },
  { value: "preparing", label: "Preparo", color: "border-blue-500/15 bg-blue-500/[0.02]", iconColor: "text-blue-400" },
  { value: "delivery", label: "Entrega", color: "border-purple-500/15 bg-purple-500/[0.02]", iconColor: "text-purple-400" },
  { value: "delivered", label: "Entregue", color: "border-green-500/15 bg-green-500/[0.02]", iconColor: "text-green-400" },
  { value: "cancelled", label: "Cancelado", color: "border-red-500/15 bg-red-500/[0.02]", iconColor: "text-red-400" },
];

const playBeep = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.error("Erro ao tocar beep:", e);
  }
};

const STAGE_DURATIONS: Record<string, number> = {
  pending: 10 * 60,    // seconds (example 10 minutes)
  preparing: 50 * 60,  // seconds (SLA 50 minutes)
  delivery: 25 * 60,   // seconds (default 25 minutes)
};

const speakAlert = () => {
  try {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance("Novo pedido YakinHome");
      utterance.lang = "pt-BR";
      utterance.rate = 1.0;
      utterance.pitch = 1.1;
      window.speechSynthesis.speak(utterance);
    }
  } catch (e) {
    console.error("Erro na narração:", e);
  }
};

const STATUS_ICONS: Record<string, React.ComponentType<any>> = {
  pending: Clock,
  preparing: ChefHat,
  delivery: Truck,
  delivered: CheckCircle,
  cancelled: XCircle,
};

function money(value: number) {
  return `R$ ${Number(value || 0).toFixed(2)}`;
}

function formatOrderReceipt(order: Order) {
  const createdAt = order.created_at ? new Date(order.created_at) : new Date();
  const lines = [
    "YAKINHOME",
    "NOVO PEDIDO",
    "------------------------------",
    `Pedido: #${order.id}`,
    `Data: ${createdAt.toLocaleString("pt-BR")}`,
    "",
    `Cliente: ${order.customer_name}`,
    `WhatsApp: ${order.customer_phone}`,
    `Endereco: ${order.street}, ${order.number}`,
  ];

  if (order.district) lines.push(`Bairro: ${order.district}`);

  lines.push("", "ITENS", "------------------------------");

  (order.items ?? []).forEach((item) => {
    lines.push(`${item.quantity}x ${item.name}${item.size ? ` (${item.size})` : ""}`);

    if (item.extras?.length) {
      item.extras.forEach((extra) => {
        lines.push(`  + ${extra.name} ${money(extra.price)}`);
      });
    }

    if (item.observation) lines.push(`  Obs: ${item.observation}`);
    lines.push(`  Subtotal: ${money(item.price * item.quantity)}`, "");
  });

  lines.push("------------------------------");
  lines.push(`Pagamento: ${order.payment_method}`);
  if (order.change_for) lines.push(`Troco para: ${money(order.change_for)}`);
  if (order.notes) lines.push(`Obs gerais: ${order.notes}`);
  lines.push(`TOTAL: ${money(order.total)}`);
  lines.push("------------------------------", "");

  return lines.join("\n");
}

export default function AdminPedidos() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selected, setSelected] = useState<Order | null>(null);
  const [updating, setUpdating] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const printedOrderIdsRef = useRef<Set<number>>(new Set());
  const hasLoadedInitialOrdersRef = useRef(false);

  const notifyNewOrder = (order: Order) => {
    if (printedOrderIdsRef.current.has(order.id)) return;

    printedOrderIdsRef.current.add(order.id);
    playBeep();
    speakAlert();
    printUsbText(formatOrderReceipt(order)).catch((error) => {
      console.error("Erro ao imprimir pedido:", error);
    });
  };

  const load = async (options?: { notifyNewOrders?: boolean }) => {
    setLoading(true);
    let q = supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(100);
    if (viewMode === "table" && filterStatus !== "all") q = q.eq("status", filterStatus);
    const { data } = await q;
    const loadedOrders = data ?? [];
    setOrders(loadedOrders);

    if (!hasLoadedInitialOrdersRef.current) {
      loadedOrders.forEach((order) => printedOrderIdsRef.current.add(order.id));
      hasLoadedInitialOrdersRef.current = true;
    } else if (options?.notifyNewOrders) {
      loadedOrders
        .filter((order) => !printedOrderIdsRef.current.has(order.id))
        .reverse()
        .forEach(notifyNewOrder);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [filterStatus, viewMode]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      load({ notifyNewOrders: true });
    }, 8000);

    return () => window.clearInterval(interval);
  }, [filterStatus, viewMode]);

  useEffect(() => {
    const channel = supabase
      .channel("realtime-orders-v2")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newOrder = payload.new as Order;
            setOrders((prev) => {
              if (prev.some((o) => o.id === newOrder.id)) return prev;
              return [newOrder, ...prev];
            });
            notifyNewOrder(newOrder);
            // if the new order starts in a timed stage, schedule it
            if (STAGE_DURATIONS[newOrder.status]) scheduleAutoProgress(newOrder.id, newOrder.status);
          } else if (payload.eventType === "UPDATE") {
            const updatedOrder = payload.new as Order;
            setOrders((prev) =>
              prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
            );
            setSelected((prev) => prev && prev.id === updatedOrder.id ? updatedOrder : prev);
            // if updated to a timed stage, schedule timer from now
            if (STAGE_DURATIONS[updatedOrder.status]) scheduleAutoProgress(updatedOrder.id, updatedOrder.status);
          } else if (payload.eventType === "DELETE") {
            const deletedId = payload.old.id;
            setOrders((prev) => prev.filter((o) => o.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateStatus = async (id: number, newStatus: string, opts?: { autoschedule?: boolean }) => {
    setUpdating(id);
    // Clear any previously scheduled timers for this order if the target stage has no duration
    if (!STAGE_DURATIONS[newStatus]) {
      clearScheduled(id);
    }

    await supabase.from("orders").update({ status: newStatus }).eq("id", id);
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: newStatus } : o));
    if (selected?.id === id) setSelected((prev) => prev ? { ...prev, status: newStatus } : prev);

    // If requested, schedule automatic progression for this order
    if (opts?.autoschedule || STAGE_DURATIONS[newStatus]) {
      scheduleAutoProgress(id, newStatus);
    }

    setUpdating(null);
  };

  // Scheduling helpers for auto-advancing stages with timers
  const timeoutsRef = useRef<Record<number, number[]>>({});
  const [stageEndTimes, setStageEndTimes] = useState<Record<number, number>>({});

  const clearScheduled = (id: number) => {
    const arr = timeoutsRef.current[id];
    if (arr) {
      arr.forEach((t) => clearTimeout(t));
      delete timeoutsRef.current[id];
    }
    setStageEndTimes((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const scheduleAutoProgress = (id: number, fromStatus: string) => {
    clearScheduled(id);
    const durationSec = STAGE_DURATIONS[fromStatus];
    if (!durationSec || durationSec <= 0) return;
    const now = Date.now();
    const ms = durationSec * 1000;
    setStageEndTimes((prev) => ({ ...prev, [id]: now + ms }));

    const t = window.setTimeout(async () => {
      const next = STATUS_META[fromStatus]?.next;
      if (next) {
        await updateStatus(id, next);
        // schedule next stage if it has a duration
        scheduleAutoProgress(id, next);
      } else {
        clearScheduled(id);
      }
    }, ms);

    timeoutsRef.current[id] = [t];
  };

  // keep a ticking state to refresh countdown displays
  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);

  const formatRemaining = (id: number) => {
    const end = stageEndTimes[id];
    if (!end) return null;
    const diff = Math.max(0, Math.round((end - Date.now()) / 1000));
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    return `${m}m ${s.toString().padStart(2, "0")}s`;
  };

  const cancelOrder = async (id: number) => {
    if (!confirm("Cancelar este pedido?")) return;
    await updateStatus(id, "cancelled");
  };

  const deleteOrder = async (id: number) => {
    if (!confirm("Excluir este pedido? Esta ação é irreversível.")) return;
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) {
      alert("Erro ao excluir pedido: " + error.message);
      return;
    }
    clearScheduled(id);
    setOrders((prev) => prev.filter((o) => o.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const filtered = orders.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return o.customer_name.toLowerCase().includes(q) || o.customer_phone.includes(q) || String(o.id).includes(q);
  });

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white font-black text-xl tracking-tight">Painel de Pedidos</h1>
          <p className="text-white/30 text-xs font-medium mt-0.5">{orders.length} pedido(s) carregados</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggler de Visualização */}
          <div className="bg-white/[0.04] p-1 rounded-xl border border-white/[0.08] flex items-center gap-1">
            <button
              onClick={() => setViewMode("kanban")}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${viewMode === "kanban"
                  ? "bg-[#c0261a] text-white shadow-md shadow-red-900/30"
                  : "text-white/40 hover:text-white/70"
                }`}
              title="Visualização Kanban"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${viewMode === "table"
                  ? "bg-[#c0261a] text-white shadow-md shadow-red-900/30"
                  : "text-white/40 hover:text-white/70"
                }`}
              title="Visualização Lista"
            >
              <List size={15} />
            </button>
          </div>

          <button onClick={() => load()} className="p-2 rounded-xl border border-white/[0.08] text-white/40 hover:text-white hover:border-white/20 transition-all cursor-pointer">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por ID, nome ou telefone..."
            className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-[#c0261a]/50 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm outline-none transition-all placeholder:text-white/20"
          />
        </div>

        {/* Status filter (Apenas no modo tabela) */}
        {viewMode === "table" && (
          <div className="relative">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl pl-4 pr-8 py-2.5 text-white text-sm outline-none cursor-pointer"
            >
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
          </div>
        )}
      </div>

      {/* Kanban Board */}
      {viewMode === "kanban" ? (
        <div className="flex gap-4 overflow-x-auto pb-4 select-none scrollbar-thin scrollbar-thumb-white/10" style={{ height: "calc(100vh - 220px)", minHeight: "550px" }}>
          {KANBAN_COLUMNS.map((col) => {
            const colOrders = filtered.filter((o) => o.status === col.value);
            return (
              <div
                key={col.value}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const orderId = parseInt(e.dataTransfer.getData("orderId"));
                  if (orderId) updateStatus(orderId, col.value, { autoschedule: col.value === "preparing" });
                }}
                className={`flex-1 min-w-[280px] max-w-[320px] rounded-2xl border p-4 flex flex-col gap-3 ${col.color} transition-colors duration-200`}
              >
                {/* Header da coluna */}
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.05]">
                  <span className="text-white text-[11px] font-black uppercase tracking-wider flex items-center gap-2">
                    {(() => {
                      const ColIcon = STATUS_ICONS[col.value] || Clock;
                      return <ColIcon size={12} className={col.iconColor} />;
                    })()}
                    {col.label}
                  </span>
                  <span className="text-white/40 text-[10px] font-bold bg-white/[0.04] px-2.5 py-0.5 rounded-full">
                    {colOrders.length}
                  </span>
                </div>

                {/* Cards Container */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-white/5">
                  {colOrders.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-white/15 text-xs py-12 text-center">
                      <Package size={20} className="opacity-10 mb-1" />
                      Sem pedidos
                    </div>
                  ) : (
                    colOrders.map((order) => {
                      const meta = STATUS_META[order.status];
                      return (
                        <div
                          key={order.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("orderId", order.id.toString());
                          }}
                          className="bg-[#141414] border border-white/[0.05] hover:border-white/15 rounded-xl p-3.5 space-y-2.5 transition-all active:scale-[0.98] cursor-grab active:cursor-grabbing hover:shadow-lg hover:shadow-black/30 group"
                        >
                          {/* Header do Card */}
                          <div className="flex items-center justify-between">
                            <span className="text-white/60 font-mono text-[10px] font-bold group-hover:text-white">#{order.id}</span>
                            <span className="text-white/30 text-[9px] font-semibold">
                              {new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>

                          {/* Cliente Info */}
                          <div>
                            <div className="text-white font-bold text-xs truncate">{order.customer_name}</div>
                            <div className="text-white/40 text-[10px] mt-0.5 truncate">
                              {order.street}, {order.number}
                            </div>
                          </div>

                          {/* Preço e Pagamento */}
                          <div className="flex items-center justify-between border-t border-white/[0.03] pt-2">
                            <div className="text-[#c0261a] font-black text-xs">
                              R$ {Number(order.total).toFixed(2)}
                            </div>
                            <div className="text-white/40 text-[9px] font-bold">
                              {order.payment_method}
                            </div>
                          </div>

                          {STAGE_DURATIONS[order.status] && formatRemaining(order.id) && (
                            <div className="text-white/40 text-[11px] mt-1 font-mono">{formatRemaining(order.id)}</div>
                          )}

                          {/* Ações Rápidas */}
                          <div className="flex items-center gap-1.5 pt-1">
                            <button
                              onClick={() => setSelected(order)}
                              className="p-1.5 rounded-lg border border-white/[0.08] text-white/40 hover:text-white hover:border-white/20 transition-all cursor-pointer flex items-center justify-center flex-shrink-0"
                              title="Ver Detalhes"
                            >
                              <Eye size={12} />
                            </button>

                            {/* Botão único para avançar etapa (Preparar → Entrega → Entregue) */}
                            <div className="flex-1">
                              {STAGE_DURATIONS[order.status] ? (
                                <button
                                  onClick={() => updateStatus(order.id, meta.next ?? "", { autoschedule: true })}
                                  disabled={updating === order.id || !meta.next}
                                  className="w-full px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-black hover:bg-red-700 border border-red-700 animate-pulse transition-all disabled:opacity-50"
                                  title={meta.next ? `Tempo restante — clique para ${meta.nextLabel}` : "Tempo restante"}
                                >
                                  {formatRemaining(order.id) ?? `${Math.floor(STAGE_DURATIONS[order.status]/60)}m 00s`}
                                </button>
                              ) : meta.next ? (
                                <button
                                  onClick={() => updateStatus(order.id, meta.next!, { autoschedule: meta.next === "preparing" })}
                                  disabled={updating === order.id}
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] text-white text-[10px] font-bold transition-all disabled:opacity-50"
                                >
                                  {updating === order.id ? "..." : meta.nextLabel}
                                </button>
                              ) : (
                                <div className="w-full text-white/40 text-[10px]">{meta.label}</div>
                              )}
                            </div>
                            <button
                              onClick={() => deleteOrder(order.id)}
                              className="p-1.5 rounded-lg border border-red-500/20 text-red-400/60 hover:text-red-400 hover:border-red-500/40 transition-all cursor-pointer flex-shrink-0"
                              title="Excluir pedido"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Visualização em Tabela */
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {["#", "Cliente", "Telefone", "Total", "Pagamento", "Status", "Hora", "Ações"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-white/30 text-[10px] font-black uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center text-white/25 py-12 text-sm">Carregando...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center text-white/25 py-12 text-sm">Nenhum pedido encontrado</td></tr>
                ) : filtered.map((order) => {
                  const meta = STATUS_META[order.status] ?? STATUS_META.pending;
                  return (
                    <tr
                      key={order.id}
                      className="border-b last:border-0 hover:bg-white/[0.025] transition-colors"
                      style={{ borderColor: "rgba(255,255,255,0.04)" }}
                    >
                      <td className="px-4 py-3 text-white/40 text-xs font-mono">#{order.id}</td>
                      <td className="px-4 py-3 text-white font-semibold">{order.customer_name}</td>
                      <td className="px-4 py-3">
                        <a href={`https://wa.me/55${order.customer_phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                          className="text-green-400 text-xs font-medium hover:underline">
                          {order.customer_phone}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-white font-black">R$ {Number(order.total).toFixed(2)}</td>
                      <td className="px-4 py-3 text-white/50 text-xs">{order.payment_method}</td>
                      <td className="px-4 py-3">
                        <div>
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${meta.color}`}>{meta.label}</span>
                          {formatRemaining(order.id) && (
                            <div className="text-white/40 text-[10px] mt-1">{formatRemaining(order.id)}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white/30 text-xs">
                        {new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setSelected(order)}
                            className="p-1.5 rounded-lg border border-white/[0.08] text-white/40 hover:text-white hover:border-white/20 transition-all cursor-pointer"
                          >
                            <Eye size={13} />
                          </button>
                          {meta.next && (
                            <button
                              onClick={() => updateStatus(order.id, meta.next!, { autoschedule: meta.next === "preparing" })}
                              disabled={updating === order.id}
                              className="px-2.5 py-1.5 rounded-lg bg-[#c0261a]/10 border border-[#c0261a]/20 text-[#c0261a] text-[10px] font-bold hover:bg-[#c0261a]/20 transition-all cursor-pointer disabled:opacity-50"
                            >
                              {updating === order.id ? "..." : meta.nextLabel}
                            </button>
                          )}
                          {order.status !== "cancelled" && order.status !== "delivered" && (
                            <button
                              onClick={() => cancelOrder(order.id)}
                              className="p-1.5 rounded-lg border border-red-500/20 text-red-400/60 hover:text-red-400 hover:border-red-500/40 transition-all cursor-pointer"
                            >
                              <X size={13} />
                            </button>
                          )}
                          <button
                            onClick={() => deleteOrder(order.id)}
                            className="p-1.5 rounded-lg border border-red-500/20 text-red-400/60 hover:text-red-400 hover:border-red-500/40 transition-all cursor-pointer"
                            title="Excluir pedido"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal de detalhes ── */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div
            className="w-full max-w-md rounded-2xl p-6 space-y-4 relative max-h-[90vh] overflow-y-auto"
            style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.08)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setSelected(null)} className="absolute top-4 right-4 text-white/30 hover:text-white cursor-pointer">
              <X size={18} />
            </button>

            <div className="flex items-center justify-between pr-6">
              <h2 className="text-white font-black text-base">Pedido #{selected.id}</h2>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${STATUS_META[selected.status]?.color}`}>
                {STATUS_META[selected.status]?.label}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <InfoRow icon={<Package size={13} />} label={selected.customer_name} />
              <InfoRow icon={<Phone size={13} />} label={selected.customer_phone} />
              <InfoRow icon={<MapPin size={13} />} label={`${selected.street}, ${selected.number}${selected.district ? ` — ${selected.district}` : ""}`} />
              <InfoRow icon={<CreditCard size={13} />} label={selected.payment_method + (selected.change_for ? ` (troco p/ R$${selected.change_for})` : "")} />
              <InfoRow icon={<Clock size={13} />} label={new Date(selected.created_at).toLocaleString("pt-BR")} />
            </div>

            <div className="border-t border-white/[0.07] pt-3">
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-2">Itens</p>
              <div className="space-y-1.5">
                {(selected.items ?? []).map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-white/70">{item.quantity}× {item.name}{item.size ? ` (${item.size})` : ""}</span>
                    <span className="text-white font-semibold">R$ {(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/[0.07]">
              <span className="text-white/40 text-xs font-bold uppercase">Total</span>
              <span className="text-white font-black text-lg">R$ {Number(selected.total).toFixed(2)}</span>
            </div>

            {/* Alterar status do pedido */}
            <div className="border-t border-white/[0.07] pt-3.5 space-y-1.5">
              <label className="text-white/40 text-[10px] font-bold uppercase tracking-wider block">Status do Pedido</label>
              {(() => {
                const meta = STATUS_META[selected.status] ?? STATUS_META.pending;
                if (STAGE_DURATIONS[selected.status]) {
                  return (
                    <button
                      onClick={() => updateStatus(selected.id, STATUS_META[selected.status]?.next ?? "", { autoschedule: true })}
                      disabled={updating === selected.id || !STATUS_META[selected.status]?.next}
                      className="w-full px-3 py-2 rounded-lg bg-red-600 text-white text-lg font-black hover:bg-red-700 border border-red-700 animate-pulse disabled:opacity-50"
                    >
                      {formatRemaining(selected.id) ?? `${Math.floor(STAGE_DURATIONS[selected.status]/60)}m 00s`}
                    </button>
                  );
                }

                return meta.next ? (
                  <button
                    onClick={() => updateStatus(selected.id, meta.next!, { autoschedule: meta.next === "preparing" })}
                    disabled={updating === selected.id}
                    className="w-full px-3 py-2 rounded-lg bg-[#c0261a]/10 border border-[#c0261a]/20 text-[#c0261a] font-bold hover:bg-[#c0261a]/20 disabled:opacity-50"
                  >
                    {updating === selected.id ? "..." : meta.nextLabel}
                  </button>
                ) : (
                  <div className="text-white/40">{meta.label}</div>
                );
              })()}
              {formatRemaining(selected.id) && (
                <div className="text-white/40 text-sm mt-2">Tempo restante: {formatRemaining(selected.id)}</div>
              )}
              <div className="pt-3">
                <button
                  onClick={() => deleteOrder(selected.id)}
                  className="w-full px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 font-bold hover:bg-red-500/20 transition-colors"
                >
                  Excluir pedido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function InfoRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-start gap-2.5 text-white/60">
      <span className="text-white/25 mt-0.5 flex-shrink-0">{icon}</span>
      <span className="text-sm">{label}</span>
    </div>
  );
}
