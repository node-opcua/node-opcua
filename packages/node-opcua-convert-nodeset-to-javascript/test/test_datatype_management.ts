import "node:fs";
import { AddressSpace } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { makeExpandedNodeId } from "node-opcua-nodeid";
import { encode_decode_round_trip_test } from "node-opcua-packet-analyzer/dist/test_helpers";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";

import { getFixture } from "../test_fixtures/helper.js";

describe("ComplexType read from XML NodeSET file shall be binary encode-able", function () {
    this.timeout(Math.max(40000, this.timeout()));
    let addressSpace: AddressSpace;

    before(async () => {
        addressSpace = AddressSpace.create();
        const xml_file = getFixture("fixture_nodeset_enumtype.xml");
        await generateAddressSpace(addressSpace, xml_file);
    });
    after(() => {
        addressSpace.dispose();
    });

    it("a DataType should provide a DefaultBinary Encoding object", () => {
        const serverStatusType = addressSpace.findDataType("ServerStatusDataType");
        should(serverStatusType?.getEncodingNode("Default Binary")?.nodeId.toString()).eql("ns=0;i=864");
    });

    // Kept as a record of intent; the body is removed rather than the test.
    //
    // It read nodeset.ServerState.NoConfiguration, but node-opcua-nodesets exports
    // nodesets - a map of nodeset file paths - and never had a ServerState member.
    // Under require() that destructured to undefined, and the xit meant nobody
    // found out. Reviving it means rewriting against findDataType("ServerState").
    xit("should create an enumeration from the ServerState object", () => {
        /* needs rewriting - see above */
    });

    it("should create an structure from the ServerStatus object", () => {
        const serverStatusDataTypeNodeId = addressSpace.findDataType("ServerStatusDataType");
        should.exist(serverStatusDataTypeNodeId);
        const serverStatus = addressSpace.constructExtensionObject(serverStatusDataTypeNodeId!, {
            startTime: new Date(),
            buildInfo: {},
            secondsTillShutdown: 100,
            shutdownReason: { text: "for maintenance" }
        });
        should(serverStatus.schema.name).eql("ServerStatusDataType");
        // the factory returns the base type; this test asked for a ServerStatusDataType
        const status = serverStatus as unknown as { startTime: Date; secondsTillShutdown: number };
        should(status.startTime).be.instanceOf(Date);
        should(status.secondsTillShutdown).eql(100);
    });

    it("should ServerStatus object have correct encodingDefaultBinary ", () => {
        const serverStatusDataTypeNodeId = addressSpace.findDataType("ServerStatusDataType");
        should.exist(serverStatusDataTypeNodeId);
        const serverStatus = addressSpace.constructExtensionObject(serverStatusDataTypeNodeId!, {});
        should(serverStatus.schema.encodingDefaultBinary).eql(makeExpandedNodeId(864, 0));
    });

    it("should encode and decode a ServerStatus object", () => {
        const serverStatusDataTypeNodeId = addressSpace.findDataType("ServerStatusDataType");
        should.exist(serverStatusDataTypeNodeId);
        const serverStatus = addressSpace.constructExtensionObject(serverStatusDataTypeNodeId!, {
            startTime: new Date(),
            buildInfo: {},
            secondsTillShutdown: 100,
            shutdownReason: { text: "for maintenance" }
        });
        encode_decode_round_trip_test(serverStatus);
    });

    it("should encode and decode a variant containing an extension object being a ServerStatus", () => {
        const serverStatusDataTypeNodeId = addressSpace.findDataType("ServerStatusDataType");
        should.exist(serverStatusDataTypeNodeId);
        const serverStatus = addressSpace.constructExtensionObject(serverStatusDataTypeNodeId!, {});

        const v = new Variant({
            dataType: DataType.ExtensionObject,
            value: serverStatus
        });
        encode_decode_round_trip_test(v);
    });
});
