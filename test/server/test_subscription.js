var should =require("should");
var sinon = require("sinon");

var subscription_service = require("../../lib/subscription_service");
var NotificationMessage = subscription_service.NotificationMessage;
var StatusCodes = require("../../lib/opcua_status_code").StatusCodes;
var Subscription = require("../../lib/server/subscription").Subscription;

describe("Subscriptions", function () {
    beforeEach(function () {
        this.clock = sinon.useFakeTimers();
    });
    afterEach(function () {
        this.clock.restore();
    });

    it("a subscription will make sure that maxLifeTimeCount is at least 3 times  maxKeepAliveCount", function () {

        {
           var subscription = new Subscription({
                publishingInterval: 1000,
                maxKeepAliveCount:  20,
                maxLifeTimeCount:   60 // at least 3 times maxKeepAliveCount
            });
            subscription.maxKeepAliveCount.should.eql(20);
            subscription.maxLifeTimeCount.should.eql(60);
        }
        {
            var subscription = new Subscription({
                publishingInterval: 1000,
                maxKeepAliveCount:  20,
                maxLifeTimeCount:   1 // at least 3 times maxKeepAliveCount
            });
            subscription.maxKeepAliveCount.should.eql(20);
            subscription.maxLifeTimeCount.should.eql(60);
        }

    });

    it("a subscription that have a new notification ready every publishingInterval shall send notifications and no keepalive", function () {

        var subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount:  20,
            maxLifeTimeCount:   60 // at least 3 times maxKeepAliveCount
        });

        subscription.maxKeepAliveCount.should.eql(20);

        subscription.on("perform_update", function () {
            //  pretend there is always something to notify
            this.addNotificationMessage({});
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
            publishingInterval: 1000,   // 1 second interval
            maxLifeTimeCount:   100000, // very long lifeTimeCount not to be bother by client not pinging us
            maxKeepAliveCount:  20
        });

        subscription.on("perform_update", function () {
            /* pretend that we do not have a notification ready */
        });

        var notification_event_spy = sinon.spy();
        var keepalive_event_spy = sinon.spy();
        var expire_event_spy = sinon.spy();

        subscription.on("notification", notification_event_spy);
        subscription.on("notification", function(){
            subscription.popNotificationToSend();
        });
        subscription.on("keepalive", keepalive_event_spy);
        subscription.on("expired", expire_event_spy);

        // no notification ready, during 7 seconds
        this.clock.tick(subscription.publishingInterval * 7);

        notification_event_spy.callCount.should.equal(0);
        keepalive_event_spy.callCount.should.equal(1);
        expire_event_spy.callCount.should.equal(0);

        // a notification finally arrived !
        subscription.addNotificationMessage({});

        this.clock.tick(subscription.publishingInterval * 4);

        notification_event_spy.callCount.should.equal(1);
        keepalive_event_spy.callCount.should.equal(1);
        expire_event_spy.callCount.should.equal(0);

        // a other notification finally arrived !
        subscription.addNotificationMessage({});

        this.clock.tick(subscription.publishingInterval * 4);
        notification_event_spy.callCount.should.equal(2);
        keepalive_event_spy.callCount.should.equal(1);
        expire_event_spy.callCount.should.equal(0);

        subscription.terminate();

    });

    it("a subscription that hasn't been pinged by client within the lifetime interval shall terminate", function () {

        var subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20
        });
        subscription.on("perform_update", function () {
            this.addNotificationMessage({});
        });

        var expire_event_spy = sinon.spy();
        subscription.on("expired", expire_event_spy);
        var terminate_spy = sinon.spy(subscription, "terminate");

        this.clock.tick(subscription.publishingInterval * (subscription.maxLifeTimeCount - 2));

        terminate_spy.callCount.should.equal(0);
        expire_event_spy.callCount.should.equal(0);

        this.clock.tick(subscription.publishingInterval * (subscription.maxLifeTimeCount + 2));

        terminate_spy.callCount.should.equal(1);
        expire_event_spy.callCount.should.equal(1);

        subscription.terminate();
    });

    it("a subscription that has been pinged by client before the lifetime expiration shall not terminate", function () {

        var subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20
        });
        subscription.on("perform_update", function () {
            this.addNotificationMessage({});
        });

        var expire_event_spy = sinon.spy();
        subscription.on("expired", expire_event_spy);
        var terminate_spy = sinon.spy(subscription, "terminate");

        this.clock.tick(subscription.publishingInterval * (subscription.maxLifeTimeCount - 2));

        terminate_spy.callCount.should.equal(0);
        expire_event_spy.callCount.should.equal(0);

        subscription.reset_life_time_counters();

        this.clock.tick(subscription.publishingInterval * 4);

        terminate_spy.callCount.should.equal(0);
        expire_event_spy.callCount.should.equal(0);

        this.clock.tick(subscription.publishingInterval * (subscription.maxLifeTimeCount + 2));
        terminate_spy.callCount.should.equal(1);
        expire_event_spy.callCount.should.equal(1);
    });

    it("a subscription that has no notification within maxKeepAliveCount shall send a keepalive signal ", function () {

        var subscription = new Subscription({
            publishingInterval: 1000,
            maxLifeTimeCount: 100000, // very large lifetime not to be bother by client not pinging us
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
        keepalive_event_spy.callCount.should.equal(1);

        this.clock.tick(subscription.publishingInterval * 10);

        terminate_spy.callCount.should.equal(0);
        expire_event_spy.callCount.should.equal(0);
        notification_event_spy.callCount.should.equal(0);
        keepalive_event_spy.callCount.should.equal(2);

        this.clock.tick(subscription.publishingInterval * (subscription.maxKeepAliveCount + 3));

        terminate_spy.callCount.should.equal(0);
        expire_event_spy.callCount.should.equal(0);
        notification_event_spy.callCount.should.equal(0);
        keepalive_event_spy.callCount.should.equal(3);

    });

    it("a subscription shall maintain a retransmission queue of pending NotificationMessages.",function(){

        var subscription = new Subscription({
            id: 1234,
            publishingInterval: 1000,
            maxLifeTimeCount: 1000,
            maxKeepAliveCount: 20
        });

        subscription.pendingNotificationsCount.should.equal(0);
        subscription.addNotificationMessage({});
        subscription.pendingNotificationsCount.should.equal(1);

    });

    //OPC Unified Architecture, Part 4 74 Release 1.01
    it("a subscription shall maintain a retransmission queue of sent NotificationMessages.",function(){

        var subscription = new Subscription({
            id: 1234,
            publishingInterval: 1000,
            maxLifeTimeCount: 1000,
            maxKeepAliveCount: 20
        });

        subscription.pendingNotificationsCount.should.equal(0);
        subscription.sentNotificationsCount.should.equal(0);

        subscription.addNotificationMessage({});
        subscription.pendingNotificationsCount.should.equal(1);
        subscription.sentNotificationsCount.should.equal(0);

        var notification = subscription.popNotificationToSend();
        subscription.pendingNotificationsCount.should.equal(0);
        subscription.sentNotificationsCount.should.equal(1);


    });
    describe("NotificationMessages are retained in this queue until they are acknowledged or until they have been in the queue for a minimum of one keep-alive interval.",function(){
        it("a NotificationMessage is retained in this queue until it is acknowledged",function(){

            var subscription = new Subscription({
                id: 1234,
                publishingInterval: 1000,
                maxLifeTimeCount: 1000,
                maxKeepAliveCount: 20
            });

            subscription.addNotificationMessage({});
            subscription.addNotificationMessage({});
            subscription.pendingNotificationsCount.should.equal(2);
            subscription.sentNotificationsCount.should.equal(0);

            var notification1 = subscription.popNotificationToSend();
            subscription.pendingNotificationsCount.should.equal(1);
            subscription.sentNotificationsCount.should.equal(1);

            var notification2 = subscription.popNotificationToSend();
            subscription.pendingNotificationsCount.should.equal(0);
            subscription.sentNotificationsCount.should.equal(2);

            subscription.acknowledgeNotification(notification2.sequenceNumber);
            subscription.pendingNotificationsCount.should.equal(0);
            subscription.sentNotificationsCount.should.equal(1);

            subscription.acknowledgeNotification(notification1.sequenceNumber);
            subscription.pendingNotificationsCount.should.equal(0);
            subscription.sentNotificationsCount.should.equal(0);

        });
        it("a NotificationMessage is retained until it has been in the queue for a minimum of one keep-alive interval.",function(){
            var subscription = new Subscription({
                id: 1234,
                publishingInterval: 1000,
                maxLifeTimeCount: 1000,
                maxKeepAliveCount: 20 //
            });
            // create a notification at t=0
            subscription.addNotificationMessage({});
            subscription.popNotificationToSend();
            subscription.sentNotificationsCount.should.equal(1);

            this.clock.tick(1000*5);
            // create a notification at t=1000*5
            subscription.addNotificationMessage({});
            subscription.popNotificationToSend();
            subscription.sentNotificationsCount.should.equal(2);

            this.clock.tick(1000*20);
            // now check that at t=1000*25 , old notification has been discarded
            subscription.sentNotificationsCount.should.equal(1);

            this.clock.tick(1000*100);
            // now check that at t=1000*100 , old notification has been discarded
            subscription.sentNotificationsCount.should.equal(0);

        });

    });



    it("a subscription send a first message at the end of the first publishing cycle without waiting for the maximum  count to be reached",function(){
        /**
         * When a Subscription is created, the first Message is sent at the end of the first publishing cycle to
         * inform the Client that the Subscription is operational. A Notification Message is sent if there are
         * Notifications ready to be reported. If there are none, a keep-alive Message is sent instead that
         * contains a sequence number of 1, indicating that the first Notification Message has not yet been
         * sent. This is the only time a keep-alive Message is sent without waiting for the maximum keep-alive
         * count to be reached, as specified in (f) above.
         *
         */
        var subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20
        });
        subscription.on("perform_update", function () {
          // nothing
        });
        var notification_event_spy = sinon.spy();
        var keepalive_event_spy = sinon.spy();
        var expire_event_spy = sinon.spy();

        subscription.on("notification", notification_event_spy);
        subscription.on("keepalive", keepalive_event_spy);
        subscription.on("expired", expire_event_spy);

        this.clock.tick(100);
        keepalive_event_spy.callCount.should.equal(1);


    });

    it("the first Notification Message sent on a Subscription has a sequence number of 1.",function(){
        var subscription = new Subscription();
        subscription._get_future_sequence_number().should.equal(1);
        subscription._get_next_sequence_number().should.equal(1);
        subscription._get_next_sequence_number().should.equal(2);
        subscription._get_next_sequence_number().should.equal(3);
        subscription._get_future_sequence_number().should.equal(4);
    });
    it("the Notification Message sequence number should roll over to 1 after reaching four billion",function(){
        var subscription = new Subscription();
        subscription._get_future_sequence_number().should.equal(1);

        var max_counter_value =SequenceNumberGenerator.prototype.MAXVALUE;
        subscription._sequence_number_generator._set(max_counter_value);

        subscription._get_future_sequence_number().should.equal(max_counter_value);
        subscription._get_next_sequence_number().should.equal(max_counter_value);

        subscription._get_future_sequence_number().should.equal(1);
        subscription._get_next_sequence_number().should.equal(1);

    });
    it("closing a Subscription causes its MonitoredItems to be deleted. ",function(){

    });

});

