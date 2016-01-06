var opcua = require("node-opcua");
var BrowseDirection = opcua.browse_service.BrowseDirection;
var read_service = opcua.read_service;
var write_service = opcua.write_service;
var ReadRequest = read_service.ReadRequest;
var AttributeIds = read_service.AttributeIds;
var TimestampsToReturn = read_service.TimestampsToReturn;
var WriteValue = write_service.WriteValue;

var options = {}; // could provide options
var client = new opcua.OPCUAClient(options);
var reconnectClient = null;

var endpointUrl = null;
var opcSession = null;
var log;

var isConnected = false;
var isDisconnecting = false;
var socket = null;
var opcSession = null;
var subscriptions = [];
var lastReconnect = 0;
var lastReconnectTimerId = 0;
var reconnectTimeout = 10000;
var connectInProcess = false;

exports.monitor = function (template, url) {
   log = new Log(true); // true writes debug messages to console

   if (endpointUrl && url != endpointUrl) {
      // could of course implement more that on connection
      log.log("Error: Cannot use monitor for multiple opc Servers...");
      return; 
   }

   endpointUrl = url;
   
   if (!opcSession) {
      connect(function (err, session) {
         if (err) {
            node.error('Error connection to Server');
            return;
         }
         opcSession = session;
         startMonitor(template);
      });
   } else {
      startMonitor(template);
   }
}

function startMonitor(template) {
   if (template) {
      for (var k = 0; k < subscriptions.length; k++) {
         if (subscriptions[k].name === template.template) {
            // we stop, when any given subscription is running already
            log.log("ERR_MONITOR_ACTIVE", "Error: Monitor already active - stop the monitor first, " + template.template);
            return;
         }
      }

      // load data itmes and check whether we have still active subscriptions
      // create subscription
      var options = readOptions(template);
      var s = new Subscription(template.template, opcSession, template.items, options);
      subscriptions.push(s);
      s.startMonitor();
   }

   function readOptions(json) {
      var options = {};
      options.sendSnapshot = json.sendSnapshot || false;
      setNumber('publishingInterval');
      setNumber('checkIsAliveInterval');
      setNumber('lastDataReceivedTimeout');
      setNumber('keepAliveCount');

      return (options);

      function setNumber(opt) {
         if (json.hasOwnProperty(opt)) {
            if (!isNaN(json[opt])) options[opt] = json[opt] * 1;
         }
      }
   }
}

// here is all the reconnect stuff
function cleanup(callback) {
   closeSessionAliveTimer(); // closes all subscriptions alive timer
   if (opcSession) {
      closeSession(function (err, response) {
         _disconnect();
      });
   } else {
      _disconnect();
   }

   function _disconnect() {
      if (client && isConnected && !isDisconnecting) {
         // disconnect may take quiet a while, when connection has broken...
         isDisconnecting = true;
         var disconnectCallbackTiemout = setTimeout(function () {
            // in case disconnect does not return after 5 Minutes we kill the client
            client = null;
            _closed();
         }, 5 * 60 * 1000);
         client.disconnect(function () {
            // hopefully disconnected
            clearTimeout(disconnectCallbackTiemout);
            isDisconnecting = false;
            _closed();
         });
      } else {
         _closed();
      }
   }

   function _closed() {
      for (var i = 0; i < subscriptions.length; i++) {
         subscriptions[i].cleanup();
      }
      writeDataTypes = {};
      isDisconnecting = false;
      isConnected = false;
      if (callback) callback();
   }
}

function connect(callback) {
   // jst make sure we have no timer running
   closeSessionAliveTimer();
   if (isConnected) {
      createSession();
   } else {
      openSecureChannel(client, function (err) {
         if (!err) {
            createSession();
         }
      });
   }

   function createSession() {
      client.createSession(options, function (err, session) {
         callback(err, session);
      });
   }
}

function openSecureChannel(opcClient, callback) {
   opcClient.connect(endpointUrl, function (err) {
      if (err) {
         console.log("cannot connect to endpoint:", endpointUrl);
         callback(err);
      }
      else {
         isConnected = true;
         console.log("connected to: " + endpointUrl);
         socket = opcClient._secureChannel._transport._socket;

         socket.on("close", function (err) {
            if (err) {
               // we have a communication error
               log.log("ERR_CONNECTION", "Socket error - communication to server is broken");
               triggerReconnect();
            } else {
               log.debug("communication to server CLOSED");
               cleanup(); // just in case
            }
         });

         callback(null);
      }
   });
}

function closeSession(callback) {
   try {
      if (opcSession) opcSession.close(function (err, response) {
         opcSession = null;
         callback(err, response);
      });
   } catch (e) {
      opcSession = null;
      callback(e, null);
   }
}

function closeSessionAliveTimer() {
   for (var i = 0; i < subscriptions.length; i++) {
      subscriptions[i].closeAliveTimer();
   }
}

function triggerReconnect() {
   // Once we have more than one subscription - need to close / clean all timers in subscriptions
   // >> clean every subscription
   closeSessionAliveTimer(); // just make sure we are not beeing called again
   // we are not cleaning up - try to create a reconnect client
   reconnectClient = new opcua.OPCUAClient(options);
   lastReconnect = (new Date()).getTime();
   // call reconnect() again and again until reconnect succeeds
   // make sure we do NEVER set the interval when it is already running
   connectInProcess = false;
   if (lastReconnectTimerId === 0) lastReconnectTimerId = setInterval(reconnect, reconnectTimeout);
   reconnect();
}

function reconnect() {
   if (connectInProcess) return;

   connectInProcess = true;
   openSecureChannel(reconnectClient, function (err) {
      if (err) {
         log.log('reconnection failed, error connecting to Server');
         connectInProcess = false;
         return;
      }

      clearInterval(lastReconnectTimerId);
      lastReconnectTimerId = 0;

      // try to reactivate our session
      reconnectClient.reactivateSession(opcSession, function (err) {
         // no matter whether we have an error, we do have a new channel
         client = reconnectClient;
         reconnectClient = null;
         // in case of success we should have our subscription still active
         if (err) {
            log.log("Unable to reactivate Session - re-creating new session");
            lastReconnectTimerId = setInterval(reconnectNewSession, reconnectTimeout);  // re-create timer with reconnectNewSession handler
            opcSession = null;
            for (var i = 0; i < subscriptions.length; i++) {
               subscriptions[i].itemObjects = null;
            }
            reconnectNewSession();
         } else {
            connectInProcess = false;
         }
      });
   });
}

function reconnectNewSession() {
   connectInProcess = true;
   connect(function (err, session) {
      connectInProcess = false;
      if (err) {
         log.log('reconnection failed, error connecting to Server');
         return;
      }

      clearInterval(lastReconnectTimerId);
      lastReconnectTimerId = 0;
      opcSession = session;
      for (var i = 0; i < subscriptions.length; i++) {
         subscriptions[i].newSession(session);
         subscriptions[i].startMonitor();
      }
   });
}

var Subscription = (function () {

   function Subscription(name, session, items, options) {
      this.name = name;
      this.session = session;
      this.itemList = items;            // monitor item list
      this.opcSubscription = null;
      this.itemObjects = null;         // opc monitor objects

      this.publishingInterval = options.publishingInterval || 500;
      this.checkIsAliveInterval = options.checkIsAliveInterval || 10 * 1000;
      this.isAliveTimeout = options.isAliveTimeout || 60000;
      this.lastDataReceivedTimeout = options.lastDataReceivedTimeout || 60000;
      if (this.lastDataReceivedTimeout < 30000) this.lastDataReceivedTimeout = 30000;

      if (this.publishingInterval < 100 || this.publishingInterval > 5000) this.publishingInterval = 1000;
      this.keepAliveCount = this.publishingInterval > 2000 ? 1 : 2;
      if (this.publishingInterval < 500) this.keepAliveCount = 4;
      if (options.hasOwnProperty("keepAliveCount") && options.keepAliveCount > this.keepAliveCount) this.keepAliveCount = options.keepAliveCount;
      this.sendSnapshot = options.sendSnapshot || false;

      this.isAliveTimerId = 0;

      this.lastPayloadSent = 0;
      this.lastDataReceived = 0;
      this.lastIsAlive = 0;

      this.record = {};
   }

   Subscription.prototype.newSession = function (sNew) {
      this.session = sNew;
   }

   Subscription.prototype.cleanup = function () {
      this.closeAliveTimer();
      this.changedTimerId = 0;
      this.lastPayloadSent = 0;
      this.lastDataReceived = 0;
      this.lastIsAlive = 0;

      if (this.itemObjects || this.opcSubscription) {
         // should not happen
         this.stopMonitor(function () { });
      }
   }

   Subscription.prototype.closeAliveTimer = function () {
      if (this.isAliveTimerId) {
         clearInterval(this.isAliveTimerId);
         this.isAliveTimerId = 0;
      }
   }

   Subscription.prototype.stopMonitor = function (callback) {
      var self = this;
      if (this.itemObjects) {
         var items = this.itemObjects;
         var iterator = 0;
         stopItem();  // calls terminateSubscription() when done
      } else {
         done();
      }

      function stopItem() {
         try {
            var item = items[iterator].item;
            item.terminate(function (done) {
               iterator++;
               if (iterator < items.length) {
                  stopItem();
               } else {
                  // done
                  done();
               }
            });
         } catch (e) {
            // item is dead, we assume that all items are subsequently dead
            done();
         }
      }

      function done() {
         terminateSubscription();
         callback();
      }

      function terminateSubscription() {
         try {
            if (self.opcSubscription) self.opcSubscription.terminate();
         } catch (e) { }

         self.opcSubscription = null;
         self.itemObjects = null;
      }
   }

   // start Monitor for all items
   Subscription.prototype.startMonitor = function () {
      var self = this;

      if (!this.itemList || this.itemList.length === 0) {
         log.log("FATAL_ERROR", "Fatal Error: no items to monitor");
         return;
      }

      this.record = {};

      if (this.itemObjects || this.opcSubscription) {
         this.stopMonitor(function () {
            subscribeAndMonitor();
         });
      } else {
         subscribeAndMonitor();
      }

      function subscribeAndMonitor() {
         self.opcSubscription = subscribe();
         // iterate items to  monitor;
         // could override from template...
         self.itemObjects = [];
         self.lastPayloadSent = 0;

         for (var i = 0; i < self.itemList.length; i++) {
            var monitorItem = new ItemMonitor(self, self.itemList[i], handler);
            self.record[monitorItem.name] = ""; // May get current value
            self.itemObjects.push(monitorItem);
            log.debug("Starting monitor for item: " + monitorItem.name + ", id:  " + monitorItem.id);
            monitorItem.startMonitorItem();
         }
      }

      function handler(monitorItem, event, payload) {
         var parent = monitorItem.opcSubscription;
         switch (event) {
            case "changed":
               sendData();
               break;

            default:
               // do nothing
         }

         function sendData() {
            monitorItem.hasChangedCount = 0;  // hasChangedCount could be used for item groups (not implemented here)
            if (!self.sendSnapshot) {
               var json = createReturnRecord(payload, monitorItem.id);
               sendMsg({ name: monitorItem.name, value: json });
            } else {
               var json = createReturnRecord(payload, monitorItem.id, self.includeTemplateId);
               self.record[monitorItem.name] = json;
               sendCurrentMultiRecord();
            }
         }
      }

      function createReturnRecord(opcIn, id) {
         var json = {
            value: opcIn.value.value,
            id: id,
            statusValue: opcIn.statusCode.value,
            sourceTimestamp: opcIn.sourceTimestamp.getTime(),
            serverTimestamp: opcIn.serverTimestamp.getTime()
         };
         if (json.statusValue != 0) json.statusName = opcIn.statusCode.name;
         return json;
      }

      function sendCurrentMultiRecord() {
         // this should be synchronized code
         // JavaScript and node js are single threaded, code blocks should always synchronized
         if (self.changedTimerId !== 0) {
            clearTimeout(self.changedTimerId);
            self.changedTimerId = 0;
         }
         self.lastPayloadSent = (new Date()).getTime();
         sendMsg({ 'payload': self.record });
         if (self.itemObjects) {
            // itemObjects could be null when this is triggered via timeout and the opcSubscription has been closed
            for (var i = 0; i < self.itemObjects.length; i++) { self.itemObjects[i].hasChangedCount = 0; }
         }
      }

      function subscribe() {
         // Could implement callback when '.on("Started") is issued, currently we simply pass back the opcSubscription
         if (!self.session) return;

         var options = {
            requestedPublishingInterval: self.publishingInterval,   // millisecs: interval when server should gather item values
            requestedMaxKeepAliveCount: self.keepAliveCount,        // number of times the publishing interval returns no changes before sending 'keep alive'   
            requestedLifetimeCount: 1000,                           // number of times publishing interval has returned no values in which case opcSubscription is closed
            maxNotificationsPerPublish: 10,                         // max number of item changes (per item) in one message                 
            publishingEnabled: true,
            priority: 10
         }

         var opcSubscription = new opcua.ClientSubscription(self.session, options);
         log.debug("new subscription instance created");
         opcSubscription.on("started", function () {
            log.debug("subscription started, subscriptionId=" + opcSubscription.subscriptionId);
         });
         opcSubscription.on("keepalive", function () {
            self.lastIsAlive = (new Date()).getTime();
            log.debug("keepalive - template: " + self.name);
         });
         opcSubscription.on("internal_error", function (err) {
            log.log("internal_error: " + err.toString() + ", template: " + self.name);
         });
         opcSubscription.on("status_changed", function (status, info) {
            log.debug("status_changed: template: " + self.name);
         });

         opcSubscription.on("terminated", function () {
            log.debug("subscription terminated: template: " + self.name);
            self.itemObjects = null;
         });

         self.lastIsAlive = (new Date()).getTime();
         self.isAliveTimerId = setInterval(checkIsAlive, self.checkIsAliveInterval);
         function checkIsAlive() {
            if (self.opcSubscription) {
               var isActive = self.opcSubscription.isActive();
               var now = (new Date()).getTime();
               if (!isActive) {
                  log.log('SUBSCRIPTION_INACTIVE - Subscription is no longer active - trying to resubscribe, ' + self.name);
                  triggerReconnect();
                  return;
               }
               if ((self.lastIsAlive + self.isAliveTimeout) < now) {
                  log.log('NO_SERVER_ACTIVITY - Server isAlive has timed out, last activity before: ' + ((now - self.lastIsAlive) / 1000) + ' seconds - trying to resubscribe' + self.name);
                  // cleanup will CLOSE this timer!
                  // new opcSubscription re-opens the timer
                  triggerReconnect();
                  return;
               }

               if ((self.lastDataReceived + self.lastDataReceivedTimeout) < now) {
                  log.log('NO_SERVER_DATA - Server has not sent any data for: ' + ((now - self.lastDataReceived) / 1000) + " seconds" + self.name);
               }

               log.debug(self.name + ": Last Server Activity (seconds ago): " + ((now - self.lastIsAlive) / 1000) + " timestamp: " + now);
               log.debug(self.name + ": Last Server sent data (seconds ago): " + ((now - self.lastDataReceived) / 1000) + " timestamp: " + now);
            }
         }

         return opcSubscription;
      }
   }

   var ItemMonitor = (function () {
      function ItemMonitor(subscription, descriptor, callback) {
         this.subscription = subscription;
         this.descriptor = descriptor;
         this.name = descriptor.map;
         this.id = descriptor.id;
         this.publishingInterval = subscription.publishingInterval;
         this.callback = callback;
         this.item = null;
         this.hasChangedCount = 0;
      }

      ItemMonitor.prototype.startMonitorItem = function () {
         try {
            var self = this;
            var subscription = this.subscription;
            var opcSubscription = subscription.opcSubscription;
            var requestParams = { publishingInterval: self.publishingInterval, discardOldest: true, queueSize: 100 };
            
            var monitoredItem = opcSubscription.monitor({ nodeId: opcua.resolveNodeId(self.id), attributeId: AttributeIds.Value },
                                              requestParams, TimestampsToReturn.Both, function (result) { });
            monitoredItem.on("terminated", function (value) {
               log.debug("monitor - treminated: " + self.name);
               self.callback(self, "terminated", value);
            });

            monitoredItem.on("err", function (msg) {
               log.log("monitor - error: " + self.name + ", " + msg);
            });

            monitoredItem.on("changed", function (value) {
               subscription.lastIsAlive = (new Date()).getTime(); // last interaction this could block a "keep alive" call
               subscription.lastDataReceived = subscription.lastIsAlive;

               self.hasChangedCount++;
               log.debug("monitor - changed: " + self.name + "=" + value.value.value + ", changedCount: " + self.hasChangedCount);
               self.callback(self, "changed", value);
            });

            this.item = monitoredItem;
         } catch (e) {
            var err = "Fatal error in monitor " + self.name + ": " + e.toString();
            log.log(err);
         }
      }

      ItemMonitor.prototype.stopMonitor = function (callback) {
         this.item.terminate(function (done) {
            if (callback) callback(done);
         });
      }

      return ItemMonitor;
   })();


   return Subscription;
})();


function sendMsg(msg) {
   // for testing we just send it to console
   log.debug(msg);
}

var Log = (function () {

   function Log(isdebug) {
      this.isdebug = isdebug;
      if (isdebug) console.log("Log level set to debug");
   }

   Log.prototype.debug = function (msg) {
      if (this.debug) console.log(msg);
   }

   Log.prototype.log = function (msg) {
      console.log(msg);
   }
   return Log;
})();
