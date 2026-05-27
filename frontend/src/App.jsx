import React, { useEffect, useState } from "react";
import axios from "axios";

import {
  AdyenCheckout,
  Dropin,
  Card,
} from "@adyen/adyen-web";

import "@adyen/adyen-web/styles/adyen.css";

function App() {
  const [paymentStatus, setPaymentStatus] = useState("");

  useEffect(() => {
    const initializePayment = async () => {
      try {
        const response = await axios.post(
          `${import.meta.env.VITE_BACKEND_URL}/create-payment-session`
        );

        const session = response.data;

        const checkout = await AdyenCheckout({
          environment: "test",

          clientKey: import.meta.env.VITE_ADYEN_CLIENT_KEY,

          session: {
            id: session.id,
            sessionData: session.sessionData,
          },

          showResultPage: false,

          onPaymentCompleted: (result, component) => {
            console.log("onPaymentCompleted result:", result);
            window.location.href = "/success";
          },

          onPaymentFailed: (result, component) => {
            console.log("onPaymentFailed result:", result);
            window.location.href = "/failed";
          },

          onError: (error, component) => {
            console.log("onError:", error);
            window.location.href = "/failed";
          },
        });

        const dropin = new Dropin(checkout, {
          paymentMethodComponents: [Card],

          paymentMethodsConfiguration: {
            card: {
              hasHolderName: true,
              holderNameRequired: true,
            },
          },

          showPayButton: true,
        });

        dropin.mount("#payment");
      } catch (error) {
        console.log(error);
      }
    };

    initializePayment();
  }, []);

  return (
    <>
      <h1 className="payment-heading">Adyen Payment Integration</h1>
      <div style={{ width: "400px", margin: "50px auto" }}>
        <div id="payment"></div>
      </div>
    </>
  );
}

export default App;


