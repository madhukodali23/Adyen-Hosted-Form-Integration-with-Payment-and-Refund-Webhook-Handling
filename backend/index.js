require("dotenv").config();

const express = require("express");


const cors = require("cors");
const mysql = require("mysql2");

const { Client, CheckoutAPI } = require("@adyen/api-library");

const app = express();

app.use(cors());
app.use(express.json()); 

const client = new Client({
  apiKey: process.env.ADYEN_API_KEY,
  environment: "TEST",
});


// const db = mysql.createConnection({
//   host: process.env.DB_HOST,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
// });

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,

  ssl: {
    rejectUnauthorized: false,
  },
});


db.connect((error) => {
  if (error) {
    console.log("Database Connection Failed");

    console.log(error);
  } else {
    console.log("MySQL Connected");
  }
});

const checkout = new CheckoutAPI(client);

app.get("/", (req, res) => {
  res.send("Backend Running");
});

app.post("/create-payment-session", async (req, res) => {
  try {
    const response = await checkout.PaymentsApi.sessions({
      amount: {
        currency: "USD",
        value: 1000,
      },
      reference: "ORDER_12345",
      merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT,
      returnUrl: "http://localhost:5713",
      countryCode: "US",
      shopperLocale: "en-US",
      channel: "Web",
    });

    res.json(response);
  } catch (error) {
    console.log(error.response?.body || error.message);

    res.status(500).json({
      error: error.message,
    });
  }
});


app.post("/webhook", async (req, res) => {
  try {
    console.log("WEBHOOK RECEIVED");

    console.log(JSON.stringify(req.body, null, 2));

    const notificationItems =
      req.body.notificationItems || [];

    for (const item of notificationItems) {
      const notification =
        item.NotificationRequestItem;

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
            console.log("DB Insert Error");

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
      }
    }

    res.status(200).send("[accepted]");
  } catch (error) {
    console.log("Webhook Error:", error);

    res.status(500).send("Webhook Error");
  }
});



app.listen(5000, () => {
  console.log("Server running on port 5000");
});