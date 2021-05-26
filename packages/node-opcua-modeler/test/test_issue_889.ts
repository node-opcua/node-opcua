import { spy } from "sinon";
import { promisify } from "util";
import * as fs from "fs";
import "should";
import { ExtraDataTypeManager, populateDataTypeManager } from "node-opcua-client-dynamic-extension-object";
import { makeNodeId, NodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { AddressSpace, PseudoSession, UAVariable } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";

import {
    addExtensionObjectDataType,
    DataType,
    ExtensionObjectDefinition,
    StructureDefinitionOptions,
    Variant,
    VariantArrayType
} from "..";


describe("loading very large DataType Definitions ", function (this: any) {
    this.timeout(10000);
    const namespaceUri = "http://sterfive.org/UA/Demo/";

    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace(namespaceUri);
        const nodesetsXML = [nodesets.standard];
        await generateAddressSpace(addressSpace, nodesetsXML);

        const serverNamespaceArrayNodeId = "i=2255"; // VariableIds.Server_NamespaceArray
        const serverNamespaceArray = addressSpace.findNode(serverNamespaceArrayNodeId)! as UAVariable;
        serverNamespaceArray.setValueFromSource({
            arrayType: VariantArrayType.Array,
            dataType: DataType.String,
            value: addressSpace.getNamespaceArray().map((x) => x.namespaceUri)
        });
    });
    after(() => {
        addressSpace.dispose();
    });
    it("LGH should ", async () => {
        const namespace = addressSpace.getOwnNamespace();

        const structureDefinition: StructureDefinitionOptions = {
            baseDataType: "",
            fields: [
                {
                    dataType: DataType.String,
                    description: "the name",
                    isOptional: false,
                    name: "Name",
                    valueRank: -1
                },
                {
                    arrayDimensions: [1],
                    dataType: DataType.Float,
                    description: "the list of values",
                    name: "Values",
                    valueRank: 1
                }
            ]
        };
        for (let i = 0; i < 20; i++) {
            const options: ExtensionObjectDefinition = {
                browseName: "T" + i + "DataType",
                isAbstract: false,

                description: { text: "" },

                structureDefinition,

                binaryEncoding: NodeId.nullNodeId,
                xmlEncoding: NodeId.nullNodeId
            };
            const dataType = await addExtensionObjectDataType(namespace, options);
        }

        const xml = namespace.toNodeset2XML();
        // const tmpFile = "tmp_1.xml";
        // await writeFile(tmpFile, xml, "utf-8");
        /* to be completed */

        const session = new PseudoSession(addressSpace);
        const browseSpy = spy(session, "browse");
        const browseNextSpy = spy(session, "browseNext");
        session.requestedMaxReferencesPerNode = 2;

        const dataTypeManager = new ExtraDataTypeManager();
        await populateDataTypeManager(session, dataTypeManager);

        browseSpy.callCount.should.eql(26);
        browseNextSpy.callCount.should.eql(36);
    });
});
