/**
 *
 *  OPCUA protocol defines a long-pooling mechanism for sending server-triggered events back to the client.
 *  Therefore the Publish service behalves slightly differently from other OPCUA services:
 *    - the client will send Publish requeststo the server without expecting an immediate answer from the server.
 *    - The server will block the request until some subscriptions have some available data, or a time out
 *
 *
 *    - the Publish Request message is also used by the client to acknwoledge processing of notification messages.
 *
 *    n this mode, the client can sent
 *  A good algorithm for a client is to send more publish request than live subscription.
 *
 *
 *   - Publish Request are not tied to a particular subscription, the Server will use the oldest pending
 *     client  Publish request to send some notification regarding the notifying subscription.
 *
 *
 * preventing queue overflow
 * -------------------------
 *  - if the client send too many publish requests that the server can queue, the server may return a Service result
 *    of BadTooManyPublishRequests.
 *
 * Keep alive mechanism:
 * ---------------------
 *    Publish Request/Response are also use as a keep alive signal between the server and the client.
 *    Every publish request is a live ping from the client to the server.
 *    Every publish response is a live ping from the server to the client.
 *
 *    If no notificiation are available after the keep-alive timeout intervak, the server shall return an empty
 *    PublishResponse and therefore notifies the client about a valid connection.
 *    Similarly, the client shall send Publish Request
 *
 *
 */
/**
 *
 * @param opcua_client
 * @constructor
 */
var subscription_service = require("../lib/subscription_service");
var s = require("../lib/structures");
var assert = require("better-assert");
var should = require("should");
var _ = require("underscore");

function ClientSidePublishEngine(session) {

    assert(session instanceof Object);
    this.session = session;
    this.keepalive_interval = 1000;
    this.subscriptionAcknowledgements = [];
}
ClientSidePublishEngine.prototype.start = function () {
    var self = this;
    self.publish_timer_id = setInterval(function () {
        self._send_publish_request()
    }, self.keepalive_interval);
};

ClientSidePublishEngine.prototype.stop = function () {
    var self = this;
    clearInterval(self.publish_timer_id);
};


ClientSidePublishEngine.prototype.acknowledge_notification = function (subscriptionId, sequenceNumber) {
    this.subscriptionAcknowledgements.push({
        subscriptionId: subscriptionId,
        sequenceNumber: sequenceNumber
    });
};

ClientSidePublishEngine.prototype._send_publish_request = function () {

    var self = this;
    var subscriptionAcknowledgements = self.subscriptionAcknowledgements;
    self.subscriptionAcknowledgements = [];

    var publish_request = new subscription_service.PublishRequest({
        subscriptionAcknowledgements: subscriptionAcknowledgements
    });
    this.session.publish(publish_request, function (err, response) {
        if (err) {

        } else {
            // the id of the subscription sending the notification message
            var subscriptionId = response.subscriptionId;

            // the sequence numbers available in this subscription
            // for retransmission and not acknoledged by the client
            var available_seq = response.availableSequenceNumbers;

            var moreNotifications = response.moreNotifications;

            var notificationMessage = response.notificationMessage;
            //  notificationMessage.sequenceNumber
            //  notificationMessage.publishTime
            //  notificationMessage.notificationData[]

            self.acknowledge_notification(subscriptionId, notificationMessage.sequenceNumber);

        }
        //
    });
};

var EventEmitter = require("events").EventEmitter;
var util = require("util");
function Subscription(options) {

    options = options || {};

    EventEmitter.apply(this, arguments);
    var self = this;

    self.id = options.id || "<invalid_id>";
    self.publishingInterval = options.publishingInterval || 1000;

    // the live time count defines how many times the publish interval expires without
    // having a connection to the client to deliver data.
    self.liveTimeCount = options.liveTimeCount || 10;
    self.live_without_client = 0;

    // the keep alive count defines how many times the publish interval need to
    // expires without having notifications available before the server send an
    // empty message.
    self.maxKeepAliveCount = options.maxKeepAliveCount || 10;
    self.curKeepAliveCount = 0;

    self.timerId = setInterval(function () {
        self._tick();
    }, self.publishingInterval);

}
util.inherits(Subscription, EventEmitter);

Subscription.prototype.__defineGetter__("has_pending_notification", function () {
    var self = this;
    return self.notification;
});
Subscription.prototype.set_notification = function (notification) {
    var self = this;
    self.notification = notification;
};

/**
 *
 * @private
 */
Subscription.prototype._tick = function () {
    var self = this;

    // request a notification update
    self.emit("perform_update");

    self.live_without_client += 1;
    if (self.live_without_client >= self.liveTimeCount) {
        self.emit("expired");
        // kill timer
        self.terminate();
    } else if (self.has_pending_notification) {
        self.emit("notification", self.notification);
        self.curKeepAliveCount = 0;
        self.notification = null;
    } else {
        self.curKeepAliveCount += 1;
        if (self.curKeepAliveCount >= self.maxKeepAliveCount) {
            self.emit("keepalive");
            self.curKeepAliveCount = 0;
        }
    }
};

/**
 *
 *  the server invokes the ping_from_client method of the subscription
 *  when the client has send a Publish Request, so that the subscription
 *  can reset its live_without_client counter.
 *
 */
Subscription.prototype.ping_from_client = function () {
    var self = this;
    self.live_without_client = 0;
};

Subscription.prototype.terminate = function () {
    var self = this;
    clearTimeout(self.timerId);
    self.timerId = 0;
};

function ServerSidePublishEngine() {
    var self = this;

    self.__next_sequence_number = 0;

    self._publish_request_queue = [];

    self._sent_notifications = {};
    self._pending_notifications = {};

    self.availableSequenceNumbers = [];

}

function make_subscription_sequenceNumber_key(subscriptionId, sequenceNumber) {
    return subscriptionId.toString() + "#" + sequenceNumber.toString();
}

function make_subscriptionAcknowledgement_key(subscriptionAcknowledgement) {
    return make_subscription_sequenceNumber_key(
        subscriptionAcknowledgement.subscriptionId,
        subscriptionAcknowledgement.sequenceNumber);
}

ServerSidePublishEngine.prototype.process_subscriptionAcknowledgements = function (subscriptionAcknowledgements) {
    // process acknowledgements
    subscriptionAcknowledgements.forEach(function (subscriptionAcknowledgement) {
        var key = make_subscriptionAcknowledgement_key(subscriptionAcknowledgement);
        delete self._sent_nofitifications[key];
    });
};

ServerSidePublishEngine.prototype._on_PublishRequest = function (request) {

    var self = this;
    self.process_subscriptionAcknowledgements(request.subscriptionAcknowledgements);
    // add the publish request to the queue for later processing
    self._publish_request_queue.push({ request: request });
};

// counter
ServerSidePublishEngine.prototype._get_next_sequence_number = function () {
    this.__next_sequence_number += 1;
    return this.__next_sequence_number;
};
// counter
ServerSidePublishEngine.prototype._get_future_sequence_number = function () {
    return this.__next_sequence_number+1;
};
/**
 * call by a subscription when a notification message is ready
 *
 */
ServerSidePublishEngine.prototype.send_notification_message = function (subscriptionId, notificationMessage) {
    assert(notificationMessage instanceof NotificationMessage);
    var self = this;
    var sequence_number = self._get_next_sequence_number();

};
/**
 * call by a subscription when no notification message is available after the keep alive delay has
 * expired.
 *
 */
ServerSidePublishEngine.prototype.send_keep_alive_response = function (subscriptionId) {

    var self = this;
    var p = self._publish_request_queue.shift();
    //xx ({ request: request });

    //  this keep-alive Message informs the Client that the Subscription is still active.
    //  Each keep-alive Message is a response to a Publish request in which the  notification Message
    //  parameter does not contain any Notifications and that contains the sequence number of the next
    //  Notification Message that is to be sent.

    var future_sequence_number = self._get_future_sequence_number();

    var response = new subscription_service.PublishResponse({
        subscriptionId: subscriptionId,
        availableSequenceNumbers: self.availableSequenceNumbers,
        moreNotifications: false,
        notificationMessage: {
            sequenceNumber: future_sequence_number,
            publishTime: new Date(),
            notificationData: [ /* empty */]
        }
    });

    self.send_response_for_request(p.request,response);

};
ServerSidePublishEngine.prototype.send_response_for_request = function(request,response){

};
ServerSidePublishEngine.prototype.add_subscription = function(subscription) {

   assert(subscription.id);
   var publish_engine = this;
   subscription.on("keepalive",function(){

       publish_engine.send_keep_alive_response(subscription.id);

   }).on("terminate",function(){

   }).on("notification",function(){

   });
};
ServerSidePublishEngine.prototype.remove_subscription = function(subscription) {
    subscription.terminate();
};

ServerSidePublishEngine.prototype.__defineGetter__("pendingPublishRequestCount",function(){
    return this._publish_request_queue.length;
});

var sinon = require("sinon");

describe("Testing the subscription notification publishing mechanism", function () {
    beforeEach(function () {
        this.clock = sinon.useFakeTimers();
    });
    afterEach(function () {
        this.clock.restore();
    });
    it("a subscription that have a new notification ready every publishingInterval shall send notifications and no keepalive", function () {

        var subscription = new Subscription({
            publishingInterval: 1000,
            liveTimeCount: 10,
            maxKeepAliveCount: 20
        });
        subscription.on("perform_update", function () {
            this.set_notification({});
        });

        var notification_event_spy = sinon.spy();
        var keepalive_event_spy = sinon.spy();
        subscription.on("notification", notification_event_spy);
        subscription.on("keepalive", keepalive_event_spy);

        this.clock.tick(subscription.publishingInterval * 4);

        notification_event_spy.callCount.should.be.greaterThan(2);
        keepalive_event_spy.callCount.should.equal(0);

        subscription.terminate();

    });

    it("a subscription that have only some notification ready before max_keepalive_count expired shall send notifications and no keepalive", function () {
        var subscription = new Subscription({
            publishingInterval: 1000,
            liveTimeCount: 100000, // very long liveTimeCount not to be bother by client not pinging us
            maxKeepAliveCount: 20
        });
        subscription.on("perform_update", function () {
            /* pretend that we do not have a notification ready */
        });

        var notification_event_spy = sinon.spy();
        var keepalive_event_spy = sinon.spy();
        var expire_event_spy = sinon.spy();

        subscription.on("notification", notification_event_spy);
        subscription.on("keepalive", keepalive_event_spy);
        subscription.on("expired", expire_event_spy);

        this.clock.tick(subscription.publishingInterval * 7);
        notification_event_spy.callCount.should.equal(0);
        keepalive_event_spy.callCount.should.equal(0);
        expire_event_spy.callCount.should.equal(0);

        // a notification finally arrived !
        subscription.set_notification({});
        this.clock.tick(subscription.publishingInterval * 4);
        notification_event_spy.callCount.should.equal(1);
        keepalive_event_spy.callCount.should.equal(0);
        expire_event_spy.callCount.should.equal(0);

        // a notification finally arrived !
        subscription.set_notification({});
        this.clock.tick(subscription.publishingInterval * 4);
        notification_event_spy.callCount.should.equal(2);
        keepalive_event_spy.callCount.should.equal(0);
        expire_event_spy.callCount.should.equal(0);

        subscription.terminate();

    });

    it("a subscription that hasn't been pinged by client within the live time interval shall terminate", function () {

        var subscription = new Subscription({
            publishingInterval: 1000,
            liveTimeCount: 10,
            maxKeepAliveCount: 20
        });
        subscription.on("perform_update", function () {
            this.set_notification({});
        });

        var expire_event_spy = sinon.spy();
        subscription.on("expired", expire_event_spy);
        var terminate_spy = sinon.spy(subscription, "terminate");

        this.clock.tick(subscription.publishingInterval * (subscription.liveTimeCount - 2));

        terminate_spy.callCount.should.equal(0);
        expire_event_spy.callCount.should.equal(0);

        this.clock.tick(subscription.publishingInterval * (subscription.liveTimeCount + 2));

        terminate_spy.callCount.should.equal(1);
        expire_event_spy.callCount.should.equal(1);

        subscription.terminate();
    });

    it("a subscription that has been pinged by client before the live time expiration shall not terminate", function () {

        var subscription = new Subscription({
            publishingInterval: 1000,
            liveTimeCount: 10,
            maxKeepAliveCount: 20
        });
        subscription.on("perform_update", function () {
            this.set_notification({});
        });

        var expire_event_spy = sinon.spy();
        subscription.on("expired", expire_event_spy);
        var terminate_spy = sinon.spy(subscription, "terminate");

        this.clock.tick(subscription.publishingInterval * (subscription.liveTimeCount - 2));

        terminate_spy.callCount.should.equal(0);
        expire_event_spy.callCount.should.equal(0);

        subscription.ping_from_client();

        this.clock.tick(subscription.publishingInterval * 4);

        terminate_spy.callCount.should.equal(0);
        expire_event_spy.callCount.should.equal(0);

        this.clock.tick(subscription.publishingInterval * (subscription.liveTimeCount + 2));
        terminate_spy.callCount.should.equal(1);
        expire_event_spy.callCount.should.equal(1);
    });

    it("a subscription that has no notification within maxKeepAliveCount shall send a keepalive signal ", function () {

        var subscription = new Subscription({
            publishingInterval: 1000,
            liveTimeCount: 100000, // very large live time not to be bother by client not pinging us
            maxKeepAliveCount: 20
        });
        subscription.on("perform_update", function () {
            // pretend there is no notification ready
        });

        var expire_event_spy = sinon.spy();
        var notification_event_spy = sinon.spy();
        var keepalive_event_spy = sinon.spy();
        subscription.on("expired", expire_event_spy);
        subscription.on("notification", notification_event_spy);
        subscription.on("keepalive", keepalive_event_spy);

        var terminate_spy = sinon.spy(subscription, "terminate");

        this.clock.tick(subscription.publishingInterval * (subscription.maxKeepAliveCount - 5));

        terminate_spy.callCount.should.equal(0);
        expire_event_spy.callCount.should.equal(0);
        notification_event_spy.callCount.should.equal(0);
        keepalive_event_spy.callCount.should.equal(0);

        this.clock.tick(subscription.publishingInterval * 10);

        terminate_spy.callCount.should.equal(0);
        expire_event_spy.callCount.should.equal(0);
        notification_event_spy.callCount.should.equal(0);
        keepalive_event_spy.callCount.should.equal(1);

        this.clock.tick(subscription.publishingInterval * (subscription.maxKeepAliveCount + 3));

        terminate_spy.callCount.should.equal(0);
        expire_event_spy.callCount.should.equal(0);
        notification_event_spy.callCount.should.equal(0);
        keepalive_event_spy.callCount.should.equal(2);

    });

});

describe("Testing the client publish engine", function () {

    beforeEach(function () {
        this.clock = sinon.useFakeTimers();
    });

    afterEach(function () {
        this.clock.restore();
    });

    it("a client should send a publish request to the server, on a regular basis", function () {

        var fake_session = {
            publish: function (request, callback) {
            }
        };

        var spy = sinon.spy(fake_session, "publish");

        var publish_client = new ClientSidePublishEngine(fake_session);
        publish_client.keepalive_interval = 1000; // 1 second

        publish_client.start();

        // now advance the time artificially by 4.5 seconds
        this.clock.tick(500 + 4 * 1000);

        // publish should have been called 3 times at least
        spy.callCount.should.be.greaterThan(3);

        // args[0] shall be a Publish Request
        spy.getCall(0).args[0]._schema.name.should.equal("PublishRequest");
        assert(_.isFunction(spy.getCall(0).args[1]));

        spy.restore();


    });

});

describe("Testing the server publish engine", function () {

    beforeEach(function () {
        this.clock = sinon.useFakeTimers();
    });

    afterEach(function () {
        this.clock.restore();
    });

    it("a server should send keep alive notifications", function () {

        var publish_server = new ServerSidePublishEngine();

        var subscription = new Subscription({
            id: 1234,
            publishingInterval: 1000,
            liveTimeCount: 1000,
            maxKeepAliveCount: 20
        });

        publish_server.add_subscription(subscription);

        // client sends a PublishRequest to the server
        var fake_request1 = new subscription_service.PublishRequest({
            process_subscriptionAcknowledgements: []
        });
        publish_server._on_PublishRequest(fake_request1);

        var fake_request2 = new subscription_service.PublishRequest({
            process_subscriptionAcknowledgements: []
        });
        publish_server._on_PublishRequest(fake_request2);
        publish_server.pendingPublishRequestCount.should.equal(2);

        this.clock.tick(subscription.publishingInterval * 19);
        publish_server.pendingPublishRequestCount.should.equal(2);

        this.clock.tick(subscription.publishingInterval * 3);
        publish_server.pendingPublishRequestCount.should.equal(1);



    });


    it("a server should send an empty response on a regular basis, when there is no notification", function (done) {

        var publish_server = new ServerSidePublishEngine();
        publish_server.publishing_interval = 1000;
        publish_server.maxKeepAliveCount = 10;

        // client sends a PublishRequest to the server
        var fake_request1 = new subscription_service.PublishRequest({
            process_subscriptionAcknowledgements: []
        });
        publish_server._on_PublishRequest(fake_request1);

        done();

    });

    it("a server sould return Bad_NoSubscription as a response for a publish Request if there  is no subscription available for this session. ",function(){
        // todo.
    });
});