import { useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import AdminPromocoes from "./pages/AdminPromocoes";
import Home from "./pages/Home";
import AdminClientes from "./pages/AdminClientes";
import AdminImpressora from "./pages/AdminImpressora";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminPedidos from "./pages/AdminPedidos";
import AdminLocalidade from "./pages/AdminLocalidade";
import AdminProdutos from "./pages/AdminProdutos";
import AdminCardapio from "./pages/AdminCardapio";
import ProtectedRoute from "./components/ProtectedRoute";

import Cart from "./components/Cart";
import Navbar from "./components/Navbar";
import CheckoutDialog from "./components/CheckoutDialog";

import { useCart } from "./context/CartContext";

function App() {
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  const {
    cartItems,
    increaseQuantity,
    decreaseQuantity,
    removeFromCart,
  } = useCart();

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const handleFly = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { x: startX, y: startY, image } = customEvent.detail;

      // Destino: ícone do carrinho
      let destEl = document.getElementById("cart-button-desktop");
      if (window.innerWidth < 768) {
        destEl = document.getElementById("cart-button-mobile");
      }
      if (!destEl) return;

      const destRect = destEl.getBoundingClientRect();
      const destX = destRect.left + destRect.width / 2;
      const destY = destRect.top + destRect.height / 2;

      const dx = destX - startX;
      const dy = destY - startY;

      // Ponto de controle do arco (bezier quadrática: eleva na direção oposta ao destino)
      const arcHeight = Math.min(Math.abs(dy) * 0.6, 180);
      const ctrlX = startX + dx * 0.5;
      const ctrlY = Math.min(startY, destY) - arcHeight;

      // Interpolação bezier quadrática: B(t) = (1-t)^2*P0 + 2*(1-t)*t*P1 + t^2*P2
      const bezier = (t: number) => ({
        x: (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * ctrlX + t * t * destX - startX,
        y: (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * ctrlY + t * t * destY - startY,
      });

      const p40  = bezier(0.4);
      const p75  = bezier(0.75);
      const p100 = bezier(1.0);

      // Elemento voador
      const flyer = document.createElement("div");
      flyer.className = "animate-fly-cart";
      flyer.style.left = `${startX - 22}px`;
      flyer.style.top  = `${startY - 22}px`;
      flyer.style.width  = "44px";
      flyer.style.height = "44px";
      flyer.style.borderRadius = "50%";
      flyer.style.overflow = "hidden";
      flyer.style.boxShadow = "0 6px 24px rgba(192,38,26,0.45), 0 0 0 2px #c0261a";
      flyer.style.backgroundColor = "#111";
      flyer.style.willChange = "transform, opacity, filter";

      const img = document.createElement("img");
      img.src = image;
      img.style.height = "100%";
      img.style.objectFit = "cover";
      flyer.appendChild(img);

      flyer.style.setProperty("--fly-x40",  `${p40.x}px`);
      flyer.style.setProperty("--fly-y40",  `${p40.y}px`);
      flyer.style.setProperty("--fly-x75",  `${p75.x}px`);
      flyer.style.setProperty("--fly-y75",  `${p75.y}px`);
      flyer.style.setProperty("--fly-x100", `${p100.x}px`);
      flyer.style.setProperty("--fly-y100", `${p100.y}px`);

      document.body.appendChild(flyer);

      setTimeout(() => {
        flyer.remove();
        // Bounce no carrinho na chegada
        if (destEl) {
          destEl.classList.add("animate-cart-pop");
          setTimeout(() => destEl?.classList.remove("animate-cart-pop"), 500);
        }
      }, 720);

      // Toast
      setToastVisible(true);
      clearTimeout(timer);
      timer = setTimeout(() => setToastVisible(false), 2800);
    };

    window.addEventListener("add-to-cart-animation", handleFly);
    return () => {
      window.removeEventListener("add-to-cart-animation", handleFly);
      clearTimeout(timer);
    };
  }, []);

  return (
    <>
      <Navbar onOpenCart={() => setCartOpen(true)} />

      <Routes>
        <Route path="/" element={<Home />} />

        <Route
          path="/admin/login"
          element={<AdminLogin />}
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/pedidos"
          element={
            <ProtectedRoute>
              <AdminPedidos />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/cardapio"
          element={
            <ProtectedRoute>
              <AdminCardapio />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/clientes"
          element={
            <ProtectedRoute>
              <AdminClientes />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/promocoes"
          element={
            <ProtectedRoute>
              <AdminPromocoes />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/estoque"
          element={
            <ProtectedRoute>
              <AdminProdutos />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/localidade"
          element={
            <ProtectedRoute>
              <AdminLocalidade />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/impressora"
          element={
            <ProtectedRoute>
              <AdminImpressora />
            </ProtectedRoute>
          }
        />
      </Routes>

      {/* Cart Drawer Background Overlay */}
      <div
        onClick={() => setCartOpen(false)}
        className={`fixed inset-0 bg-black/60 z-[900] transition-opacity duration-300 backdrop-blur-xs ${
          cartOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Cart Drawer Panel (Uber-style lateral drawer) */}
      <div
        className={`fixed right-0 top-0 h-full w-full sm:w-[420px] bg-white shadow-2xl z-[901] flex flex-col transition-transform duration-300 ease-in-out ${
          cartOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <Cart
          items={cartItems}
          increaseQuantity={increaseQuantity}
          decreaseQuantity={decreaseQuantity}
          removeItem={removeFromCart}
          onClose={() => setCartOpen(false)}
          onCheckout={() => {
            setCartOpen(false);
            setCheckoutOpen(true);
          }}
        />
      </div>

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
      />

      {/* Toast Notification */}
      <div
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl pointer-events-none transition-all duration-300 ${
          toastVisible
            ? "translate-y-0 opacity-100 scale-100"
            : "translate-y-5 opacity-0 scale-95"
        }`}
        style={{
          background: "linear-gradient(135deg, #1a0a0a 0%, #1c1c1c 100%)",
          border: "1px solid rgba(192,38,26,0.35)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(192,38,26,0.15)", border: "1px solid rgba(192,38,26,0.4)" }}
        >
          <span style={{ fontSize: "14px" }}>✓</span>
        </div>
        <div>
          <div className="text-white text-[12px] font-black leading-none">Adicionado!</div>
          <div className="text-white/40 text-[10px] font-medium mt-0.5">Item no carrinho</div>
        </div>
      </div>
    </>
  );
}

export default App;
