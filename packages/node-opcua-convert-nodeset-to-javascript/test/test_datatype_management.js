/* global describe,require,it,before */
"use strict";

var should = require("should");
var path = require("path");
var existsSync = require("fs").existsSync;

var encode_decode_round_trip_test = require("node-opcua-generator/test_helpers/encode_decode_round_trip_test").encode_decode_round_trip_test


var AddressSpace = require("node-opcua-address-space").AddressSpace;
var generate_address_space = require("node-opcua-address-space-loader").generate_address_space;

var makeExpandedNodeId = require("node-opcua-nodeid/src/expanded_nodeid").makeExpandedNodeId;
var Variant = require("node-opcua-variant").Variant;
var DataType = require("node-opcua-variant").DataType;

var nodeset = require("node-opcua-address-space").nodeset;

var createExtensionObjectDefinition = require("../src/convert_nodeset_to_types").createExtensionObjectDefinition;


// var getFixture = require("node-opcua-test-fixtures").getFixture;
function getFixture(file) {
    file = path.join(__dirname,"../test_fixtures",file);
    existsSync(file).should.be.eql(true);
    return file;
}

xdescribe("ComplexType read from XML NodeSET file shall be binary encode-able", function () {

    var addressSpace;

    before(function (done) {
        addressSpace = new AddressSpace();

        var xml_file = getFixture("fixture_nodeset_enumtype.xml");

        generate_address_space(addressSpace, xml_file, function (err) {
            createExtensionObjectDefinition(addressSpace);
            done(err);
        });
    });
    after(function(){
        addressSpace.dispose();
    });

    it("a DataType should provide a DefaultBinary Encoding object", function () {

        var serverStatusType = addressSpace.findDataType("ServerStatusDataType");
        serverStatusType.getEncodingNodeId("Default Binary").nodeId.toString().should.eql("ns=0;i=864");

    });


    it("should create an enumeration from the ServerState object", function (done) {

        var test_value = nodeset.ServerState.NoConfiguration;
        //xx console.log(nodeset.ServerState);
        test_value.value.should.eql(2);
        done();

    });

    it("should create an structure from the ServerStatus object", function () {

        var serverStatus = new nodeset.ServerStatus({
            startTime: new Date(),
            buildInfo: {},
            secondsTillShutdown: 100,
            shutdownReason: {text: "for maintenance"}
        });

        should(serverStatus._schema.name).eql("ServerStatus");
        serverStatus.startTime.should.be.instanceOf(Date);
        serverStatus.secondsTillShutdown.should.eql(100);
    });


    it("should ServerStatus object have correct encodingDefaultBinary ", function () {

        var serverStatus = new nodeset.ServerStatus({});
        serverStatus.encodingDefaultBinary.should.eql(makeExpandedNodeId(864, 0));

    });

    it("should encode and decode a ServerStatus object", function () {

        var serverStatus = new nodeset.ServerStatus({
            startTime: new Date(),
            buildInfo: {},
            secondsTillShutdown: 100,
            shutdownReason: {text: "for maintenance"}
        });
        encode_decode_round_trip_test(serverStatus);

    });

    it("should encode and decode a variant containing an extension object being a ServerStatus", function () {

        var serverStatus = new nodeset.ServerStatus({});

        var v = new Variant({
            dataType: DataType.ExtensionObject,
            value: serverStatus
        });
        encode_decode_round_trip_test(v);
    });


});
