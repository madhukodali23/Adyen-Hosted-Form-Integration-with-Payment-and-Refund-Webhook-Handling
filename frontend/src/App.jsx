// import React, { useEffect, useState } from "react";
// import axios from "axios";

// import {
//   AdyenCheckout,
//   Dropin,
//   Card,
// } from "@adyen/adyen-web";

// import "@adyen/adyen-web/styles/adyen.css";

// function App() {
//   const [paymentStatus, setPaymentStatus] = useState("");

//   useEffect(() => {
//     const initializePayment = async () => {
//       try {
//         const response = await axios.post(
//           `${import.meta.env.VITE_BACKEND_URL}/create-payment-session`
//         );

//         const session = response.data;

//         const checkout = await AdyenCheckout({
//           environment: "test",

//           clientKey: import.meta.env.VITE_ADYEN_CLIENT_KEY,

//           session: {
//             id: session.id,
//             sessionData: session.sessionData,
//           },

//           showResultPage: false,

//           onPaymentCompleted: (result, component) => {
//             console.log("onPaymentCompleted result:", result);
//             window.location.href = "/success";
//           },

//           onPaymentFailed: (result, component) => {
//             console.log("onPaymentFailed result:", result);
//             window.location.href = "/failed";
//           },

//           onError: (error, component) => {
//             console.log("onError:", error);
//             window.location.href = "/failed";
//           },
//         });

//         const dropin = new Dropin(checkout, {
//           paymentMethodComponents: [Card],

//           paymentMethodsConfiguration: {
//             card: {
//               hasHolderName: true,
//               holderNameRequired: true,
//             },
//           },

//           showPayButton: true,
//         });

//         dropin.mount("#payment");
//       } catch (error) {
//         console.log(error);
//       }
//     };

//     initializePayment();
//   }, []);

//   return (
//     <>
//       <h1 className="payment-heading">Adyen Payment Integration</h1>
//       <div style={{ width: "400px", margin: "50px auto" }}>
//         <div id="payment"></div>
//       </div>
//     </>
//   );
// }

// export default App;


require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");

const {
  Client,
  CheckoutAPI,
  hmacValidator
} = require("@adyen/api-library");

const app = express();
const validator = new hmacValidator();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://adyen-hosted-form-integration-with-payment-and-refun-apenv6bre.vercel.app",
    ],
  })
);
app.use(express.json());

const client = new Client({
  apiKey: process.env.ADYEN_API_KEY,
  environment: "TEST",
});

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    rejectUnauthorized: false,
  },
});

db.getConnection((error, connection) => {
  if (error) {
    console.log("DB Connection Failed");
    console.log(error);
  } else {
    console.log("MySQL Pool Connected");
    connection.release();
  }
});

const checkout = new CheckoutAPI(client);

app.get("/", (req, res) => {
  res.send("Backend Running");
});

// ✅ create payment session with unique orderId
app.post("/create-payment-session", async (req, res) => {
  try {
    const orderId = `ORDER_${Date.now()}`;

    const response = await checkout.PaymentsApi.sessions({
      amount: {
        currency: "USD",
        value: 1000,
      },
      reference: orderId,
      merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT,
      returnUrl: "http://localhost:5173/",
      countryCode: "US",
      shopperLocale: "en-US",
      channel: "Web",
    });

    // ✅ return orderId to frontend
    res.json({
      ...response,
      orderId,
    });

  } catch (error) {
    console.log(error.response?.body || error.message);
    res.status(500).json({ error: error.message });
  }
});

// ✅ refund using orderId — looks up pspReference from DB
app.post("/refund", async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: "orderId is required" });
    }

    // ✅ Step 1: get pspReference from payments table using orderId
    const query = `
      SELECT transactionId
      FROM payments
      WHERE orderId = ?
      AND status = 'true'
      ORDER BY createdAt DESC
      LIMIT 1
    `;

    db.query(query, [orderId], async (error, result) => {
      if (error) {
        console.log("DB Query Error:", error);
        return res.status(500).json({ error: error.message });
      }

      if (result.length === 0) {
        console.log("No successful payment found for orderId:", orderId);
        return res.status(404).json({
          error: "No successful payment found for this orderId",
        });
      }

      // ✅ Step 2: extract pspReference
      const paymentPspReference = result[0].transactionId;

      console.log("Found PSP Reference:", paymentPspReference);
      console.log("Processing refund for orderId:", orderId);

      // ✅ Step 3: call Adyen refund API
      try {
        const refundResponse =
          await checkout.ModificationsApi.refundCapturedPayment(
            paymentPspReference,
            {
              merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT,
              amount: {
                currency: "USD",
                value: 1000,
              },
              reference: `REFUND_${orderId}`, // ✅ unique refund reference
            }
          );

        console.log("Refund Response:", refundResponse);

        res.json({
          success: true,
          orderId,
          paymentPspReference,
          refundResponse,
        });

      } catch (adyenError) {
        console.log("Adyen Refund Error:", adyenError);
        res.status(500).json({ error: adyenError.message });
      }
    });

  } catch (error) {
    console.log("Refund Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ webhook — saves both payment and refund with orderId
app.post("/webhook", async (req, res) => {
  try {
    console.log("WEBHOOK RECEIVED");
    console.log(JSON.stringify(req.body, null, 2));

    const notificationItems = req.body.notificationItems || [];

    for (const item of notificationItems) {
      const notification = item.NotificationRequestItem;

      const isValidHmac = validator.validateHMAC(
        notification,
        process.env.ADYEN_HMAC_KEY
      );

      if (!isValidHmac) {
        console.log("Invalid HMAC Signature");
        return res.status(401).send("Invalid HMAC");
      }

      console.log("Event Code:", notification.eventCode);
      console.log("Success:", notification.success);
      console.log("Merchant Reference:", notification.merchantReference);
      console.log("Payment PSP Reference:", notification.pspReference);

      // ✅ orderId = merchantReference we sent (e.g. ORDER_1716800000000)
      // ✅ uniqueMerchantReference = orderId + transactionId
      const orderId = notification.merchantReference;
      const transactionId = notification.pspReference;
      const uniqueMerchantReference = `${orderId}_${transactionId}`;

      // ✅ save payment to DB with orderId
      if (notification.eventCode === "AUTHORISATION") {

        const insertQuery = `
          INSERT INTO payments
          (transactionId, merchantReference, status, amount, orderId)
          VALUES (?, ?, ?, ?, ?)
        `;

        db.query(
          insertQuery,
          [
            transactionId,           // e.g. CNK8D3MSQQV4S675
            uniqueMerchantReference, // e.g. ORDER_1716800000000_CNK8D3MSQQV4S675
            notification.success,    // true or false
            notification.amount.value,
            orderId,                 // ✅ e.g. ORDER_1716800000000
          ],
          (error, result) => {
            if (error) {
              console.log("DB Insert Error:", error);
            } else {
              console.log("Payment Saved to Database");
              console.log("orderId saved:", orderId);
              console.log("transactionId saved:", transactionId);
              console.log("merchantReference saved:", uniqueMerchantReference);
            }
          }
        );

        if (notification.success === "true") {
          console.log("Payment Authorised Successfully");
        }
      }

      // ✅ save refund to DB with orderId
      if (notification.eventCode === "REFUND") {
        console.log("Refund Event Received");

        // ✅ get orderId from payments table using originalReference (pspReference of original payment)
        const getOrderIdQuery = `
          SELECT orderId
          FROM payments
          WHERE transactionId = ?
          LIMIT 1
        `;

        db.query(
          getOrderIdQuery,
          [notification.originalReference],
          (error, result) => {
            if (error) {
              console.log("DB Query Error:", error);
            }

            // ✅ use orderId from payments table if found
            const refundOrderId =
              result && result.length > 0
                ? result[0].orderId
                : orderId;

            const refundInsertQuery = `
              INSERT INTO refunds
              (refundId, paymentId, status, refundAmount, orderId)
              VALUES (?, ?, ?, ?, ?)
            `;

            db.query(
              refundInsertQuery,
              [
                notification.pspReference,      // refundId
                notification.originalReference,  // paymentId (original transactionId)
                notification.success,
                notification.amount.value,
                refundOrderId,                   // ✅ orderId saved in refunds too
              ],
              (error, result) => {
                if (error) {
                  console.log("Refund DB Insert Error:", error);
                } else {
                  console.log("Refund Saved to Database");
                  console.log("refund orderId saved:", refundOrderId);
                }
              }
            );
          }
        );
      }
    }

    res.status(200).send("[accepted]");

  } catch (error) {
    console.log("Webhook Error:", error);
    res.status(500).send("Webhook Error");
  }
});

app.get("/payments", (req, res) => {
  const query = "SELECT * FROM payments ORDER BY createdAt DESC";

  db.query(query, (error, result) => {
    if (error) {
      console.log(error);
      res.status(500).json({ error: error.message });
    } else {
      res.json(result);
    }
  });
});

app.get("/refunds", (req, res) => {
  const query = "SELECT * FROM refunds ORDER BY createdAt DESC";

  db.query(query, (error, result) => {
    if (error) {
      console.log(error);
      res.status(500).json({ error: error.message });
    } else {
      res.json(result);
    }
  });
});

app.get("/latest-payment-status", (req, res) => {
  const query = `
    SELECT *
    FROM payments
    ORDER BY id DESC
    LIMIT 1
  `;

  db.query(query, (error, result) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ error: error.message });
    }

    if (result.length === 0) {
      return res.json({ status: "pending" });
    }

    return res.json({ status: result[0].status });
  });
});

app.get("/duplicate-test", (req, res) => {
  const query = `
    INSERT INTO payments
    (transactionId, merchantReference, status, amount, orderId)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(
    query,
    [
      "Q6QWVWCWLXPPT9V5",
      "ORDER_12345_Q6QWVWCWLXPPT9V5",
      "true",
      1000,
      "ORDER_12345",
    ],
    (error, result) => {
      if (error) {
        if (error.code === "ER_DUP_ENTRY") {
          console.log("Duplicate payment webhook ignored");
          res.send("Duplicate prevented successfully");
        } else {
          console.log(error);
          res.send(error);
        }
      } else {
        res.send("Inserted successfully");
      }
    }
  );
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});

module.exports = app;