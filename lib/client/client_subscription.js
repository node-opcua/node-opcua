

var util = require("util");
var EventEmitter = require("events").EventEmitter;

var OPCUAClient = require("../opcua-client").OPCUAClient;
var OPCUASession = require("../opcua-client").OPCUASession;

var ClientSidePublishEngine = require("./client_publish_engine").ClientSidePublishEngine;

/**
 *
 *
 * events:
 *    "started",     callback(subscriptionId)  : the subscription has been initiated
 *    "terminated"                             : the subscription has been deleted
 *    "error",                                 : the subscription has received an error
 * @param session
 * @param options
 * @constructor
 */
function ClientSubscription(session,options) {
    assert(session instanceof OPCUASession);

    var self = this;
    // install a publishing engine on the session object
    if (!session.common_publish_engine) {
        session.common_publish_engine = new ClientSidePublishEngine(session);
    }
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

    self.session            = session;
    self.publishingInterval = options.requestedPublishingInterval;
    self.lifetimeCount      = options.requestedLifetimeCount;
    self.maxKeepAliveCount  = options.requestedMaxKeepAliveCount;
    self.maxNotificationsPerPublish = options.maxNotificationsPerPublish;
    self.publishingEnabled  = options.publishingEnabled;
    self.priority           = options.priority;
    self.subscriptionId     = "pending";

    session.createSubscription(options,function(err,response){
        if (err) {
            self.emit("error",err);
            self.emit("terminated");
        } else {
            self.subscriptionId      = response.subscriptionId;
            self.publishingInterval  = response.revisedPublishingInterval;
            self.lifetimeCount       = response.revisedLifetimeCount;
            self.maxKeepAliveCount   = response.revisedMaxKeepAliveCount;
            self.emit("started",self.subscriptionId);
        }
    });
}
util.inherits(ClientSubscription,EventEmitter);

ClientSubscription.prototype.terminate = function() {
    var self = this;
    self.session.deleteSubscriptions({
        subscriptionIds: [ self.subscriptionId]
    },function(err,response){
        if (err) {
            self.emit("error",err);
        }
        self.emit("terminated");
    });
};
exports.ClientSubscription = ClientSubscription;