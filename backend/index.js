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
    origin:
      "https://adyen-hosted-form-integration-with-payment-and-refun-apenv6bre.vercel.app/",
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

app.post(
  "/create-payment-session",
  async (req, res) => {
    try {
      const response =
        await checkout.PaymentsApi.sessions({
          amount: {
            currency: "USD",
            value: 1000,
          },

          reference: "ORDER_12345",

          merchantAccount:
            process.env
              .ADYEN_MERCHANT_ACCOUNT,

          returnUrl:
            "https://adyen-hosted-form-integration-with-payment-and-refun-apenv6bre.vercel.app/",

          countryCode: "US",

          shopperLocale: "en-US",

          channel: "Web",
        });

      res.json(response);
    } catch (error) {
      console.log(
        error.response?.body ||
          error.message
      );

      res.status(500).json({
        error: error.message,
      });
    }
  }
);


app.post("/refund", async (req, res) => {
  try {
    const { paymentPspReference } = req.body;

    const response =
      await checkout.ModificationsApi.refundCapturedPayment(
        paymentPspReference,
        {
          merchantAccount:
            process.env
              .ADYEN_MERCHANT_ACCOUNT,

          amount: {
            currency: "USD",
            value: 1000,
          },

          reference: "REFUND_ORDER_123",
        }
      );

    console.log("Refund Response");

    console.log(response);

    res.json(response);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      error: error.message,
    });
  }
});

app.post("/webhook", async (req, res) => {
  try {
    console.log("WEBHOOK RECEIVED");

    console.log(
      JSON.stringify(req.body, null, 2)
    );

    const notificationItems =
      req.body.notificationItems || [];

    for (const item of notificationItems) {
      const notification =
        item.NotificationRequestItem;

        const isValidHmac =
          validator.validateHMAC(
            notification,
            process.env.ADYEN_HMAC_KEY
          );

        if (!isValidHmac) {

          console.log(
            "Invalid HMAC Signature"
          );

          return res
            .status(401)
            .send("Invalid HMAC");
        }

      console.log(
        "Event Code:",
        notification.eventCode
      );

      console.log(
        "Success:",
        notification.success
      );

      console.log(
        "Merchant Reference:",
        notification.merchantReference
      );

      console.log(
        "Payment PSP Reference:",
        notification.pspReference
      );

      const insertQuery = `
        INSERT INTO payments
        (
          transactionId,
          merchantReference,
          status,
          amount
        )
        VALUES (?, ?, ?, ?)
      `;

      db.query(
        insertQuery,
        [
          notification.pspReference,

          notification.merchantReference,

          notification.success,

          notification.amount.value,
        ],

        (error, result) => {
          if (error) {
            console.log(
              "DB Insert Error"
            );

            console.log(error);
          } else {
            console.log(
              "Payment Saved to Database"
            );
          }
        }
      );

      if (
        notification.eventCode ===
          "AUTHORISATION" &&
        notification.success === "true"
      ) {
        console.log(
          "Payment Authorised Successfully"
        );
      }

      if (
        notification.eventCode === "REFUND"
      ) {

        console.log("Refund Event Received");

        const refundInsertQuery = `
          INSERT INTO refunds
          (
            refundId,
            paymentId,
            status,
            refundAmount
          )
          VALUES (?, ?, ?, ?)
        `;

        db.query(
          refundInsertQuery,
          [
            notification.pspReference,

            notification.originalReference,

            notification.success,

            notification.amount.value,
          ],

          (error, result) => {
            if (error) {
              console.log(
                "Refund DB Insert Error"
              );

              console.log(error);
            } else {
              console.log(
                "Refund Saved to Database"
              );
            }
          }
        );
      }
    }

    res.status(200).send("[accepted]");
  } catch (error) {
    console.log(
      "Webhook Error:",
      error
    );

    res
      .status(500)
      .send("Webhook Error");
  }
});

app.get("/payments", (req, res) => {

  const query =
    "SELECT * FROM payments ORDER BY createdAt DESC";

  db.query(query, (error, result) => {

    if (error) {

      if (error.code === "ER_DUP_ENTRY") {
        console.log(
          "Duplicate payment webhook ignored"
        );
      } else {
        console.log(error);
      }

      res.status(500).json({
        error: error.message,
      });

    } else {

      res.json(result);

    }
  });
});


app.get("/duplicate-test", (req, res) => {

  const query = `
    INSERT INTO payments
    (
      transactionId,
      merchantReference,
      status,
      amount
    )
    VALUES (?, ?, ?, ?)
  `;

  db.query(
    query,
    [
      "Q6QWVWCWLXPPT9V5",
      "ORDER_12345",
      "true",
      1000,
    ],

    (error, result) => {

      if (error) {

        if (
          error.code ===
          "ER_DUP_ENTRY"
        ) {

          console.log(
            "Duplicate payment webhook ignored"
          );

          res.send(
            "Duplicate prevented successfully"
          );

        } else {

          console.log(error);

          res.send(error);
        }

      } else {

        res.send(
          "Inserted successfully"
        );
      }
    }
  );
});

app.get("/refunds", (req, res) => {

  const query =
    "SELECT * FROM refunds ORDER BY createdAt DESC";

  db.query(query, (error, result) => {

    if (error) {

      if (error.code === "ER_DUP_ENTRY") {

        console.log(
          "Duplicate refund webhook ignored"
        );

      } else {

        console.log(error);

      }

      res.status(500).json({
        error: error.message,
      });

    } else {

      res.json(result);

    }
  });
});

app.listen(5000, () => {
  console.log(
    "Server running on port 5000"
  );
});