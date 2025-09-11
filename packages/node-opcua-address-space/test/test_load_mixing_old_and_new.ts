import path from "path";
import should from "should";
import { nodesets } from "node-opcua-nodesets";
import { serverImplementsDataTypeDefinition } from "node-opcua-client-dynamic-extension-object";
import { AddressSpace, UADataType, PseudoSession,  } from "..";
import { generateAddressSpace } from "../distNodeJS";
import { describeWithLeakDetector as describe} from "node-opcua-leak-detector";

describe("Testing address space with old and new nodeset", () => {


    let addressSpace: AddressSpace;
    beforeEach(() => {
       addressSpace = AddressSpace.create();
    });
    afterEach(async () => {
        await addressSpace.shutdown();
        addressSpace.dispose();
    });

    it("should create a server with old and new nodeset - A", async () => {
        const new_opcua = nodesets.standard;
        const old = path.join(__dirname, "../test_helpers/test_fixtures/nodeset_with_102_datatype.xml");

        await generateAddressSpace(addressSpace, [new_opcua, old]);
        addressSpace.registerNamespace("urn:OWN");


        
        const session = new PseudoSession(addressSpace);
        const force104 = await serverImplementsDataTypeDefinition(session);
        should(force104).eql(false);

        
        const ns = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/");
        const ns2 = addressSpace.getNamespaceIndex("http://DEMO/");
        if (ns2 === -1) {
            throw new Error("Cannot find namespace DEMO");
        }
        const dataType = addressSpace.findNode(`ns=${ns2};i=3019`) as UADataType;
        if (!dataType) {
            throw new Error("Cannot find DataType");
        }
        const data: any = addressSpace.constructExtensionObject(dataType, {});

        console.log("data = ", data.toString());
        should.exists(data.charge);


    });
    it("should create a server with old and new nodeset - B", async () => {
        const new_opcua = nodesets.standard;
        const oldDI = path.join(__dirname, "../../node-opcua-nodesets/nodesets/1.02/Opc.Ua.Di.NodeSet2.xml");
        const oldADI = path.join(__dirname, "../../node-opcua-nodesets/nodesets/1.02/Opc.Ua.Adi.NodeSet2.xml");

        await generateAddressSpace(addressSpace, [new_opcua, oldDI, oldADI]);
        await addressSpace.registerNamespace("urn:OWN");

        const session = new PseudoSession(addressSpace);
        const force104 = await serverImplementsDataTypeDefinition(session);
        should(force104).eql(false);
        
        const nsDI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");
        const ns2 = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/ADI/");
        if (ns2 === -1) {
            throw new Error("Cannot find namespace ADI");
        }
        const ParameterResultDataType = addressSpace.findDataType("ParameterResultDataType", nsDI);
        if (!ParameterResultDataType) {
            throw new Error("Cannot find ParameterResultDataType");
        }
        const data: any = addressSpace.constructExtensionObject(ParameterResultDataType, {});

        // console.log("data = ", data.toString());
        should.exists(data.nodePath);
        should.exists(data.statusCode);
        should.exists(data.diagnostics);
    });
});
