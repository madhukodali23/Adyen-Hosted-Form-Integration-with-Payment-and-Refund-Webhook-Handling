function Success() {
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
        Payment Successful ✅
      </h1>

      <p>
        Your payment was processed
        successfully.
      </p>

      {orderID && (
        <p>
          Order ID: <strong>{orderID}</strong>
        </p>
      )}
    </div>
  );
}

export default Success;