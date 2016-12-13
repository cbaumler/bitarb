import { Meteor } from 'meteor/meteor';

import { apiPush } from '/imports/api/server/push.js';

// Import the module
//var polo = require("../../api/server/push.js");
//var polo = require("poloniex-unofficial");

// Get access to the push API
//var apiPush = polo.api("push");
//var apiPush = polo.apiPush;

// Set up sync API
//const trollboxFiber = Meteor.wrapAsync(apiPush.trollbox);

// Now let's watch the mayhem of the trollbox from a safe distance
apiPush.trollbox((err, response) => {
    // Check for any errors
    if (err) {
        // Log the error message
        console.log("An error occurred: " + err.msg);

        // Send kill signal
        return true;
    }

    // Format and log the chat message
    console.log(response.username + ": " + response.message);
});

Meteor.startup(() => {
  // code to run on server at startup

});
