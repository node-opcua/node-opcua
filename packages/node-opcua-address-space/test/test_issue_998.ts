import "should";
import { DataTypeIds } from "node-opcua-constants";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { coerceNodeId, resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { getBuiltInDataType } from "node-opcua-pseudo-session";
import { DataType } from "node-opcua-variant";
import { AddressSpace, type Namespace, PseudoSession } from "..";
import { generateAddressSpace } from "../nodeJS";

describe("testing github issue #998", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;

    before(async () => {
        addressSpace = AddressSpace.create();
        namespace = addressSpace.registerNamespace("private");
        await generateAddressSpace(addressSpace, [nodesets.standard]);

        const dataType = namespace.createDataType({
            browseName: "MyDatType",
            isAbstract: false,
            nodeId: "s=MyDataData",
            subtypeOf: resolveNodeId("Double")
        });
        const _variable = namespace.addVariable({
            browseName: "MyVar",
            dataType,
            nodeId: "s=MyVar"
        });
        const _variableEnum = namespace.addVariable({
            browseName: "MyVarWithEnum",
            dataType: coerceNodeId(DataTypeIds.OpenFileMode),
            nodeId: "s=MyVarWithEnum"
        });
    });
    after(async () => {
        addressSpace?.dispose();
    });

    it("getBuiltInDataType should succeed when dataType is not numeric", async () => {
        const session = new PseudoSession(addressSpace);
        const t: DataType = await getBuiltInDataType(session, coerceNodeId("ns=1;s=MyVar"));
        console.log(DataType[t]);
        t.should.eql(DataType.Double);
    });

    it("getBuiltinDataType should return Int32 when dataType is a Enumeration", async () => {
        const session = new PseudoSession(addressSpace);
        const t: DataType = await getBuiltInDataType(session, coerceNodeId("ns=1;s=MyVarWithEnum"));
        console.log(DataType[t]);
        t.should.eql(DataType.Int32);
    });
});
