// tslint:disable:no-console
/* global: describe it before after beforeEach afterEach require*/
import * as fs from "fs";
import * as path from "path";
import * as should from "should";

import { BinaryStream } from "node-opcua-binary-stream";
import { NodeClass } from "node-opcua-data-model";
import { hexDump } from "node-opcua-debug";
import { makeNodeId } from "node-opcua-nodeid";
import { CallRequest } from "node-opcua-service-call";
import { DataType } from "node-opcua-variant";

import { AddressSpace, UAMethod, UAObject } from "..";
import { generateAddressSpace } from "../nodeJS";

const doDebug = false;

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("CallRequest on custom method", () => {
    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();
        const xml_file = path.join(__dirname, "../test_helpers/test_fixtures/fixuture_nodeset_objects_with_some_methods.xml");
        fs.existsSync(xml_file).should.be.eql(true);
        await generateAddressSpace(addressSpace, xml_file);
    });
    after(() => {
        if (addressSpace) {
            addressSpace.dispose();
        }
    });

    it("Q3 should encode and decode a method call request", async () => {
        const objectId = makeNodeId(999990, 0);
        const methodId = makeNodeId(999992, 0);

        const obj = addressSpace.findNode(objectId)! as UAObject;
        obj.nodeClass.should.eql(NodeClass.Object);

        const method = obj.getMethodById(methodId)!;
        method.nodeClass.should.eql(NodeClass.Method);
        method.browseName.toString().should.eql("DoStuff");

        const inputArguments = method.getInputArguments();
        inputArguments.should.be.instanceOf(Array);

        const callRequest = new CallRequest({
            methodsToCall: [
                {
                    inputArguments: [
                        {
                            dataType: DataType.UInt32,
                            value: [0xaa, 0xab, 0xac]
                        }
                    ],
                    methodId,
                    objectId
                }
            ]
        });

        const size = callRequest.binaryStoreSize();

        const stream = new BinaryStream(size);

        callRequest.encode(stream);

        if (doDebug) {
            console.log(hexDump(stream.buffer));
        }

        // now decode
        const callRequest_reloaded = new CallRequest();
        stream.rewind();
        callRequest_reloaded.decode(stream);
    });
});
