import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import AdminLayout from "../components/AdminLayout";
import RevenueGraph from "../components/RevenueGraph";
import {
  ShoppingBag,
  Users,
  TrendingUp,
  Tag,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Clock,
} from "lucide-react";

type DayRevenue = { day: string; orders_count: number; revenue: number };
type RecentOrder = {
  id: number;
  customer_name: string;
  total: number;
  status: string;
  created_at: string;
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:   { label: "Pendente",    color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20" },
  preparing: { label: "Preparando",  color: "bg-blue-500/15 text-blue-400 border-blue-500/20"   },
  delivery:  { label: "Entrega",     color: "bg-purple-500/15 text-purple-400 border-purple-500/20" },
  delivered: { label: "Entregue",    color: "bg-green-500/15 text-green-400 border-green-500/20" },
  cancelled: { label: "Cancelado",   color: "bg-red-500/15 text-red-400 border-red-500/20"     },
};

export default function AdminDashboard() {
  const [loading, setLoading]         = useState(true);
  const [isOpen, setIsOpen]           = useState(true);
  const [toggling, setToggling]       = useState(false);
  const [todayOrders, setTodayOrders] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [activePromos, setActivePromos]     = useState(0);
  const [chart, setChart]             = useState<DayRevenue[]>([]);
  const [recent, setRecent]           = useState<RecentOrder[]>([]);

  const load = async () => {
    setLoading(true);

    const [settingsRes, ordersRes, customersRes, promosRes, chartRes, recentRes] =
      await Promise.all([
        supabase.from("restaurant_settings").select("is_open").eq("id", 1).single(),
        supabase.from("orders_today").select("id, total, status"),
        supabase.from("customers").select("id", { count: "exact", head: true }),
        supabase.from("promotions").select("id", { count: "exact" }).eq("active", true),
        supabase.from("revenue_last_7_days").select("*"),
        supabase.from("orders").select("id,customer_name,total,status,created_at").order("created_at", { ascending: false }).limit(6),
      ]);

    if (settingsRes.data)  setIsOpen(settingsRes.data.is_open);

    if (ordersRes.data) {
      const active = ordersRes.data.filter((o) => o.status !== "cancelled");
      setTodayOrders(active.length);
      setTodayRevenue(active.reduce((s, o) => s + Number(o.total), 0));
    }

    setTotalCustomers(customersRes.count ?? 0);
    setActivePromos((promosRes.data ?? []).length);
    setChart(chartRes.data ?? []);
    setRecent(recentRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleOpen = async () => {
    setToggling(true);
    await supabase.from("restaurant_settings").update({ is_open: !isOpen }).eq("id", 1);
    setIsOpen((v) => !v);
    setToggling(false);
  };

  const metrics = [
    { label: "Pedidos Hoje",    value: todayOrders,              Icon: ShoppingBag, color: "#c0261a" },
    { label: "Receita Hoje",    value: `R$ ${todayRevenue.toFixed(2)}`, Icon: TrendingUp, color: "#16a34a" },
    { label: "Clientes",        value: totalCustomers,           Icon: Users,       color: "#7c3aed" },
    { label: "Promoções Ativas",value: activePromos,             Icon: Tag,         color: "#d97706" },
  ];

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white font-black text-xl tracking-tight">Dashboard</h1>
          <p className="text-white/30 text-xs font-medium mt-0.5">
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Status restaurante */}
          <button
            onClick={toggleOpen}
            disabled={toggling}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all duration-200 cursor-pointer ${
              isOpen
                ? "bg-green-500/10 border-green-500/25 text-green-400 hover:bg-green-500/20"
                : "bg-red-500/10 border-red-500/25 text-red-400 hover:bg-red-500/20"
            }`}
          >
            {isOpen
              ? <><ToggleRight size={16} /> Aberto</>
              : <><ToggleLeft size={16} /> Fechado</>
            }
          </button>

          <button
            onClick={load}
            className="p-2 rounded-xl border border-white/[0.08] text-white/40 hover:text-white hover:border-white/20 transition-all cursor-pointer"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {metrics.map(({ label, value, Icon, color }) => (
          <div key={label} className="rounded-2xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center justify-between">
              <span className="text-white/35 text-[10px] font-bold uppercase tracking-wider">{label}</span>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
                <Icon size={15} style={{ color }} />
              </div>
            </div>
            <div className="text-white font-black text-xl leading-none">
              {loading ? <span className="text-white/20 text-sm">—</span> : value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4">
        <RevenueGraph data={chart} />

        {/* ── Pedidos recentes ── */}
        <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <h2 className="text-white font-black text-sm mb-4">Pedidos Recentes</h2>
          {recent.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-white/20 text-xs">Nenhum pedido</div>
          ) : (
            <div className="space-y-2">
              {recent.map((order) => {
                const s = STATUS_LABEL[order.status] ?? STATUS_LABEL.pending;
                return (
                  <div key={order.id} className="flex items-center justify-between gap-2 py-2 border-b border-white/[0.05] last:border-0">
                    <div className="min-w-0">
                      <p className="text-white text-[12px] font-bold truncate">{order.customer_name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock size={10} className="text-white/25" />
                        <span className="text-white/25 text-[10px]">
                          {new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-white font-black text-[12px]">R$ {Number(order.total).toFixed(2)}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${s.color}`}>{s.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
