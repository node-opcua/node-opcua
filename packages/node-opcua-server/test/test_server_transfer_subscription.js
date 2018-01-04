var should = require("should");
var sinon = require("sinon");

var server_engine = require("../src/server_engine");
var subscription_service = require("node-opcua-service-subscription");
var StatusCodes = require("node-opcua-status-code").StatusCodes;
var PublishRequest = subscription_service.PublishRequest;


var describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("ServerEngine Subscriptions Transfer", function () {


    var engine, session1, FolderTypeId, BaseDataVariableTypeId;

    beforeEach(function (done) {


        engine = new server_engine.ServerEngine();
        engine.initialize({nodeset_filename: server_engine.mini_nodeset_filename}, function () {
            FolderTypeId = engine.addressSpace.findNode("FolderType").nodeId;
            BaseDataVariableTypeId = engine.addressSpace.findNode("BaseDataVariableType").nodeId;
            done();
        });
    });

    afterEach(function () {
        session1 = null;
        should.exist(engine);
        engine.shutdown();
        engine = null;

    });


    it("should transfer a subscription",function() {

        session1 = engine.createSession();

        var subscription = session1.createSubscription({
            id: 12345,
            requestedPublishingInterval: 1000,  // Duration
            requestedLifetimeCount: 10,         // Counter
            requestedMaxKeepAliveCount: 10,     // Counter
            maxNotificationsPerPublish: 10,     // Counter
            publishingEnabled: true,            // Boolean
            priority: 14                        // Byte
        });



        session2 = engine.createSession();

        var transferResult = engine.transferSubscription(session2,subscription.id,true);
        transferResult.statusCode.should.eql(StatusCodes.Good);
        transferResult.availableSequenceNumbers.length.should.eql(0);


        var publishSpy = sinon.spy();
        session1.publishEngine._on_PublishRequest(new PublishRequest({requestHeader:{ requestHandle: 101}}),publishSpy );
        session1.publishEngine._on_PublishRequest(new PublishRequest({requestHeader:{ requestHandle: 102}}),publishSpy );
        session1.publishEngine._on_PublishRequest(new PublishRequest({requestHeader:{ requestHandle: 103}}),publishSpy );
        session1.publishEngine._on_PublishRequest(new PublishRequest({requestHeader:{ requestHandle: 104}}),publishSpy );


        publishSpy.callCount.should.eql(4);

        //xx console.log(publishSpy.getCall(0).args[1].toString());

        publishSpy.getCall(0).args[1].subscriptionId.should.eql(subscription.subscriptionId);
        publishSpy.getCall(0).args[1].responseHeader.serviceResult.should.eql(StatusCodes.Good);
        publishSpy.getCall(0).args[1].notificationMessage.sequenceNumber.should.eql(1);
        publishSpy.getCall(0).args[1].notificationMessage.notificationData[0].constructor.name.should.eql("StatusChangeNotification");
        publishSpy.getCall(0).args[1].notificationMessage.notificationData[0].statusCode.should.eql(StatusCodes.GoodSubscriptionTransferred);


        subscription.terminate();

    });

});
