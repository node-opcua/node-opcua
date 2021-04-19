"use strict";

const should = require("should");
const path = require("path");
const fs = require("fs");
const existsSync = fs.existsSync;

const { encode_decode_round_trip_test }= require("node-opcua-packet-analyzer/dist/test_helpers");
const { AddressSpace } = require("node-opcua-address-space");
const { generateAddressSpace } = require("node-opcua-address-space/nodeJS");

const { makeExpandedNodeId } = require("node-opcua-nodeid");
const { Variant, DataType } = require("node-opcua-variant");

const { nodeset } = require("node-opcua-nodesets");
const {getFixture} = require("../test_fixtures/helper");

describe("ComplexType read from XML NodeSET file shall be binary encode-able", function () {

    this.timeout(10000);
    let addressSpace;

    before(async () => {
        addressSpace= AddressSpace.create();
        const xml_file = getFixture("fixture_nodeset_enumtype.xml");
        await generateAddressSpace(addressSpace, xml_file);
    });
    after(() => {
        addressSpace.dispose();
    });

    it("a DataType should provide a DefaultBinary Encoding object", function () {
        const serverStatusType = addressSpace.findDataType("ServerStatusDataType");
        serverStatusType.getEncodingNode("Default Binary").nodeId.toString().should.eql("ns=0;i=864");
    });


    xit("should create an enumeration from the ServerState object", function (done) {
        const test_value = nodeset.ServerState.NoConfiguration;
        //xx console.log(nodeset.ServerState);
        test_value.value.should.eql(2);
        done();

    });

    it("should create an structure from the ServerStatus object", function () {

        const serverStatusDataTypeNodeId = addressSpace.findDataType("ServerStatusDataType");
        should.exist(serverStatusDataTypeNodeId);
        const serverStatus = addressSpace.constructExtensionObject(serverStatusDataTypeNodeId,{
            startTime: new Date(),
            buildInfo: {},
            secondsTillShutdown: 100,
            shutdownReason: {text: "for maintenance"}
        });
        should(serverStatus.schema.name).eql("ServerStatusDataType");
        serverStatus.startTime.should.be.instanceOf(Date);
        serverStatus.secondsTillShutdown.should.eql(100);
    });


    it("should ServerStatus object have correct encodingDefaultBinary ", function () {

        const serverStatusDataTypeNodeId = addressSpace.findDataType("ServerStatusDataType");
        should.exist(serverStatusDataTypeNodeId);
        const serverStatus = addressSpace.constructExtensionObject(serverStatusDataTypeNodeId,{});
        serverStatus.schema.encodingDefaultBinary.should.eql(makeExpandedNodeId(864, 0));
    });

    it("should encode and decode a ServerStatus object", function () {

        const serverStatusDataTypeNodeId = addressSpace.findDataType("ServerStatusDataType");
        should.exist(serverStatusDataTypeNodeId);
        const serverStatus = addressSpace.constructExtensionObject(serverStatusDataTypeNodeId,{
            startTime: new Date(),
            buildInfo: {},
            secondsTillShutdown: 100,
            shutdownReason: {text: "for maintenance"}
        });
        encode_decode_round_trip_test(serverStatus);

    });

    it("should encode and decode a variant containing an extension object being a ServerStatus", function () {

        const serverStatusDataTypeNodeId = addressSpace.findDataType("ServerStatusDataType");
        should.exist(serverStatusDataTypeNodeId);
        const serverStatus = addressSpace.constructExtensionObject(serverStatusDataTypeNodeId,{});

        const v = new Variant({
            dataType: DataType.ExtensionObject,
            value: serverStatus
        });
        encode_decode_round_trip_test(v);
    });


});
 