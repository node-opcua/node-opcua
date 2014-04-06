

var util = require("util");
var EventEmitter = require("events").EventEmitter;
var subscription_service = require("../subscription_service");

var OPCUAClient = require("../opcua-client").OPCUAClient;
var OPCUASession = require("../opcua-client").OPCUASession;

var ClientSidePublishEngine = require("./client_publish_engine").ClientSidePublishEngine;

var StatusCodes = require('../opcua_status_code').StatusCodes;
/**
 *
 *
 * events:
 *    "started",     callback(subscriptionId)  : the subscription has been initiated
 *    "terminated"                             : the subscription has been deleted
 *    "error",                                 : the subscription has received an error
 *    "keepalive",                             : the subscription has received a keep alive message from the server
 *    "received_notifications",                : the subscription has received one or more notification
 * @param session
 * @param options
 * @constructor
 */
function ClientSubscription(session,options) {
    assert(session instanceof OPCUASession);

    var self = this;
    self.publish_engine = new ClientSidePublishEngine(session,{ keep_alive_interval: 100});
    // options should have
    var allowedProperties =[
        'requestedPublishingInterval',
        'requestedLifetimeCount',
        'requestedMaxKeepAliveCount',
        'maxNotificationsPerPublish',
        'publishingEnabled',
        'priority'
    ];

    options = options || {};
    options.requestedPublishingInterval = options.requestedPublishingInterval || 100;
    options.requestedLifetimeCount      = options.requestedLifetimeCount      || 60;
    options.requestedMaxKeepAliveCount  = options.requestedMaxKeepAliveCount  || 2;
    options.maxNotificationsPerPublish  = options.maxNotificationsPerPublish  || 2;
    options.publishingEnabled           = options.publishingEnabled  ? true: false;
    options.priority                    = options.priority  || 1;


    self.publishingInterval = options.requestedPublishingInterval;
    self.lifetimeCount      = options.requestedLifetimeCount;
    self.maxKeepAliveCount  = options.requestedMaxKeepAliveCount;
    self.maxNotificationsPerPublish = options.maxNotificationsPerPublish;
    self.publishingEnabled  = options.publishingEnabled;
    self.priority           = options.priority;
    self.subscriptionId     = "pending";

    self._next_client_handle = 0;
    self.monitoredItems     = {};

    setImmediate(function(){

        session.createSubscription(options,function(err,response){

            if (err) {
                self.emit("error",err);
            } else {
                self.subscriptionId      = response.subscriptionId;
                self.publishingInterval  = response.revisedPublishingInterval;
                self.lifetimeCount       = response.revisedLifetimeCount;
                self.maxKeepAliveCount   = response.revisedMaxKeepAliveCount;

                self.publish_engine.registerSubscriptionCallback(self.subscriptionId,function(notificationData,publishTime){
                    self.__on_publish_response(notificationData,publishTime);
                });
                setImmediate(function(){
                    self.emit("started",self.subscriptionId);
                });
            }
        });
    });
}
util.inherits(ClientSubscription,EventEmitter);

ClientSubscription.prototype.__on_publish_response  = function (notificationData,publishTime) {

    var self = this;


    if (notificationData.length === 0 ) {
        // this is a keep alive message
        self.emit("keepalive");
    } else {

        //xx require("../utils").dump(notificationData);
        // we have valid notifications
        self.emit("received_notifications");
        // let publish a global event


        // now inform each individual monitored item
        notificationData.forEach(function(changeNotification){
            // DataChangeNotification or EventNotification
            if (changeNotification._schema.name === "DataChangeNotification") {
                var monitoredItems = changeNotification.monitoredItems;
                monitoredItems.forEach(function(monitoredItem){
                    var monitorItemObj =self.monitoredItems[monitoredItem.clientHandle];
                    assert(monitorItemObj);
                    monitorItemObj.emit("changed",monitoredItem.value);
                });
            }
        });
    }

};


ClientSubscription.prototype.__defineGetter__("session",function(){
    return this.publish_engine.session;
});

ClientSubscription.prototype.terminate = function() {
    var self = this;
    self._terminate();
};

ClientSubscription.prototype._terminate = function() {

    var self = this;
    self.publish_engine.unregisterSubscriptionCallback(self.subscriptionId);
    self.session.deleteSubscriptions({
        subscriptionIds: [ self.subscriptionId]
    },function(err,response){
        if (err) {
            self.emit("error",err);
        }
        setImmediate(function(){
            self.emit("terminated");
            self.subscriptionId = "terminated";
        });
    });
};

ClientSubscription.prototype.nextClientHandle = function() {
    this._next_client_handle += 1;
    return this._next_client_handle;
};

/**
 * ClientMonitoredItem
 * event:
 *    "initialized"
 *    "error"
 *    "changed"
 *
 * @param subscription  {ClientSubscription}
 * @param itemToMonitor {ItemToMonitor}
 * @param parameters
 * @constructor
 */
function ClientMonitoredItem(subscription,itemToMonitor,parameters){
    assert(subscription instanceof ClientSubscription);
    this.itemToMonitor = itemToMonitor;
    this.parameters = parameters;
    this.subscription = subscription;
}

util.inherits(ClientMonitoredItem,EventEmitter);

/**
 * remove the MonitoredItem from its subscription
 *
 * @param done : done callback
 */
ClientMonitoredItem.prototype.terminate = function(done) {
    var self = this;
    this.subscription._delete_monitored_item(this.monitoredItemId,function(err){
        self.emit("terminated");
        done(err);
    });
};



ClientMonitoredItem.prototype._monitor = function(monitoredItem) {

    var self = this;
    var subscription = this.subscription;
    var requestedParameters = this.parameters;

    requestedParameters.clientHandle = subscription.nextClientHandle();
    assert(requestedParameters.clientHandle>0);

    assert(subscription.subscriptionId !== "pending");

    var createMonitorItemsRequest = new subscription_service.CreateMonitoredItemsRequest({
        subscriptionId: subscription.subscriptionId,
        // timestampsToReturn:
        itemsToCreate: [
            {
                itemToMonitor: self.itemToMonitor,
                monitoringMode: subscription_service.MonitoringMode.Reporting,
                requestedParameters: requestedParameters
            }
        ]
    });
    subscription.session.createMonitoredItems(createMonitorItemsRequest,function(err,response){

        assert(response instanceof subscription_service.CreateMonitoredItemsResponse);
        var monitoredItemResult = response.results[0];
        if(monitoredItemResult.statusCode == StatusCodes.Good) {
            monitoredItem.result    = monitoredItemResult;
            monitoredItem.monitoredItemId = monitoredItemResult.monitoredItemId;
            monitoredItem.parameters.samplingInterval = monitoredItemResult.revisedSamplingInterval;
            monitoredItem.parameters.queueSize = monitoredItemResult.revisedQueueSize;
            monitoredItem.filterResult = monitoredItemResult.filterResult;
            monitoredItem.emit("initialized");

            monitoredItem.subscription.emit("item_added",monitoredItem);

            subscription.monitoredItems[requestedParameters.clientHandle]=monitoredItem;// [monitoredItem.monitoredItemId] = monitoredItem;

        } else {
            console.log(" monitoredItemResult statusCode = ", monitoredItemResult.statusCode.toString());
            require("../utils").dump(response);
            require("../utils").dump(createMonitorItemsRequest);
            monitoredItem.emit("item_error",monitoredItemResult.statusCode);
        }
    });
};

/**
 * add a monitor item to the subscription
 *
 * @param itemToMonitor       // like {ReadValueId}
 * @param requestedParameters // like {MonitoringParameters}
 *
 * @returns {ClientMonitoredItem}
 *
 * @example:
 *
 * clientSubscription.monitor(
 *   // itemToMonitor:
 *   {
 *       nodeId: 'ns=0;i=2258',
 *       attributeId: 13,
 *       indexRange: null,
 *       dataEncoding: { namespaceIndex: 0, name: null }
 *   },
 *   // monitoringMode:
 *   'Reporting',
 *   // requestedParameters:
 *   {
 *       clientHandle: 13,
 *       samplingInterval: 3000,
 *       filter:  { parameterTypeId: 'ns=0;i=0',  encodingMask: 0 },
 *       queueSize: 1,
 *       discardOldest: true
 *   });
 *
 */
ClientSubscription.prototype.monitor = function (itemToMonitor, requestedParameters, done) {

    assert(itemToMonitor.nodeId);
    assert(itemToMonitor.attributeId);

    var self = this;

    var monitoredItem = new ClientMonitoredItem(this,itemToMonitor,requestedParameters);

    function wait_for_subscription_and_monitor()  {
        if (self.subscriptionId === "pending") {
            // the subscriptionID is not yet known because the server hasn't replied yet
            // let postpone this call, a little bit, to let thinks happen
            setImmediate(wait_for_subscription_and_monitor);
        } else if (self.subscriptionId === "terminated") {
            // the subscription has been terminated in the meantime
            // this indicates a potential issue in the code using this api.
            if(_.isFunction(done)) { done(new Error("subscription has been deleted")); }
        } else {
            monitoredItem._monitor(monitoredItem);
            if(_.isFunction(done)) { done(); }
        }
    }
    setImmediate(wait_for_subscription_and_monitor);
    return monitoredItem;
};

ClientSubscription.prototype.isActive = function(){
    var self = this;
    return typeof(self.subscriptionId) !== "string";
};

ClientSubscription.prototype._delete_monitored_item = function(monitoredItemId,callback) {
    var self = this;
    assert(self.isActive());

    self.session.deleteMonitoredItems({
        subscriptionId: self.subscriptionId,
        monitoredItemIds: [monitoredItemId]
    },function(err,result){
        callback(err);
    });
};



exports.ClientSubscription = ClientSubscription;
