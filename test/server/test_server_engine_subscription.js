var should = require("should");
var server_engine = require("../../lib/server/server_engine");
var resolveNodeId = require("../../lib/nodeid").resolveNodeId;
var NodeClass = require("../../lib/browse_service").NodeClass;
var browse_service = require("../../lib/browse_service");
BrowseDirection = browse_service.BrowseDirection;
var read_service = require("../../lib/read_service");
var TimestampsToReturn = read_service.TimestampsToReturn;
var util = require("util");
var NodeId = require("../../lib/nodeid").NodeId;
var assert = require('better-assert');
var AttributeIds = read_service.AttributeIds;

var DataType = require("../../lib/variant").DataType;
var StatusCodes = require("../../lib/opcua_status_code").StatusCodes;
var makeNodeId = require("../../lib/nodeid").makeNodeId;
var ReferenceType = require("../../lib/opcua_node_ids").ReferenceType;
var VariableIds = require("../../lib/opcua_node_ids").Variable;
var Variant = require("../../lib/variant").Variant;
var VariantArrayType =  require("../../lib/variant").VariantArrayType;

var server_NamespaceArray_Id =  makeNodeId(VariableIds.Server_NamespaceArray); // ns=0;i=2255

describe("ServerEngine Subscriptions service", function () {


    var server,FolderTypeId,BaseDataVariableTypeId;
    beforeEach(function(done){
        server = new server_engine.ServerEngine();
        server.initialize(null,function(){
            FolderTypeId = server.findObject("FolderType").nodeId;
            BaseDataVariableTypeId = server.findObject("BaseDataVariableType").nodeId;
            done();
        });

    });
    afterEach(function(){
        server = null;
    });

    it("should return an error when trying to delete an non-existing subscription",function(){

        server.deleteSubscription(-6789).should.eql(StatusCodes.Bad_SubscriptionIdInvalid);

    });

    it("should check the subscription live cycle",function(){

        server.currentSubscriptionCount.should.equal(0);
        server.cumulatedSubscriptionCount.should.equal(0);

        var subscription = server.createSubscription();

        server.currentSubscriptionCount.should.equal(1);
        server.cumulatedSubscriptionCount.should.equal(1);

        server.getSubscription(subscription.id).should.equal(subscription);

        var statusCode = server.deleteSubscription(subscription.id);
        statusCode.should.eql(StatusCodes.Good);

        server.currentSubscriptionCount.should.equal(0);
        server.cumulatedSubscriptionCount.should.equal(1);
    });

});
