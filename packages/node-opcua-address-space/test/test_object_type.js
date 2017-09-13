"use strict";
/* global describe,it,before*/

var should = require("should");

var StatusCodes = require("node-opcua-status-code").StatusCodes;
var DataType = require("node-opcua-variant").DataType;
var AttributeIds = require("node-opcua-data-model").AttributeIds;

var NodeId = require("node-opcua-nodeid").NodeId;

var address_space = require("..");
var UAObjectType = require("..").UAObjectType;
var SessionContext = require("..").SessionContext;
var context = SessionContext.defaultContext;

var create_minimalist_address_space_nodeset = require("../test_helpers/create_minimalist_address_space_nodeset");
var describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("testing UAObjectType", function () {

    var addressSpace;

        before(function () {
            addressSpace = new address_space.AddressSpace();
            create_minimalist_address_space_nodeset(addressSpace);
        });
        after(function (done) {
            if (addressSpace){
                addressSpace.dispose();
                addressSpace = null;
            }
            done();
        });

    it("should read Attribute IsAbstract on UAObjectType ", function () {

        var objType = new UAObjectType({
            browseName: "MyObject",
            addressSpace: addressSpace,
            isAbstract: false
        });

        var value;
        value = objType.readAttribute(context, AttributeIds.IsAbstract);
        value.value.dataType.should.eql(DataType.Boolean);
        value.statusCode.should.eql(StatusCodes.Good);
        value.value.value.should.equal(false);

    });
    it("should read Attribute IsAbstract on Abstract UAObjectType ", function () {

        var objType = new UAObjectType({
            browseName: "MyObject2",
            addressSpace: addressSpace,
            isAbstract: true
        });

        var value;
        value = objType.readAttribute(context, AttributeIds.IsAbstract);
        value.value.dataType.should.eql(DataType.Boolean);
        value.statusCode.should.eql(StatusCodes.Good);
        value.value.value.should.equal(true);


        value = objType.readAttribute(context, AttributeIds.NodeId);

    });

    it("UAObjectType#instantiate should be possible to instantiate a ObjectType (nodeid not specified)",function() {


        var objType = addressSpace.addObjectType({
            browseName: "MyObject3",
            subtypeOf: "BaseObjectType",
            isAbstract: false
        }); 

        var obj = objType.instantiate({
            browseName: "Instance3"
        });

        obj.browseName.toString().should.eql("Instance3");

        obj.nodeId.identifierType.should.eql(NodeId.NodeIdType.NUMERIC);

    });

    it("UAObjectType#instantiate should be possible to instantiate a ObjectType and specify its nodeId)",function() {

        var objType = addressSpace.addObjectType({
            browseName: "MyObject4",
            subtypeOf: "BaseObjectType",
            isAbstract: false
        });

        var obj = objType.instantiate({
            browseName: "Instance4",
            nodeId: "ns=3;s=HelloWorld"
        });

        obj.browseName.toString().should.eql("Instance4");

        obj.nodeId.toString().should.eql("ns=3;s=HelloWorld");
        
    });

});

