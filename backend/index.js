require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { Client, CheckoutAPI } = require("@adyen/api-library");

const app = express();

app.use(cors());
app.use(express.json());

const client = new Client({
  apiKey: process.env.ADYEN_API_KEY,
  environment: "TEST",
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



app.listen(5000, () => {
  console.log("Server running on port 5000");
});