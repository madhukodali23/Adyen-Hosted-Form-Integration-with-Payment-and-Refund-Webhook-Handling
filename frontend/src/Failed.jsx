function Failed() {
  const params = new URLSearchParams(window.location.search);
  const orderID =
    params.get("orderID") ||
    params.get("orderId") ||
    sessionStorage.getItem("lastOrderId");

  return (
    <div
      style={{
        textAlign: "center",
        marginTop: "100px",
      }}
    >
      <h1>
        Payment Failed ❌
      </h1>

      <p>
        Something went wrong with
        your payment.
      </p>

      {orderID && (
        <p>
          Order ID: <strong>{orderID}</strong>
        </p>
      )}
    </div>
  );
}

export default Failed;