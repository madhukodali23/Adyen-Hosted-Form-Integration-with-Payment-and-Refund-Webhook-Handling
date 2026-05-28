import React, { useState, useRef } from "react";
import axios from "axios";
import { AdyenCheckout, Dropin, Card } from "@adyen/adyen-web";
import "@adyen/adyen-web/styles/adyen.css";

const API = import.meta.env.VITE_BACKEND_URL;

export function CheckoutPage() {
  // Start EMPTY — no default value so user is forced to type their own amount
  const [amountInput, setAmountInput] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [shopperEmail, setShopperEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [orderStarted, setOrderStarted] = useState(false);
  const dropinRef = useRef(null);

  // Always parse to float so Math.round works correctly
  const parsedAmount = parseFloat(amountInput);

  const startPayment = async () => {
    // Validate upfront before any API call
    if (!amountInput || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid amount greater than 0.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // Convert to minor units: 20.00 → 2000, 20 → 2000
      const amountInMinorUnits = Math.round(parsedAmount * 100);

      // Log so you can always verify in browser console what's being sent
      console.log(`Sending to backend: ${amountInMinorUnits} ${currency} (entered: ${amountInput})`);

      const response = await axios.post(`${API}/create-payment-session`, {
        amount: amountInMinorUnits,
        currency,
        shopperEmail: shopperEmail || undefined,
        shopperName:
          firstName && lastName
            ? { firstName, lastName }
            : undefined,
      });

      const { id, sessionData, orderId } = response.data;

      // Store orderId so success/failed pages can read it
      sessionStorage.setItem("lastOrderId", orderId);

      const checkoutInstance = await AdyenCheckout({
        environment: "test",
        clientKey: import.meta.env.VITE_ADYEN_CLIENT_KEY,
        session: { id, sessionData },
        showResultPage: false,

        onPaymentCompleted: (result) => {
          console.log("Payment completed:", result);
          window.location.href = `/success?orderId=${orderId}`;
        },
        onPaymentFailed: (result) => {
          console.log("Payment failed:", result);
          window.location.href = `/failed?orderId=${orderId}`;
        },
        onError: (err) => {
          console.error("Adyen error:", err);
          setError("Payment error. Please try again.");
          setLoading(false);
        },
      });

      const dropin = new Dropin(checkoutInstance, {
        paymentMethodComponents: [Card],
        paymentMethodsConfiguration: {
          card: {
            hasHolderName: true,
            holderNameRequired: true,
          },
        },
        showPayButton: true,
      });

      dropin.mount("#dropin-container");
      dropinRef.current = dropin;
      setOrderStarted(true);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to start payment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // What the Pay button shows — only renders a real amount when input is valid
  const buttonLabel = () => {
    if (loading) return "Loading...";
    if (!amountInput || isNaN(parsedAmount) || parsedAmount <= 0)
      return "Enter an amount to continue";
    return `Pay ${currency} ${parsedAmount.toFixed(2)}`;
  };

  return (
    <div style={{ maxWidth: 480, margin: "40px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 24 }}>Checkout</h1>

      {!orderStarted && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>

          {/* Amount + currency */}
          <label style={{ fontSize: 14 }}>
            Amount
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amountInput}
                placeholder="0.00"
                onChange={(e) => {
                  setAmountInput(e.target.value);
                  setError(""); // clear error as user types
                }}
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: error ? "1px solid #ef4444" : "1px solid #ccc",
                  fontSize: 16,
                }}
              />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", fontSize: 14 }}
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="INR">INR</option>
              </select>
            </div>
          </label>

          {/* Optional shopper details */}
          <label style={{ fontSize: 14 }}>
            Email (optional)
            <input
              type="email"
              value={shopperEmail}
              onChange={(e) => setShopperEmail(e.target.value)}
              style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", fontSize: 14, boxSizing: "border-box" }}
              placeholder="shopper@example.com"
            />
          </label>

          <div style={{ display: "flex", gap: 8 }}>
            <label style={{ fontSize: 14, flex: 1 }}>
              First name
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", fontSize: 14, boxSizing: "border-box" }}
              />
            </label>
            <label style={{ fontSize: 14, flex: 1 }}>
              Last name
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", fontSize: 14, boxSizing: "border-box" }}
              />
            </label>
          </div>

          {error && <p style={{ color: "#ef4444", fontSize: 13, margin: 0 }}>{error}</p>}

          <button
            onClick={startPayment}
            disabled={loading || !amountInput || isNaN(parsedAmount) || parsedAmount <= 0}
            style={{
              padding: "12px",
              borderRadius: 6,
              background: "#0075FF",
              color: "#fff",
              border: "none",
              fontSize: 16,
              cursor: (loading || !amountInput || isNaN(parsedAmount) || parsedAmount <= 0)
                ? "not-allowed"
                : "pointer",
              opacity: (loading || !amountInput || isNaN(parsedAmount) || parsedAmount <= 0)
                ? 0.5
                : 1,
            }}
          >
            {buttonLabel()}
          </button>
        </div>
      )}

      {/* Adyen Drop-in mounts here */}
      <div id="dropin-container" />
    </div>
  );
}

// ─── Success Page ──────────────────────────────────────────────────────────────
export function SuccessPage() {
  const orderId =
    new URLSearchParams(window.location.search).get("orderId") ||
    sessionStorage.getItem("lastOrderId");
  return (
    <div style={{ maxWidth: 480, margin: "40px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 22, color: "#1a7f37" }}>Payment successful 🎉</h1>
      {orderId && <p style={{ fontSize: 14 }}>Order ID: <code>{orderId}</code></p>}
    </div>
  );
}

// ─── Failed Page ───────────────────────────────────────────────────────────────
export function FailedPage() {
  const orderId =
    new URLSearchParams(window.location.search).get("orderId") ||
    sessionStorage.getItem("lastOrderId");
  return (
    <div style={{ maxWidth: 480, margin: "40px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 22, color: "#cf222e" }}>Payment failed ❌</h1>
      {orderId && <p style={{ fontSize: 14 }}>Order ID: <code>{orderId}</code></p>}
      <a href="/" style={{ display: "inline-block", marginTop: 16, padding: "10px 20px", background: "#0075FF", color: "#fff", borderRadius: 6, textDecoration: "none", fontSize: 14 }}>
        Try again
      </a>
    </div>
  );
}

// ─── Router ────────────────────────────────────────────────────────────────────
export default function App() {
  const path = window.location.pathname;
  if (path === "/success") return <SuccessPage />;
  if (path === "/failed")  return <FailedPage />;
  return <CheckoutPage />;
}
