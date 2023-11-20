import path from "path";
import should from "should";
import { nodesets } from "node-opcua-nodesets";
import { coerceNodeId } from "node-opcua-nodeid";
import { AddressSpace, PseudoSession } from "..";
import { generateAddressSpace } from "../nodeJS";
import {
    ExtraDataTypeManager,
    getExtensionObjectConstructor,
    getExtraDataTypeManager
} from "node-opcua-client-dynamic-extension-object";

describe("Testing loadNodeSet - Union DataType", async function (this: any) {
    this.timeout(200000); // could be slow on appveyor !

    let addressSpace: AddressSpace;
    beforeEach(async () => {
        addressSpace = AddressSpace.create();
    });
    afterEach(() => {
        addressSpace.dispose();
    });

    it("should handle union ", async () => {
        const xml_file = path.join(__dirname, "../test_helpers/test_fixtures/dataType_with_union.xml");
        await generateAddressSpace(addressSpace, [nodesets.standard, xml_file]);
        const a = addressSpace.constructExtensionObject(coerceNodeId("ns=1;i=1000"), {});
        a.schema.name.should.eql("CustomUnion");
        console.log(a);


        const manager = new ExtraDataTypeManager();
        const session = new PseudoSession(addressSpace);
        const manager2 = await getExtraDataTypeManager(session);
        const c = await getExtensionObjectConstructor(session, coerceNodeId("ns=1;i=1000"));
        const a1 = new c({});
        console.log(a1);

        
    });
});
