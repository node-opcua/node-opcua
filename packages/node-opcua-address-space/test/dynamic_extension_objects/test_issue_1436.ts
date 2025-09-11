import should from  "should";
import path from "path";
import { AttributeIds, StatusCodes } from "node-opcua-basic-types";
import { OpaqueStructure } from "node-opcua-extension-object";
import { nodesets } from "node-opcua-nodesets";
import { AddressSpace, Namespace, PseudoSession } from "../..";
import { generateAddressSpace } from "../../distNodeJS";
import { BinaryStream, BinaryStreamSizeCalculator } from "node-opcua-binary-stream";
import { DataValue, decodeDataValue, encodeDataValue } from "node-opcua-data-value";
import { promoteOpaqueStructure } from "node-opcua-client-dynamic-extension-object";
import { describeWithLeakDetector as describe} from "node-opcua-leak-detector";

describe("issue_1436", function (this: any) {

    const fixtureFolder = path.join(__dirname,"../../test_helpers/test_fixtures/fixtures-for-1436");
    const nodesetFilename = [
        nodesets.standard,
        path.join(fixtureFolder, "test_issue_1436_base.xml"),
        path.join(fixtureFolder, "test_issue_1436_dependent.xml"),
        path.join(fixtureFolder, "test_issue_1436_server.xml")
    ];

    let addressSpace: AddressSpace;
    let namespace: Namespace;
    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, nodesetFilename);
        namespace = addressSpace.registerNamespace("Private");
        namespace.index.should.eql(4);
    });
    after(async () => {
        addressSpace.dispose();
    });


    it("should correctly handle 1.04 namespaces when handling structs which depend on multiple namespaces - PseudoSession", async () => {

        const session = new PseudoSession(addressSpace);

        const nsServer = addressSpace.getNamespaceIndex("http://baseDataTypeFactoryBugExample.org/server/");

        const result = await session.read({
            nodeId: `ns=${nsServer};i=6001`, // Read variable of data type structure which contains a structure from a dependent namespace.
            attributeId: AttributeIds.Value,
        });

        result.statusCode.should.eql(StatusCodes.Good);
        should.exist(result.value.value);
        result.value.value.should.not.be.instanceOf(OpaqueStructure);
        console.log(result.value.value.toString());
    });

    it("should correctly handle 1.04 servers when handling structs which depend on multiple namespaces - with Encoding/Decoding", async () => {

       const session = new PseudoSession(addressSpace);
       const nsServer = addressSpace.getNamespaceIndex("http://baseDataTypeFactoryBugExample.org/server/");
       const result = await session.read({
            nodeId: `ns=${nsServer};i=6001`, // Read variable of data type structure which contains a structure from a dependent namespace.
            attributeId: AttributeIds.Value,
        });

        var bl = new BinaryStreamSizeCalculator();
        encodeDataValue(result, bl);

        var stream = new BinaryStream(bl.length);
        encodeDataValue(result, stream);

        stream.rewind();
        var decoded = decodeDataValue(stream);
        decoded.should.be.instanceOf(DataValue);
        //
        decoded.value.value.should.be.instanceOf(OpaqueStructure);

        await promoteOpaqueStructure(session, [decoded]);

        decoded.should.be.instanceOf(DataValue);
        decoded.value.value.should.not.be.instanceOf(OpaqueStructure);

        should.exist(decoded.value.value.exampleNumber);
        should(decoded.value.value.exampleNumber).eql(123);
        should.exist(decoded.value.value.dependentStruct);
        should.exist(decoded.value.value.dependentStruct.exampleBoolean);
        should(decoded.value.value.dependentStruct.exampleBoolean).eql(true);


    }); 
});
