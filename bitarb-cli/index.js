#!/usr/bin/env node

// Tell the compiler to use a strict variant of Javascript
'use strict';

// Require the Commander Node module for command line parsing.
// Reference: https://medium.freecodecamp.com/writing-command-line-applications-in-nodejs-2cf8327eee2#.x1iwed7tf
const program = require('commander');

// Import configuration files
const pkg = require('./package.json');
const config = require('./configuration.json');

// Require the Poloniex API
// https://www.npmjs.com/package/poloniex-unofficial
const polo = require('poloniex-unofficial');

// Require the Jetty Node module for text formatting.
// https://github.com/fknsrs/jetty
const Jetty = require('jetty');

// Require the Winston Node module for log management.
// https://github.com/winstonjs/winston
const winston = require('winston');

// Require the Sorted-Array Node module for keeping a local copy of the order book
// https://github.com/javascript/sorted-array
const sortedArray = require('sorted-array');

// Create a new Jetty object. This is a through stream with some additional
// methods on it. Additionally, connect it to process.stdout
var jetty = new Jetty(process.stdout);

// Require the File System Node module for writing to log files
// https://nodejs.org/api/fs.html
var fs = require('fs');

// Require the sprintf-js Node module for formatting strings
// https://www.npmjs.com/package/sprintf-js
var vsprintf = require('sprintf-js').vsprintf

winston.level = 'debug'

// Get access to the Poloniex APIs
var poloPush = new polo.PushWrapper();
var poloPublic = new polo.PublicWrapper();

const ORDER_DEPTH = 10000;

const BUFFER_DEPTH = 50;

var poloOrderBooks = {seq: 0};

var poloOrderBuffer = [];

// TODO: Debug variable
var trackedRate;

let myFunction = () => {
  winston.log('info', "Hello World");

  //jetty.text("yoyoyoyoyo");
  //jetty.erase(5);
  //jetty.clearLine();

  //jetty.text("hello world");
  //jetty.moveTo([0,0]);
  //jetty.text("hello panda");

}


let getTrollbox = () => {
  // Receive trollbox updates
  poloPush.trollbox((err, response) => {
      if (err) {
          // Log error message
          winston.log('error', "An error occurred: " + err.msg);

          // Disconnect
          return true;
      }

      // Log chat message as "[rep] username: message"
      winston.log('info', "    [" + response.reputation + "] " + response.username + ": " + response.message);
  });
}


let displayBooks = () => {

  var booksString = 'SELL ORDERS                    BUY ORDERS\r\nPRICE          ETH             PRICE          ETH\r\n';
  //bookString += 'PRICE      ETH    PRICE     ETH\r\n';
  for (var i = 0; i < 20; i++) {
    booksString += vsprintf("%9.8f   %15.8f   ", [poloOrderBooks.asks.array[i].rate, poloOrderBooks.asks.array[i].amount]);
    booksString += vsprintf("%9.8f   %15.8f\r\n", [poloOrderBooks.bids.array[i].rate, poloOrderBooks.bids.array[i].amount]);
  }

  fs.writeFile('books.txt', booksString, function(err) {
    if (err) {
      return winston.log('error', err);
    }
  });

  //jetty.clear();
  //jetty.text(poloOrderBooks);
  //jetty.text("hello world");
  //jetty.moveTo([0,0]);
  //jetty.text("hello panda");
}


let getOrderBook = () => {

  // Prevent the push API from updating the order book until after the orders are retrieved
  poloOrderBooks.seq = 0;

  winston.log('info', 'Retrieving Order Book');

  // Initialize the order book. Store asks in an array sorted by rate (low to high),
  // and store bids in an array sorted by rate (high to low).
  poloOrderBooks.asks = new sortedArray([], function(a, b) {
    return (a.rate - b.rate);});
  poloOrderBooks.bids = new sortedArray([], function(a, b) {
    return (b.rate - a.rate);});

  // TODO: If there are more than ORDER_DEPTH entries in the order book, I won't get
  // them all. I should consider how I want to handle this error condition.
  // Also, I may want to keep orders in a database rather than an array.

  // Get the top ORDER_DEPTH orders on the books. The goal is to get the whole order book.
  poloPublic.returnOrderBook("BTC_ETH", ORDER_DEPTH, (err, response) => {
      if (err) {
          // Log error message
          winston.log('error', "An error occurred: " + err.msg);
      }
      else {
          // Save response
          poloOrderBooks.seq = response.seq;
          winston.log('silly', "poloOrderBooks.seq = " + poloOrderBooks.seq);
          for (var i = 0; i < response.asks.length; i++) {
            poloOrderBooks.asks.insert({rate: parseFloat(response.asks[i][0]), amount: response.asks[i][1]});
          }
          for (var i = 0; i < response.bids.length; i++) {
            poloOrderBooks.bids.insert({rate: parseFloat(response.bids[i][0]), amount: response.bids[i][1]});
          }

          // TODO - DEBUG
          //trackedRate = poloOrderBooks.bids.array[0].rate;
          //console.log('Rate: ' + trackedRate);
          //console.log('Initial Order Book: ' + poloOrderBooks.bids.array[0].amount);

          // Check if we got the whole order book
          if ((response.asks.length >= ORDER_DEPTH) || (response.bids.length >= ORDER_DEPTH)) {
            winston.log('error', "Unable to obtain complete order book")
          }
      }
  });
}


let addBookEntry = (response) => {
  // TODO: Error checking in case of empty argument list in response
  switch (response.type) {
    case 'ask':
      if (response.updateType == 'orderBookRemove') {
        // Remove the ask from the books
        poloOrderBooks.asks.remove({rate: parseFloat(response.rate), amount: 0});
      }
      else if (response.updateType == 'orderBookModify') {
        // Add the ask to the books
        var ask = {rate: parseFloat(response.rate), amount: parseFloat(response.amount)};
        var index = poloOrderBooks.asks.search(ask);
        if (-1 == index) {
          // New entry
          poloOrderBooks.asks.insert(ask);
        }
        else {
          // Update the existing entry
          poloOrderBooks.asks.array[index].rate = ask.rate;
          poloOrderBooks.asks.array[index].amount = ask.amount;
        }
      }
      break;
    case 'bid':
      if (response.updateType == 'orderBookRemove') {
        // Remove the bid from the books
        poloOrderBooks.bids.remove({rate: parseFloat(response.rate), amount: 0});
      }
      else if (response.updateType == 'orderBookModify') {
        // Add the bid to the books
        var bid = {rate: parseFloat(response.rate), amount: parseFloat(response.amount)};
        var index = poloOrderBooks.bids.search(bid);
        if (-1 == index) {
          // New entry
          poloOrderBooks.bids.insert(bid);
        }
        else {
          // Update the existing entry
          poloOrderBooks.bids.array[index].rate = bid.rate;
          poloOrderBooks.bids.array[index].amount = bid.amount;
        }
      }
      break;
    case 'sell':
    /*
      var sell = {rate: parseFloat(response.rate), amount: parseFloat(response.amount)};
      // Locate the order book entry for this rate
      var index = poloOrderBooks.bids.search(sell);
      if (-1 == index) {
        winston.log('error', 'Sell Order Inconsistent with Books');
      }
      else {
        // Remove the quantity sold from the books
        poloOrderBooks.bids.array[index].amount -= sell.amount;
      }
      */
      break;
    case 'buy':
    /*
      var buy = {rate: parseFloat(response.rate), amount: parseFloat(response.amount)};
      // Locate the order book entry for this rate
      var index = poloOrderBooks.asks.search(buy);
      if (-1 == index) {
        winston.log('error', 'Buy Order Inconsistent with Books');
      }
      else {
        // Remove the quantity bought from the books
        poloOrderBooks.asks.array[index].amount -= buy.amount;
      }
      */
      break;
    default:
      winston.log('error', "Unknown Response Type: " + response.type)
  }
  displayBooks();

  // TODO - Debug ------------------------------------
  //console.log(response.rate);
  /*
  if (parseFloat(response.rate) == trackedRate) {
    console.log('!!!!!!!!!!!!!!!!!!');
    console.log(response.updateType);
    console.log(response.type);
    if (response.updateType != 'orderBookRemove') {
      console.log(response.amount);
    }

    if (response.type == 'bid' || response.type == 'sell') {
      var bid = {rate: parseFloat(response.rate), amount: parseFloat(response.amount)};
      index = poloOrderBooks.bids.search(bid);
      if (-1 == index) {
        console.log('!!!Yikes!!!');
      }
      else {
        console.log("New amount: " + poloOrderBooks.bids.array[index].amount);
      }
    }
  }
  */
  /*
  var bid = {rate: trackedRate, amount: 0};
  index = poloOrderBooks.bids.search(bid);
  if (-1 == index) {
    console.log('!!!Yikes!!!');
  }
  else {
    console.log("Index: " + index + " Amount: " + poloOrderBooks.bids.array[index].amount);
  }
  */
  // TODO - Debug ------------------------------------
}


let checkResponseBuffer = () => {
  var checkAgain = true;

  while (checkAgain) {
    checkAgain = false;
    for (var i = (poloOrderBuffer.length - 1); i >= 0; i--) {
      if (poloOrderBuffer[i].seq < poloOrderBooks.seq) {
        // Entry is stale
        winston.log('silly', "Removing stale buffered seq " + poloOrderBuffer[i].seq);
        poloOrderBuffer.splice(i, 1);
        checkAgain = true;
      }
      else if ((poloOrderBuffer[i].seq == poloOrderBooks.seq) || (poloOrderBuffer[i].seq == (poloOrderBooks.seq + 1))) {
        // Add the entry to the books and remove it from the buffer
        poloOrderBooks.seq = poloOrderBuffer[i].seq;
        winston.log('silly', "Removing buffered seq " + poloOrderBuffer[i].seq);
        addBookEntry(poloOrderBuffer[i]);
        poloOrderBuffer.splice(i, 1);
        checkAgain = true;
      }
    }
  }
}


let handleOrder = (order) => {
  // TODO: Possible error when a sequence number is buffered prior to getting the order books
  // and then the order books return the same sequence number

  // TODO: Need a way to get back into sync if an order is missed

  if (poloOrderBooks.seq == 0) {
    // We haven't finished initializing the order books yet. Queue the order.
    winston.log('silly', "Buffering seq " + order.seq);
    poloOrderBuffer.unshift(order);
  }
  else if (order.seq < poloOrderBooks.seq) {
    winston.log('silly', "Ignoring stale seq " + order.seq);
  }
  else if (order.seq <= (poloOrderBooks.seq + 1)) {
    // We received the next order in the sequence. Add the entry.
    // Note: The Poloniex wrapper splits messages containing multiple orders into
    // separate messages containing the same sequence number. So there may be
    // duplicate sequences. However, these should always be received consecutively.
    winston.log('silly', "Adding seq " + order.seq);
    poloOrderBooks.seq = order.seq;
    addBookEntry(order);
  }
  else {
    // Add the out-of-sequence order to the beggining of the array
    winston.log('silly', "Buffering seq " + order.seq);
    poloOrderBuffer.unshift(order);
  }

  if (poloOrderBuffer.length > BUFFER_DEPTH) {
    winston.log('info', 'Re-syncing Order Book');
    // Empty the buffer and retrieve the order book
    poloOrderBuffer = [];
    setTimeout(getOrderBook, 500);

    //winston.log('error', 'Too many orders buffered');
    //process.exit();
  }
}


let getBooks = (loglevel) => {
  // Update the log level
  if (loglevel) {
    winston.level = loglevel;
  }
  winston.log('info', "loglevel=" + winston.level);

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

// Set up the CLI commands and options
program
  .version(pkg.version)
  .command('hello <requiredArg1> [optionalArg2]')
  .description('command description')
  .option('-o, --option', 'this is an option')
  .action(myFunction)

program
  .command('trollbox')
  .description("Don't feed the trolls")
  .action(getTrollbox)

program
  .command('books [loglevel]')
  .description('Display Poloniex order books')
  .action(getBooks)

// Parse the CLI commands and options
program.parse(process.argv);

if (program.args.length === 0) {
  program.help();
}
