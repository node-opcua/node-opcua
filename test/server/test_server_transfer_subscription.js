require("requirish")._(module);
var should = require("should");
import ServerEngine, {
    mini_nodeset_filename
} from "lib/server/ServerEngine";
var browse_service = require("lib/services/browse_service");
var read_service = require("lib/services/read_service");
var subscription_service = require("lib/services/subscription_service");
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var makeNodeId = require("lib/datamodel/nodeid").makeNodeId;
var VariableIds = require("lib/opcua_node_ids").VariableIds;
import SubscriptionState from "lib/server/SubscriptionState";
var PublishRequest = subscription_service.PublishRequest;


var util = require("util");
var assert = require("better-assert");

var sinon = require("sinon");


var TimestampsToReturn = read_service.TimestampsToReturn;
var NodeId = require("lib/datamodel/nodeid").NodeId;
var AttributeIds = read_service.AttributeIds;
var DataType = require("lib/datamodel/variant").DataType;
var Variant = require("lib/datamodel/variant").Variant;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;
var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;
var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
var BrowseDirection = browse_service.BrowseDirection;
var server_NamespaceArray_Id = makeNodeId(VariableIds.Server_NamespaceArray); // ns=0;i=2255

var resourceLeakDetector = require("test/helpers/resource_leak_detector").resourceLeakDetector;


describe("ServerEngine Subscriptions Transfer", function () {


    var engine, session1, session2, FolderTypeId, BaseDataVariableTypeId;

    beforeEach(function (done) {

        resourceLeakDetector.start();

        engine = new ServerEngine();
        engine.initialize({nodeset_filename: mini_nodeset_filename}, function () {
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

        resourceLeakDetector.stop();
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

    })

});
