"use strict";
/* global describe,it,before*/

const should = require("should");

const StatusCodes = require("node-opcua-status-code").StatusCodes;
const DataType = require("node-opcua-variant").DataType;
const AttributeIds = require("node-opcua-data-model").AttributeIds;

const NodeId = require("node-opcua-nodeid").NodeId;

const address_space = require("..");
const UAObjectType = require("..").UAObjectType;
const SessionContext = require("..").SessionContext;
const context = SessionContext.defaultContext;

const create_minimalist_address_space_nodeset = require("../test_helpers/create_minimalist_address_space_nodeset");
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("testing UAObjectType", function () {

    let addressSpace;

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

        const objType = new UAObjectType({
            browseName: "MyObject",
            addressSpace: addressSpace,
            isAbstract: false
        });

        let value;
        value = objType.readAttribute(context, AttributeIds.IsAbstract);
        value.value.dataType.should.eql(DataType.Boolean);
        value.statusCode.should.eql(StatusCodes.Good);
        value.value.value.should.equal(false);

    });
    it("should read Attribute IsAbstract on Abstract UAObjectType ", function () {

        const objType = new UAObjectType({
            browseName: "MyObject2",
            addressSpace: addressSpace,
            isAbstract: true
        });

        let value;
        value = objType.readAttribute(context, AttributeIds.IsAbstract);
        value.value.dataType.should.eql(DataType.Boolean);
        value.statusCode.should.eql(StatusCodes.Good);
        value.value.value.should.equal(true);


        value = objType.readAttribute(context, AttributeIds.NodeId);

    });

    it("UAObjectType#instantiate should be possible to instantiate a ObjectType (nodeid not specified)",function() {


        const objType = addressSpace.addObjectType({
            browseName: "MyObject3",
            subtypeOf: "BaseObjectType",
            isAbstract: false
        }); 

        const obj = objType.instantiate({
            browseName: "Instance3"
        });

        obj.browseName.toString().should.eql("Instance3");

        obj.nodeId.identifierType.should.eql(NodeId.NodeIdType.NUMERIC);

    });

    it("UAObjectType#instantiate should be possible to instantiate a ObjectType and specify its nodeId)",function() {

        const objType = addressSpace.addObjectType({
            browseName: "MyObject4",
            subtypeOf: "BaseObjectType",
            isAbstract: false
        });

        const obj = objType.instantiate({
            browseName: "Instance4",
            nodeId: "ns=3;s=HelloWorld"
        });

        obj.browseName.toString().should.eql("Instance4");

        obj.nodeId.toString().should.eql("ns=3;s=HelloWorld");
        
    });

});

