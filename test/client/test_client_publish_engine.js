
var subscription_service = require("../../lib/subscription_service");
var s = require("../../lib/structures");
var StatusCodes = require("../../lib/opcua_status_code").StatusCodes;
var assert = require("better-assert");
var should = require("should");
var _ = require("underscore");
var NotificationMessage = subscription_service.NotificationMessage;
var sinon = require("sinon");

var ClientSidePublishEngine = require("../../lib/client/client_publish_engine").ClientSidePublishEngine



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

        publish_client.stop();
    });

    it("a client should acknowledge sequence numbers received in PublishResponse in next PublishRequest",function(){

        // the spec says: Clients are required to acknowledge  Notification Messages as they are received.

        var response_maker = sinon.stub();

        var response1 = new subscription_service.PublishResponse({
            subscriptionId: 1,
            availableSequenceNumbers : [],
            moreNotifications: false,
            notificationMessage: {
                sequenceNumber: 36,
                publishTime: new Date(),
                notificationData: []
            }
        });
        var response2 = new subscription_service.PublishResponse({
            subscriptionId: 44,
            availableSequenceNumbers : [],
            moreNotifications: false,
            notificationMessage: {
                sequenceNumber: 78,
                publishTime: new Date(),
                notificationData: []
            }
        });
        response_maker.onCall(0).returns([null,response1]);
        response_maker.onCall(1).returns([null,response2]);
        response_maker.onCall(2).returns([null,response2]);
        response_maker.onCall(3).returns([null,response2]);

        var fake_session = {
            publish: function (request, callback) {
                callback.apply(this,response_maker());
            }
        };
        var spy = sinon.spy(fake_session, "publish");

        var publish_client = new ClientSidePublishEngine(fake_session);
        publish_client.keepalive_interval = 1000; // 1 second

        publish_client.start();
        // now advance the time artificially by 4.5 seconds
        this.clock.tick(500 + 4 * 1000);
        publish_client.stop();

        var publishRequest1 = spy.getCall(0).args[0];
        publishRequest1._schema.name.should.equal("PublishRequest");
        publishRequest1.subscriptionAcknowledgements.should.eql([]);

        var publishRequest2 = spy.getCall(1).args[0];
        publishRequest2._schema.name.should.equal("PublishRequest");
        publishRequest2.subscriptionAcknowledgements.should.eql([{ sequenceNumber: 36, subscriptionId:1 }]);

        var publishRequest3 = spy.getCall(2).args[0];
        publishRequest3._schema.name.should.equal("PublishRequest");
        publishRequest3.subscriptionAcknowledgements.should.eql([{ sequenceNumber: 78, subscriptionId:44 }]);

    });

});