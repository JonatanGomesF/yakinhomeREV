import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import {
  LayoutDashboard,
  ShoppingBag,
  Users,
  Tag,
  Package,
  LogOut,
  Menu,
  X,
  ChefHat,
  MapPin,
  Printer,
  Utensils,
} from "lucide-react";

type Props = { children: React.ReactNode };

const navItems = [
  { to: "/admin",           label: "Dashboard",  Icon: LayoutDashboard },
  { to: "/admin/pedidos",   label: "Pedidos",     Icon: ShoppingBag     },
  { to: "/admin/cardapio",  label: "Cardapio",    Icon: Utensils        },
  { to: "/admin/clientes",  label: "Clientes",    Icon: Users           },
  { to: "/admin/promocoes", label: "Promoções",   Icon: Tag             },
  { to: "/admin/estoque",   label: "Estoque",     Icon: Package         },
  { to: "/admin/localidade", label: "Localidade", Icon: MapPin          },
  { to: "/admin/impressora", label: "Impressora", Icon: Printer         },
];

export default function AdminLayout({ children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  const NavContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-6 py-5 border-b border-white/[0.06]">
        <div className="w-8 h-8 rounded-lg bg-[#c0261a] flex items-center justify-center flex-shrink-0">
          <ChefHat size={16} className="text-white" />
        </div>
        <div>
          <span className="text-white font-black text-sm tracking-tight">Yakin</span>
          <span className="text-[#c0261a] font-black text-sm tracking-tight">Home</span>
          <div className="text-white/25 text-[9px] font-bold tracking-[0.2em] uppercase leading-none mt-0.5">
            Painel Admin
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/admin"}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group ${
                isActive
                  ? "bg-[#c0261a] text-white shadow-lg shadow-red-900/30"
                  : "text-white/50 hover:text-white hover:bg-white/[0.07]"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={17} className={isActive ? "text-white" : "text-white/40 group-hover:text-white/70"} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-white/[0.06]">
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 cursor-pointer"
        >
          <LogOut size={17} />
          Sair
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex font-sans-montserrat">

      {/* ── Sidebar Desktop ── */}
      <aside className="hidden md:flex flex-col w-56 bg-[#141414] border-r border-white/[0.05] flex-shrink-0 fixed top-0 left-0 h-full z-30">
        <NavContent />
      </aside>

      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar Mobile ── */}
      <aside
        className={`fixed top-0 left-0 h-full w-56 bg-[#141414] border-r border-white/[0.05] z-50 flex flex-col transition-transform duration-300 md:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>
        <NavContent />
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col md:ml-56 min-h-screen">

        {/* Top bar mobile */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#141414] border-b border-white/[0.05] sticky top-0 z-20">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-1.5">
            <span className="text-white font-black text-sm">Yakin</span>
            <span className="text-[#c0261a] font-black text-sm">Home</span>
          </div>
          <div className="w-5" />
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
