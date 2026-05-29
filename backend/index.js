require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise"); // using promise API throughout
const { v4: uuidv4 } = require("uuid");
const Joi = require("joi");
const { Client, CheckoutAPI, hmacValidator } = require("@adyen/api-library");

const app = express();
const validator = new hmacValidator();

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://adyen-hosted-form-integration-with-payment-and-refun-apenv6bre.vercel.app",
    ],
  })
);
app.use(express.json());

// ─── ADYEN CLIENT ─────────────────────────────────────────────────────────────
const client = new Client({
  apiKey: process.env.ADYEN_API_KEY,
  environment: "TEST",
});
const checkout = new CheckoutAPI(client);

// ─── MYSQL POOL (promise-based) ────────────────────────────────────────────────
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  ssl: { rejectUnauthorized: false },
});

// Verify DB connection on startup
(async () => {
  try {
    const conn = await db.getConnection();
    console.log("✅ MySQL Pool Connected");
    conn.release();
  } catch (err) {
    console.error("❌ DB Connection Failed:", err.message);
  }
})();

// ─── VALIDATION SCHEMAS ────────────────────────────────────────────────────────
const createSessionSchema = Joi.object({
  // amount in minor units (e.g. 1000 = $10.00 USD)
  amount: Joi.number().integer().min(1).required(),
  currency: Joi.string().length(3).uppercase().required(), // "USD", "EUR" etc.
  shopperEmail: Joi.string().email().optional(),
  shopperName: Joi.object({
    firstName: Joi.string().min(1).max(80).required(),
    lastName: Joi.string().min(1).max(80).required(),
  }).optional(),
  shopperReference: Joi.string().max(80).optional(), // unique shopper ID in your system
  countryCode: Joi.string().length(2).uppercase().default("US"),
});

// Refund requests are performed by `orderId` (your internal order identifier).
// We look up the Adyen PSP reference (transactionId) for that order and use
// it to request the refund from Adyen.
const refundSchema = Joi.object({
  // orderId is YOUR internal order ID (from payments.orderId)
  orderId: Joi.string().required(),
  // amount optional — defaults to the original payment amount
  amount: Joi.number().integer().min(1).optional(),
});

// ─── HEALTH CHECK ──────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.send("Backend Running ✅"));

// ─── CREATE PAYMENT SESSION ────────────────────────────────────────────────────
// Creates a PENDING entry in the DB first, then requests a session from Adyen.
// The pending entry is updated once the AUTHORISATION webhook arrives.
app.post("/create-payment-session", async (req, res) => {
  // 1. Validate request body
  const { error, value } = createSessionSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const { amount, currency, shopperEmail, shopperName, shopperReference, countryCode } = value;

  // 2. Generate unique IDs
  const orderId = `ORD-${uuidv4()}`;           // your internal order id
  const merchantReference = uuidv4();           // sent to Adyen — no prefix needed, keep it clean

  try {
    // 3. Insert a PENDING record BEFORE calling Adyen
    // This ensures you can reconcile even if Adyen responds but webhook is delayed/lost
    await db.execute(
      `INSERT INTO payments
         (orderId, merchantReference, status, amount, currency, shopperEmail, shopperName, createdAt, updatedAt)
       VALUES (?, ?, 'pending', ?, ?, ?, ?, NOW(), NOW())`,
      [
        orderId,
        merchantReference,
        amount,
        currency,
        shopperEmail || null,
        shopperName ? `${shopperName.firstName} ${shopperName.lastName}` : null,
      ]
    );

    // 4. Call Adyen Sessions API
    const sessionPayload = {
      amount: { currency, value: amount },
      reference: merchantReference,
      merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT,
      returnUrl: process.env.FRONTEND_URL || "http://localhost:5173/",
      countryCode,
      shopperLocale: "en-US",
      channel: "Web",
      // 3DS2 — required for proper authentication
      additionalData: {
        "allow3DS2": "true",
      },
      authenticationData: {
        threeDSRequestData: {
          nativeThreeDS: "preferred", // triggers OTP / biometric 3DS flow
        },
      },
    };

    // Add optional shopper details for stored payment methods & risk checks
    if (shopperEmail) sessionPayload.shopperEmail = shopperEmail;
    if (shopperReference) sessionPayload.shopperReference = shopperReference;
    if (shopperName) sessionPayload.shopperName = shopperName;

    const response = await checkout.PaymentsApi.sessions(sessionPayload);

    // 5. Update the DB row with the Adyen sessionId for tracing
    await db.execute(
      `UPDATE payments SET adyenSessionId = ?, updatedAt = NOW() WHERE orderId = ?`,
      [response.id, orderId]
    );

    // 6. Return session + your orderId to the frontend
    res.json({
      id: response.id,
      sessionData: response.sessionData,
      orderId, // frontend should store this so it can request a refund later
    });
  } catch (err) {
    console.error("Session creation error:", err.response?.body || err.message);
    // Clean up the pending DB row if Adyen call failed (optional but clean)
    await db.execute("DELETE FROM payments WHERE orderId = ? AND status = 'pending'", [orderId]).catch(() => {});
    res.status(500).json({ error: "Failed to create payment session" });
  }
});

// ─── REFUND ────────────────────────────────────────────────────────────────────
// Accepts orderId — looks up the pspReference from DB, then requests a refund.
// Guards against duplicate refunds.
app.post("/refund", async (req, res) => {
  // 1. Validate
  const { error, value } = refundSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const { orderId, amount: requestedAmount } = value;

  try {
    // 2. Fetch the payment row by orderId and obtain the PSP reference
    const [rows] = await db.execute(
      `SELECT transactionId, amount, currency, status FROM payments WHERE orderId = ? LIMIT 1`,
      [orderId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: `No payment found for orderId: ${orderId}` });
    }

    const payment = rows[0];

    // 3. Guard: only refund authorised payments
    if (payment.status !== "authorised") {
      return res.status(400).json({
        error: `Cannot refund a payment with status "${payment.status}". Only authorised payments can be refunded.`,
      });
    }

    // 4. Guard: prevent duplicate refunds for the resolved payment PSP reference
    const [existingRefunds] = await db.execute(
      `SELECT refundId FROM refunds WHERE paymentId = ? AND status != 'failed' LIMIT 1`,
      [payment.transactionId]
    );
    if (existingRefunds.length > 0) {
      return res.status(409).json({
        error: "A refund has already been requested for this transaction.",
      });
    }

    const refundAmount = requestedAmount || payment.amount;
    const refundReference = `REFUND-${uuidv4()}`;

    // 5. Call Adyen Refund API
    const response = await checkout.ModificationsApi.refundCapturedPayment(
      payment.transactionId, // paymentPspReference
      {
        merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT,
        amount: { currency: payment.currency, value: refundAmount },
        reference: refundReference,
      }
    );

    // 6. Insert refund row as 'pending' — webhook will update it to success/failed
    await db.execute(
      `INSERT INTO refunds (refundId, paymentId, orderId, refundReference, status, refundAmount, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 'pending', ?, NOW(), NOW())`,
      [response.pspReference, payment.transactionId, orderId, refundReference, refundAmount]
    );

    res.json({
      message: "Refund initiated",
      refundPspReference: response.pspReference,
      orderId,
      amount: refundAmount,
      currency: payment.currency,
    });
  } catch (err) {
    console.error("Refund error:", err.response?.body || err.message);
    res.status(500).json({ error: "Failed to initiate refund" });
  }
});



// ─── WEBHOOK ───────────────────────────────────────────────────────────────────
app.post("/webhook", async (req, res) => {
  // Respond 200 FAST — Adyen retries if it doesn't get [accepted] quickly
  // Process asynchronously
  res.status(200).send("[accepted]");

  try {
    const notificationItems = req.body.notificationItems || [];

    for (const item of notificationItems) {
      const notification = item.NotificationRequestItem;

      // 1. Validate HMAC signature
      const isValidHmac = validator.validateHMAC(notification, process.env.ADYEN_HMAC_KEY);
      if (!isValidHmac) {
        console.warn("⚠️  Invalid HMAC — ignoring webhook:", notification.pspReference);
        continue; // skip invalid, don't crash
      }

      const { eventCode, success, pspReference, originalReference, merchantReference, amount } = notification;

      console.log(`📨 Webhook: ${eventCode} | success=${success} | psp=${pspReference}`);

      // ── AUTHORISATION ──────────────────────────────────────────────────────
      if (eventCode === "AUTHORISATION") {
        const newStatus = success === "true" ? "authorised" : "failed";

        // Idempotency: check if already processed with this pspReference
        const [existing] = await db.execute(
          `SELECT id FROM payments WHERE transactionId = ? LIMIT 1`,
          [pspReference]
        );

        if (existing.length > 0) {
          // Already have this PSP reference — just update status if needed
          await db.execute(
            `UPDATE payments SET status = ?, updatedAt = NOW() WHERE transactionId = ?`,
            [newStatus, pspReference]
          );
        } else {
          // Match by merchantReference (set when creating session)
          await db.execute(
            `UPDATE payments
             SET transactionId = ?, status = ?, updatedAt = NOW()
             WHERE merchantReference = ? AND status = 'pending'`,
            [pspReference, newStatus, merchantReference]
          );
        }

        console.log(`✅ Payment ${merchantReference} → ${newStatus}`);
      }

      // ── REFUND ─────────────────────────────────────────────────────────────
      if (eventCode === "REFUND") {
        const refundStatus = success === "true" ? "succeeded" : "failed";

        // Idempotency: skip if already recorded
        const [existingRefund] = await db.execute(
          `SELECT refundId FROM refunds WHERE refundId = ? LIMIT 1`,
          [pspReference]
        );

        if (existingRefund.length > 0) {
          await db.execute(
            `UPDATE refunds SET status = ?, updatedAt = NOW() WHERE refundId = ?`,
            [refundStatus, pspReference]
          );
        } else {
          // Insert if not already present (edge case: webhook arrived before our DB insert)
          await db.execute(
            `INSERT INTO refunds (refundId, paymentId, status, refundAmount, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, NOW(), NOW())
             ON DUPLICATE KEY UPDATE status = ?, updatedAt = NOW()`,
            [pspReference, originalReference, refundStatus, amount?.value || 0, refundStatus]
          );
        }

        // If refund succeeded, mark the payment as refunded
        if (success === "true") {
          await db.execute(
            `UPDATE payments SET status = 'refunded', updatedAt = NOW() WHERE transactionId = ?`,
            [originalReference]
          );
        }

        console.log(`💰 Refund ${pspReference} for payment ${originalReference} → ${refundStatus}`);
      }
    }
  } catch (err) {
    // Never let webhook processing errors affect the 200 response already sent
    console.error("Webhook processing error:", err.message);
  }
});

// ─── READ ENDPOINTS ────────────────────────────────────────────────────────────

app.get("/payments", async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT * FROM payments ORDER BY createdAt DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/refunds", async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT * FROM refunds ORDER BY createdAt DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get payment + its refund status by orderId
app.get("/payment/:orderId", async (req, res) => {
  try {
    const [payments] = await db.execute(
      `SELECT p.*, r.refundId, r.status AS refundStatus, r.refundAmount
       FROM payments p
       LEFT JOIN refunds r ON r.paymentId = p.transactionId
       WHERE p.orderId = ?
       LIMIT 1`,
      [req.params.orderId]
    );

    if (payments.length === 0) {
      return res.status(404).json({ error: "Payment not found" });
    }

    const row = payments[0];
    res.json({
      orderId: row.orderId,
      transactionId: row.transactionId,
      merchantReference: row.merchantReference,
      amount: row.amount,
      currency: row.currency,
      status: row.status,
      shopperEmail: row.shopperEmail,
      shopperName: row.shopperName,
      createdAt: row.createdAt,
      refund: row.refundId
        ? {
            refundId: row.refundId,
            status: row.refundStatus,
            amount: row.refundAmount,
          }
        : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Latest payment status (used by frontend after redirect)
app.get("/latest-payment-status", async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT orderId, status FROM payments ORDER BY id DESC LIMIT 1"
    );
    res.json(rows.length > 0 ? { orderId: rows[0].orderId, status: rows[0].status } : { status: "pending" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── START ─────────────────────────────────────────────────────────────────────
app.listen(5000, () => console.log("🚀 Server running on port 5000"));
module.exports = app;