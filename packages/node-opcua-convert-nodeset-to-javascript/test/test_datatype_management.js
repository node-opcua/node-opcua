/* global describe,require,it,before */
"use strict";

const should = require("should");
const path = require("path");
const fs = require("fs");
const existsSync = fs.existsSync;

const encode_decode_round_trip_test = require("node-opcua-packet-analyzer/dist/test_helpers").encode_decode_round_trip_test;


const AddressSpace = require("node-opcua-address-space").AddressSpace;
const generate_address_space = require("node-opcua-address-space").generate_address_space;

const makeExpandedNodeId = require("node-opcua-nodeid").makeExpandedNodeId;
const Variant = require("node-opcua-variant").Variant;
const DataType = require("node-opcua-variant").DataType;

const nodeset = require("..").nodeset;

const createExtensionObjectDefinition = require("..").createExtensionObjectDefinition;


function getFixture(file) {
    file = path.join(__dirname,"../test_fixtures",file);
    existsSync(file).should.be.eql(true);
    return file;
}

xdescribe("ComplexType read from XML NodeSET file shall be binary encode-able", function () {

    let addressSpace;

    before(function (done) {
        addressSpace = new AddressSpace();

        const xml_file = getFixture("fixture_nodeset_enumtype.xml");

        generate_address_space(addressSpace, xml_file, function (err) {
            createExtensionObjectDefinition(addressSpace);
            done(err);
        });
    });
    after(function(){
        addressSpace.dispose();
    });

    it("a DataType should provide a DefaultBinary Encoding object", function () {

        const serverStatusType = addressSpace.findDataType("ServerStatusDataType");
        serverStatusType.getEncodingNodeId("Default Binary").nodeId.toString().should.eql("ns=0;i=864");

    });


    it("should create an enumeration from the ServerState object", function (done) {

        const test_value = nodeset.ServerState.NoConfiguration;
        //xx console.log(nodeset.ServerState);
        test_value.value.should.eql(2);
        done();

    });

    it("should create an structure from the ServerStatus object", function () {

        const serverStatus = new nodeset.ServerStatus({
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

        const serverStatus = new nodeset.ServerStatus({});
        serverStatus.encodingDefaultBinary.should.eql(makeExpandedNodeId(864, 0));

    });

    it("should encode and decode a ServerStatus object", function () {

        const serverStatus = new nodeset.ServerStatus({
            startTime: new Date(),
            buildInfo: {},
            secondsTillShutdown: 100,
            shutdownReason: {text: "for maintenance"}
        });
        encode_decode_round_trip_test(serverStatus);

    });

    it("should encode and decode a variant containing an extension object being a ServerStatus", function () {

        const serverStatus = new nodeset.ServerStatus({});

        const v = new Variant({
            dataType: DataType.ExtensionObject,
            value: serverStatus
        });
        encode_decode_round_trip_test(v);
    });


});
