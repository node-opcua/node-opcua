"use strict";
/* global: describe it before after beforeEach afterEach require*/
require("should");
const path = require("path");
const fs = require("fs");

const BinaryStream = require("node-opcua-binary-stream").BinaryStream;

const DataType = require("node-opcua-variant").DataType;
const makeNodeId = require("node-opcua-nodeid").makeNodeId;

const AddressSpace = require("..").AddressSpace;
const UAObject = require("..").UAObject;
const UAMethod = require("..").UAMethod;

const generate_address_space = require("..").generate_address_space;

const call_service = require("node-opcua-service-call");
const hexDump = require("node-opcua-debug").hexDump;
const doDebug = false;

const build_retrieveInputArgumentsDefinition = require("../src/argument_list").build_retrieveInputArgumentsDefinition;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("CallRequest on custom method", function () {

    let addressSpace;
    before(function (done) {
        addressSpace = new AddressSpace();
        const xml_file = path.join(__dirname, "../test_helpers/test_fixtures/fixuture_nodeset_objects_with_some_methods.xml");
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

        const objectId = makeNodeId(999990, 0);
        const methodId = makeNodeId(999992, 0);


        const obj = addressSpace.findNode(objectId);
        obj.should.be.instanceOf(UAObject);

        const method = obj.getMethodById(methodId);
        method.should.be.instanceOf(UAMethod);
        method.browseName.toString().should.eql("DoStuff");

        const inputArguments = method.getInputArguments();
        inputArguments.should.be.instanceOf(Array);

        const callRequest = new call_service.CallRequest({

            methodsToCall: [{
                objectId: objectId,
                methodId: methodId,
                inputArguments: [{dataType: DataType.UInt32, value: [0xAA, 0xAB, 0xAC]}]
            }]
        });

        const retrieveInputArgumentsDefinition = build_retrieveInputArgumentsDefinition(addressSpace);

        //xx callRequest.factory = factory;

        const options = {retrieveInputArgumentsDefinition: retrieveInputArgumentsDefinition};
        const size = callRequest.binaryStoreSize(options);

        const stream = new BinaryStream(size, options);
        callRequest.encode(stream, options);

        if (doDebug) {
            console.log(hexDump(stream._buffer));
        }

        // now decode
        const callRequest_reloaded = new call_service.CallRequest();
        stream.addressSpace = {};
        stream.rewind();
        callRequest_reloaded.decode(stream, options);

        done();

    });
});
