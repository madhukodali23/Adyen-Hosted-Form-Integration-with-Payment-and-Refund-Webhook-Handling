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
                  `${import.meta.env.VITE_BACKEND_URL}/create-payment-session`);

        const session = response.data;

        const checkout = await AdyenCheckout({
          environment: "test",

          clientKey: import.meta.env.VITE_ADYEN_CLIENT_KEY,

          session: {
            id: session.id,
            sessionData: session.sessionData,
          },

          // onPaymentCompleted: (result) => {
          //   console.log(result);

          //   if (result.resultCode === "Authorised") {
          //     window.location.href =
          //       "/success";

          //   } else {

          //     window.location.href =
          //       "/failed";
          //   }
          // },
          
          onPaymentCompleted: async () => {

    let attempts = 0;

    const interval =
      setInterval(async () => {

        try {

          const response =
            await axios.get(
              `${import.meta.env.VITE_BACKEND_URL}/latest-payment-status`
            );

          const status =
            response.data.status;

          console.log(
            "LATEST STATUS",
            status
          );

          if (
            status === true
          ) {

            clearInterval(interval);

            window.location.href =
              "/success";
          }

          if (
            status === false
          ) {

            clearInterval(interval);

            window.location.href =
              "/failed";
          }

          attempts++;

          if (
            attempts > 10
          ) {

            clearInterval(interval);

            window.location.href =
              "/failed";
          }

        } catch (error) {

          console.log(error);

          clearInterval(interval);

          window.location.href =
            "/failed";
        }

      }, 3000);
          },

          onError: (error) => {

            console.log(error);

            window.location.href =
              "/failed";
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