var should = require("should");
var server_engine = require("../../lib/server/server_engine");
var resolveNodeId = require("../../lib/datamodel/nodeid").resolveNodeId;
var NodeClass = require("../../lib/datamodel/nodeclass").NodeClass;
var browse_service = require("../../lib/services/browse_service");
BrowseDirection = browse_service.BrowseDirection;
var read_service = require("../../lib/services/read_service");
var TimestampsToReturn = read_service.TimestampsToReturn;
var util = require("util");
var NodeId = require("../../lib/datamodel/nodeid").NodeId;
var assert = require('better-assert');
var AttributeIds = read_service.AttributeIds;

var DataType = require("../../lib/datamodel/variant").DataType;
var StatusCodes = require("../../lib/datamodel/opcua_status_code").StatusCodes;
var makeNodeId = require("../../lib/datamodel/nodeid").makeNodeId;
var VariableIds = require("../../lib/opcua_node_ids").VariableIds;
var Variant = require("../../lib/datamodel/variant").Variant;
var VariantArrayType =  require("../../lib/datamodel/variant").VariantArrayType;

var server_NamespaceArray_Id =  makeNodeId(VariableIds.Server_NamespaceArray); // ns=0;i=2255


describe("ServerEngine Subscriptions service", function () {


    var engine,session,FolderTypeId,BaseDataVariableTypeId;
    beforeEach(function(done){
        engine = new server_engine.ServerEngine();
        engine.initialize(null,function(){
            FolderTypeId = engine.findObject("FolderType").nodeId;
            BaseDataVariableTypeId = engine.findObject("BaseDataVariableType").nodeId;
            done();
        });

        session  = engine.createSession();

    });
    afterEach(function(){
        should(engine).not.equal(null);
        engine.shutdown();
        engine = null;
    });

    it("should return an error when trying to delete an non-existing subscription",function(){

        session.deleteSubscription(-6789).should.eql(StatusCodes.Bad_SubscriptionIdInvalid);

    });

    it("should check the subscription live cycle",function(){



        session.currentSubscriptionCount.should.equal(0);
        session.cumulatedSubscriptionCount.should.equal(0);

        var subscription = session.createSubscription({
            requestedPublishingInterval: 1000,  // Duration
            requestedLifetimeCount: 10,         // Counter
            requestedMaxKeepAliveCount: 10,     // Counter
            maxNotificationsPerPublish: 10,     // Counter
            publishingEnabled: true,            // Boolean
            priority: 14                        // Byte
        });

        session.currentSubscriptionCount.should.equal(1);
        session.cumulatedSubscriptionCount.should.equal(1);

        session.getSubscription(subscription.id).should.equal(subscription);

        var statusCode = session.deleteSubscription(subscription.id);
        statusCode.should.eql(StatusCodes.Good);

        session.currentSubscriptionCount.should.equal(0);
        session.cumulatedSubscriptionCount.should.equal(1);

        engine.currentSubscriptionCount.should.equal(0);
        engine.cumulatedSubscriptionCount.should.equal(1);

    });

    it("should maintain the correct number of  cumulatedSubscriptionCount at the engine leve",function() {

        var subscription_parameters = {
            requestedPublishingInterval: 1000,  // Duration
                requestedLifetimeCount: 10,         // Counter
            requestedMaxKeepAliveCount: 10,     // Counter
            maxNotificationsPerPublish: 10,     // Counter
            publishingEnabled: true,            // Boolean
            priority: 14                        // Byte
        };

        engine.currentSubscriptionCount.should.equal(0);
        engine.cumulatedSubscriptionCount.should.equal(0);

        engine.currentSessionCount.should.equal(1);
        engine.cumulatedSessionCount.should.equal(1);

        var subscription1 = session.createSubscription(subscription_parameters);

        engine.currentSubscriptionCount.should.equal(1);
        engine.cumulatedSubscriptionCount.should.equal(1);

        var subscription2 = session.createSubscription(subscription_parameters);
        engine.currentSubscriptionCount.should.equal(2);
        engine.cumulatedSubscriptionCount.should.equal(2);



        session.deleteSubscription(subscription2.id);
        engine.currentSubscriptionCount.should.equal(1);
        engine.cumulatedSubscriptionCount.should.equal(2);


        // Create a new session
        var session2 = engine.createSession();
        engine.currentSessionCount.should.equal(2);
        engine.cumulatedSessionCount.should.equal(2);
        engine.currentSubscriptionCount.should.equal(1);

        session2.createSubscription(subscription_parameters);
        session2.createSubscription(subscription_parameters);
        session2.createSubscription(subscription_parameters);

        engine.currentSubscriptionCount.should.equal(4);
        engine.cumulatedSubscriptionCount.should.equal(5);

        // close the session, asking to delete subscriptions
        engine.closeSession(session2.authenticationToken,/* deleteSubscription */true);

        engine.currentSessionCount.should.equal(1);
        engine.cumulatedSessionCount.should.equal(2);
        engine.currentSubscriptionCount.should.equal(1);
        engine.cumulatedSubscriptionCount.should.equal(5);


        session.deleteSubscription(subscription1.id);

        engine.currentSubscriptionCount.should.equal(0);
        engine.cumulatedSubscriptionCount.should.equal(5);



    });

});
