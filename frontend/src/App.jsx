import { useState, useEffect } from "react";
import axios from "axios";
import { AdyenCheckout, Dropin, Card } from "@adyen/adyen-web";
import "@adyen/adyen-web/styles/adyen.css";

const API = import.meta.env.VITE_BACKEND_URL;

// Real shoe images from Unsplash — free, no API key needed
const PRODUCTS = [
  {
    id: 1,
    name: "Nike Air Force 1",
    brand: "Nike",
    category: "Sneakers",
    price: 109.99,
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=300&fit=crop",
    desc: "Classic court silhouette, all-white leather",
  },
  {
    id: 2,
    name: "Adidas Ultraboost",
    brand: "Adidas",
    category: "Sneakers",
    price: 179.99,
    image: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=400&h=300&fit=crop",
    desc: "Responsive Boost midsole, Primeknit upper",
  },
  {
    id: 3,
    name: "Timberland 6-Inch Boot",
    brand: "Timberland",
    category: "Boots",
    price: 198.99,
    image: "https://images.unsplash.com/photo-1638247025967-b4e38f787b76?w=400&h=300&fit=crop",
    desc: "Waterproof nubuck leather, rugged lug sole",
  },
  {
    id: 4,
    name: "Converse Chuck Taylor",
    brand: "Converse",
    category: "Casual",
    price: 59.99,
    image: "https://images.unsplash.com/photo-1494496195158-c3bc975e2073?w=400&h=300&fit=crop",
    desc: "Iconic canvas high-top, vulcanized sole",
  },
  {
    id: 5,
    name: "New Balance 990v5",
    brand: "New Balance",
    category: "Sneakers",
    price: 174.99,
    image: "https://images.unsplash.com/photo-1539185441755-769473a23570?w=400&h=300&fit=crop",
    desc: "Made in USA, premium suede + mesh",
  },
  {
    id: 6,
    name: "Vans Old Skool",
    brand: "Vans",
    category: "Casual",
    price: 69.99,
    image: "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=400&h=300&fit=crop",
    desc: "Skate classic, signature side stripe",
  },
  {
    id: 7,
    name: "Dr. Martens 1460",
    brand: "Dr. Martens",
    category: "Boots",
    price: 159.99,
    image: "https://images.unsplash.com/photo-1605812860427-4024433a70fd?w=400&h=300&fit=crop",
    desc: "Smooth leather, air-cushioned sole",
  },
  {
    id: 8,
    name: "Puma Suede Classic",
    brand: "Puma",
    category: "Casual",
    price: 74.99,
    image: "https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=400&h=300&fit=crop",
    desc: "Suede upper, formstrip branding",
  },
];

const FILTERS = ["All", "Sneakers", "Boots", "Casual"];

export default function ShoeStore() {
  const [page, setPage] = useState("store");
  const [cart, setCart] = useState([]);
  const [filter, setFilter] = useState("All");
  const [checkoutStarted, setCheckoutStarted] = useState(false);
  const [shopperEmail, setShopperEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orderId, setOrderId] = useState("");

  const filtered = filter === "All" ? PRODUCTS : PRODUCTS.filter((p) => p.category === filter);
  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0);

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) return prev.map((i) => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateQty = (id, qty) => {
    if (qty < 1) setCart((prev) => prev.filter((i) => i.id !== id));
    else setCart((prev) => prev.map((i) => i.id === id ? { ...i, qty } : i));
  };

  const startCheckout = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await axios.post(`${API}/create-payment-session`, {
        amount: Math.round(cartTotal * 100),
        currency: "USD",
        shopperEmail: shopperEmail || undefined,
        shopperName: firstName && lastName ? { firstName, lastName } : undefined,
      });

      const { id, sessionData, orderId: oid } = response.data;
      setOrderId(oid);
      sessionStorage.setItem("lastOrderId", oid);

      const checkoutInstance = await AdyenCheckout({
        environment: "test",
        clientKey: import.meta.env.VITE_ADYEN_CLIENT_KEY,
        session: { id, sessionData },
        showResultPage: false,
        onPaymentCompleted: () => setPage("success"),
        onPaymentFailed: () => setPage("failed"),
        onError: (err) => { console.error(err); setError("Payment error. Please try again."); },
      });

      new Dropin(checkoutInstance, {
        paymentMethodComponents: [Card],
        paymentMethodsConfiguration: { card: { hasHolderName: true, holderNameRequired: true } },
        showPayButton: true,
      }).mount("#dropin-container");

      setCheckoutStarted(true);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to start payment.");
    } finally {
      setLoading(false);
    }
  };

  // ── STORE ─────────────────────────────────────────────────────────────────
  if (page === "store") return (
    <div style={s.page}>
      {/* Navbar */}
      <nav style={s.nav}>
        <div style={s.navInner}>
          <span style={s.brand}>SOLE<span style={{ color: "#e63946" }}>VAULT</span></span>
          <button style={s.cartChip} onClick={() => cartCount > 0 && setPage("checkout")}>
            🛒 {cartCount > 0 ? `${cartCount} item${cartCount > 1 ? "s" : ""} · $${cartTotal.toFixed(2)}` : "Cart"}
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div style={s.hero}>
        <div>
          <p style={s.heroEyebrow}>NEW ARRIVALS 2025</p>
          <h1 style={s.heroH1}>Find Your<br />Perfect Pair</h1>
          <p style={s.heroSub}>Premium sneakers, boots & casual footwear</p>
        </div>
        <img
          src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&h=380&fit=crop"
          alt="Featured sneaker"
          style={s.heroImg}
        />
      </div>

      {/* Filter tabs */}
      <div style={s.tabs}>
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ ...s.tab, ...(filter === f ? s.tabActive : {}) }}>
            {f}
          </button>
        ))}
      </div>

      {/* Product grid */}
      <div style={s.grid}>
        {filtered.map((product) => {
          const inCart = cart.find((i) => i.id === product.id);
          return (
            <div key={product.id} style={s.card}>
              <div style={s.imgWrap}>
                <img src={product.image} alt={product.name} style={s.productImg}
                  onError={(e) => { e.target.style.display = "none"; }} />
                <span style={s.brandTag}>{product.brand}</span>
              </div>
              <div style={s.cardBody}>
                <p style={s.cardCat}>{product.category}</p>
                <p style={s.cardName}>{product.name}</p>
                <p style={s.cardDesc}>{product.desc}</p>
                <div style={s.cardFooter}>
                  <span style={s.cardPrice}>${product.price}</span>
                  {inCart ? (
                    <div style={s.qtyRow}>
                      <button style={s.qtyBtn} onClick={() => updateQty(product.id, inCart.qty - 1)}>−</button>
                      <span style={s.qtyVal}>{inCart.qty}</span>
                      <button style={s.qtyBtn} onClick={() => updateQty(product.id, inCart.qty + 1)}>+</button>
                    </div>
                  ) : (
                    <button style={s.addBtn} onClick={() => addToCart(product)}>Add to Cart</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating checkout bar */}
      {cartCount > 0 && (
        <div style={s.floatingBar}>
          <span style={{ fontSize: 14 }}>
            {cartCount} item{cartCount > 1 ? "s" : ""} &nbsp;·&nbsp; <strong>${cartTotal.toFixed(2)}</strong>
          </span>
          <button style={s.floatingCta} onClick={() => setPage("checkout")}>
            Checkout →
          </button>
        </div>
      )}
    </div>
  );

  // ── CHECKOUT ──────────────────────────────────────────────────────────────
  if (page === "checkout") return (
    <div style={s.page}>
      <nav style={s.nav}>
        <div style={s.navInner}>
          <button style={s.backBtn} onClick={() => { setPage("store"); setCheckoutStarted(false); }}>
            ← Back to Store
          </button>
          <span style={s.brand}>SOLE<span style={{ color: "#e63946" }}>VAULT</span></span>
          <div style={{ width: 120 }} />
        </div>
      </nav>

      <div style={s.checkoutWrap}>
        {/* Left — order summary */}
        <div style={s.summaryBox}>
          <h2 style={s.boxTitle}>Order Summary</h2>
          {cart.map((item) => (
            <div key={item.id} style={s.summaryRow}>
              <img src={item.image} alt={item.name} style={s.summaryThumb}
                onError={(e) => { e.target.style.display = "none"; }} />
              <div style={{ flex: 1 }}>
                <p style={s.summaryName}>{item.name}</p>
                <p style={s.summaryMeta}>{item.brand} · Qty {item.qty}</p>
              </div>
              <span style={s.summaryPrice}>${(item.price * item.qty).toFixed(2)}</span>
            </div>
          ))}
          <div style={s.divider} />
          <div style={s.totalRow}>
            <span style={{ color: "#6b7280" }}>Subtotal</span>
            <span>${cartTotal.toFixed(2)}</span>
          </div>
          <div style={s.totalRow}>
            <span style={{ color: "#6b7280" }}>Shipping</span>
            <span style={{ color: "#16a34a" }}>Free</span>
          </div>
          <div style={{ ...s.totalRow, fontWeight: 700, fontSize: 18, marginTop: 8 }}>
            <span>Total</span>
            <span>${cartTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Right — payment */}
        <div style={s.paymentBox}>
          <h2 style={s.boxTitle}>Payment Details</h2>
          {!checkoutStarted && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              <input type="email" placeholder="Email (optional)" value={shopperEmail}
                onChange={(e) => setShopperEmail(e.target.value)} style={s.input} />
              <div style={{ display: "flex", gap: 8 }}>
                <input type="text" placeholder="First name" value={firstName}
                  onChange={(e) => setFirstName(e.target.value)} style={{ ...s.input, flex: 1 }} />
                <input type="text" placeholder="Last name" value={lastName}
                  onChange={(e) => setLastName(e.target.value)} style={{ ...s.input, flex: 1 }} />
              </div>
              {error && <p style={{ color: "#e63946", fontSize: 13, margin: 0 }}>{error}</p>}
              <button onClick={startCheckout} disabled={loading} style={s.payBtn}>
                {loading ? "Loading..." : `Pay $${cartTotal.toFixed(2)}`}
              </button>
            </div>
          )}
          <div id="dropin-container" />
        </div>
      </div>
    </div>
  );

  // ── SUCCESS ───────────────────────────────────────────────────────────────
  if (page === "success") return (
    <div style={s.resultPage}>
      <div style={s.resultCard}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 8px" }}>Order Confirmed!</h1>
        <p style={{ color: "#6b7280", marginBottom: 24 }}>Your kicks are on their way 🚀</p>
        {orderId && (
          <div style={s.infoBox}>
            <span style={s.infoLabel}>Order ID</span>
            <code style={s.infoValue}>{orderId}</code>
          </div>
        )}
        <div style={s.infoBox}>
          {cart.map((item) => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: "1px solid #f3f4f6" }}>
              <span>{item.name} × {item.qty}</span>
              <span style={{ fontWeight: 600 }}>${(item.price * item.qty).toFixed(2)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15, paddingTop: 10 }}>
            <span>Total Paid</span><span>${cartTotal.toFixed(2)}</span>
          </div>
        </div>
        <button style={s.payBtn} onClick={() => { setPage("store"); setCart([]); setCheckoutStarted(false); }}>
          Continue Shopping
        </button>
      </div>
    </div>
  );

  // ── FAILED ────────────────────────────────────────────────────────────────
  if (page === "failed") return (
    <div style={s.resultPage}>
      <div style={s.resultCard}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>❌</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 8px" }}>Payment Failed</h1>
        <p style={{ color: "#6b7280", marginBottom: 24 }}>No amount was charged. Please try again.</p>
        {orderId && (
          <div style={s.infoBox}>
            <span style={s.infoLabel}>Order ID</span>
            <code style={s.infoValue}>{orderId}</code>
          </div>
        )}
        <button style={{ ...s.payBtn, background: "#111" }}
          onClick={() => { setPage("checkout"); setCheckoutStarted(false); }}>
          Try Again
        </button>
      </div>
    </div>
  );
}

// ── STYLES ─────────────────────────────────────────────────────────────────
const s = {
  page: { minHeight: "100vh", background: "#f8f8f8", fontFamily: "'Helvetica Neue', Helvetica, sans-serif" },
  nav: { background: "#fff", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0, zIndex: 100 },
  navInner: { maxWidth: 1140, margin: "0 auto", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  brand: { fontSize: 22, fontWeight: 900, letterSpacing: 2, color: "#111" },
  cartChip: { background: "#111", color: "#fff", border: "none", borderRadius: 100, padding: "8px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  hero: { maxWidth: 1140, margin: "0 auto", padding: "56px 24px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 32, flexWrap: "wrap" },
  heroEyebrow: { fontSize: 11, fontWeight: 700, letterSpacing: 4, color: "#e63946", marginBottom: 12, textTransform: "uppercase" },
  heroH1: { fontSize: 52, fontWeight: 900, lineHeight: 1.1, color: "#111", margin: "0 0 16px" },
  heroSub: { fontSize: 16, color: "#6b7280" },
  heroImg: { width: 420, height: 300, objectFit: "cover", borderRadius: 20, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", flexShrink: 0 },
  tabs: { maxWidth: 1140, margin: "0 auto", padding: "0 24px 24px", display: "flex", gap: 8, flexWrap: "wrap" },
  tab: { padding: "8px 22px", borderRadius: 100, border: "1.5px solid #e5e7eb", background: "#fff", fontSize: 14, fontWeight: 500, cursor: "pointer", color: "#374151", transition: "all 0.15s" },
  tabActive: { background: "#111", color: "#fff", borderColor: "#111" },
  grid: { maxWidth: 1140, margin: "0 auto", padding: "0 24px 100px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 24 },
  card: { background: "#fff", borderRadius: 16, overflow: "hidden", border: "1px solid #e5e7eb", display: "flex", flexDirection: "column" },
  imgWrap: { position: "relative", overflow: "hidden" },
  productImg: { width: "100%", height: 220, objectFit: "cover", display: "block" },
  brandTag: { position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,0.65)", color: "#fff", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700, backdropFilter: "blur(4px)" },
  cardBody: { padding: "16px", flex: 1, display: "flex", flexDirection: "column" },
  cardCat: { fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#e63946", margin: "0 0 4px", textTransform: "uppercase" },
  cardName: { fontSize: 16, fontWeight: 700, color: "#111", margin: "0 0 4px" },
  cardDesc: { fontSize: 13, color: "#9ca3af", margin: "0 0 16px", flex: 1 },
  cardFooter: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  cardPrice: { fontSize: 20, fontWeight: 800, color: "#111" },
  addBtn: { background: "#e63946", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  qtyRow: { display: "flex", alignItems: "center", gap: 10, background: "#f3f4f6", borderRadius: 8, padding: "6px 10px" },
  qtyBtn: { background: "none", border: "none", fontSize: 18, fontWeight: 700, cursor: "pointer", color: "#111", lineHeight: 1 },
  qtyVal: { fontSize: 15, fontWeight: 700, minWidth: 18, textAlign: "center" },
  floatingBar: { position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#111", color: "#fff", borderRadius: 100, padding: "14px 28px", display: "flex", alignItems: "center", gap: 24, boxShadow: "0 8px 40px rgba(0,0,0,0.3)", zIndex: 200, whiteSpace: "nowrap" },
  floatingCta: { background: "#e63946", color: "#fff", border: "none", borderRadius: 100, padding: "8px 22px", fontSize: 14, fontWeight: 700, cursor: "pointer" },
  backBtn: { background: "none", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", color: "#374151" },
  checkoutWrap: { maxWidth: 960, margin: "32px auto", padding: "0 24px 60px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 },
  summaryBox: { background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e5e7eb", alignSelf: "start" },
  boxTitle: { fontSize: 18, fontWeight: 700, margin: "0 0 20px", color: "#111" },
  summaryRow: { display: "flex", alignItems: "center", gap: 12, marginBottom: 16 },
  summaryThumb: { width: 56, height: 56, borderRadius: 8, objectFit: "cover", flexShrink: 0 },
  summaryName: { fontSize: 14, fontWeight: 600, color: "#111", margin: 0 },
  summaryMeta: { fontSize: 12, color: "#9ca3af", margin: "2px 0 0" },
  summaryPrice: { fontSize: 14, fontWeight: 700, color: "#111" },
  divider: { borderTop: "1px solid #f3f4f6", margin: "16px 0" },
  totalRow: { display: "flex", justifyContent: "space-between", fontSize: 14, padding: "4px 0" },
  paymentBox: { background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e5e7eb", alignSelf: "start" },
  input: { width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14, boxSizing: "border-box", outline: "none", fontFamily: "inherit" },
  payBtn: { width: "100%", padding: "14px", background: "#e63946", color: "#fff", border: "none", borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  resultPage: { minHeight: "100vh", background: "#f8f8f8", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 },
  resultCard: { background: "#fff", borderRadius: 20, padding: "40px 32px", maxWidth: 440, width: "100%", textAlign: "center", boxShadow: "0 4px 32px rgba(0,0,0,0.08)" },
  infoBox: { background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 16px", marginBottom: 16, textAlign: "left", display: "flex", flexDirection: "column", gap: 4 },
  infoLabel: { fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: 1, textTransform: "uppercase" },
  infoValue: { fontSize: 13, color: "#111", wordBreak: "break-all" },
};
