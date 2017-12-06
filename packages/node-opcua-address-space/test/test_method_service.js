"use strict";
/* global: describe it before after beforeEach afterEach require*/
require("should");
var path = require("path");
var fs = require("fs");

var BinaryStream = require("node-opcua-binary-stream").BinaryStream;

var DataType = require("node-opcua-variant").DataType;
var makeNodeId = require("node-opcua-nodeid").makeNodeId;

var AddressSpace = require("..").AddressSpace;
var UAObject = require("..").UAObject;
var UAMethod = require("..").UAMethod;

var generate_address_space = require("..").generate_address_space;

var call_service = require("node-opcua-service-call");
var hexDump = require("node-opcua-debug").hexDump;

var build_retrieveInputArgumentsDefinition = require("../src/argument_list").build_retrieveInputArgumentsDefinition;

var describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("CallRequest on custom method", function () {

    var addressSpace;
    before(function (done) {
        addressSpace = new AddressSpace();
        var xml_file = path.join(__dirname, "../test_helpers/test_fixtures/fixuture_nodeset_objects_with_some_methods.xml");
        fs.existsSync(xml_file).should.be.eql(true);

        generate_address_space(addressSpace, xml_file, function (err) {
            done(err);
        });
    });
    after(function () {
        if (addressSpace) {
            addressSpace.dispose();
        }
    });
    it("Q3 should encode and decode a method call request", function (done) {

        var objectId = makeNodeId(999990, 0);
        var methodId = makeNodeId(999992, 0);


        var obj = addressSpace.findNode(objectId);
        obj.should.be.instanceOf(UAObject);

        var method = obj.getMethodById(methodId);
        method.should.be.instanceOf(UAMethod);
        method.browseName.toString().should.eql("DoStuff");

        var inputArguments = method.getInputArguments();
        inputArguments.should.be.instanceOf(Array);

        var callRequest = new call_service.CallRequest({

            methodsToCall: [{
                objectId: objectId,
                methodId: methodId,
                inputArguments: [{dataType: DataType.UInt32, value: [0xAA, 0xAB, 0xAC]}]
            }]
        });

        var retrieveInputArgumentsDefinition = build_retrieveInputArgumentsDefinition(addressSpace);

        //xx callRequest.factory = factory;

        var options = {retrieveInputArgumentsDefinition: retrieveInputArgumentsDefinition};
        var size = callRequest.binaryStoreSize(options);

        var stream = new BinaryStream(size, options);
        callRequest.encode(stream, options);

        console.log(hexDump(stream._buffer));

        // now decode
        var callRequest_reloaded = new call_service.CallRequest();
        stream.addressSpace = {};
        stream.rewind();
        callRequest_reloaded.decode(stream, options);

        done();

    });
});
