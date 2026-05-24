import React, { useEffect } from "react";
import axios from "axios";

import {
  AdyenCheckout,
  Dropin,
  Card,
} from "@adyen/adyen-web";

import "@adyen/adyen-web/styles/adyen.css";

function App() {
  useEffect(() => {
    const initializePayment = async () => {
      try {
        const response = await axios.post(
          "http://localhost:5000/create-payment-session"
        );

        const session = response.data;

        const checkout = await AdyenCheckout({
          environment: "test",

          clientKey: "test_FDLVGSHDEJB73K2LBSQUZZ55SEFMS76F",

          session: {
            id: session.id,
            sessionData: session.sessionData,
          },

          onPaymentCompleted: (result) => {
            console.log("Payment Successful", result);
          },

          onError: (error) => {
            console.log("Payment Error", error);
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
    <h1 className = "payment-heading">Adyen Payment Integration</h1>
     <div style={{ width: "400px", margin: "50px auto" }}>
      <div id="payment"></div>
    </div>
    </>
  );
}

export default App;