




let getBooks => {
  // Subscribe to order book and trade updates for BTC_ETH
  poloPush.orderTrade("BTC_ETH", (err, response) => {
      if (err) {
          // Log error message
          winston.log('error', "An error occurred: " + err.msg);

          // Disconnect
          return true;
      }

      // Handle the newly received orders/trades
      for (var i = 0; i < response.length; i++) {
        handleOrder(response[i]);
      }

      // Check if any out-of-sequence orders stored in the buffer can be added to the books
      checkResponseBuffer();

  }, true);

  // Wait 500ms after subscribing to the orders/trades push API before using the
  // public API to retrieve the entire order book. This prevents us from missing
  // updates while doing the retrieval.
  // Documentation: https://nodejs.org/api/timers.html
  setTimeout(getOrderBook, 500);
}
