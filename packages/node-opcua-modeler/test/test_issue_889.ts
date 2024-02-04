import path from "path";
import os from "os";
import { spy } from "sinon";
import "should";

import { assert } from "node-opcua-assert";
import { ExtraDataTypeManager, populateDataTypeManager } from "node-opcua-client-dynamic-extension-object";
import { NodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { AddressSpace, adjustNamespaceArray, PseudoSession, UADataType } from "node-opcua-address-space";
import { BrowseDescription } from "node-opcua-types";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";

import {
    addExtensionObjectDataType,
    BrowseDirection,
    DataType,
    ExtensionObjectDefinition,
    NodeClassMask,
    StructureDefinitionOptions
} from "..";

describe("loading very large DataType Definitions ", function (this: any) {
    this.timeout(Math.max(10000, this.timeout()));
    const namespaceUri = "http://sterfive.org/UA/Demo/";

    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace(namespaceUri);
        const nodesetsXML = [nodesets.standard];
        await generateAddressSpace(addressSpace, nodesetsXML);
        adjustNamespaceArray(addressSpace);
    });
    after(() => {
        addressSpace.dispose();
    });
    it("LGH #889 should load large DataType tree", async () => {
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

        const nbPerLevel = 260;
        let counter = 0;
        async function addMany(subtypeOf: UADataType | undefined) {
            const d: UADataType[] = [];
            for (let i = 0; i < nbPerLevel; i++) {
                counter += 1;
                const options: ExtensionObjectDefinition = {
                    browseName: "T" + counter + "DataType",
                    isAbstract: false,

                    description: { text: "" },

                    structureDefinition,

                    binaryEncoding: NodeId.nullNodeId,
                    xmlEncoding: NodeId.nullNodeId,
                    subtypeOf
                };
                const dataType = await addExtensionObjectDataType(namespace, options);
                d.push(dataType);
            }
            return d;
        }

        const structure = addressSpace.findDataType("Structure")!;
        const a1 = structure.allReferences();
        const d = await addMany(structure);
        const a2 = structure.allReferences();
        assert(a1.length < a2.length, "expecting parent structure to contain the created structures");

        for (let i = 0; i < 5; i++) {
            await addMany(d[i]);
        }

        const xml = namespace.toNodeset2XML();
        if (true) {
            const fs = require("fs");
            const tmpFile = path.join(os.tmpdir(), "tmp_1.xml");
            await fs.promises.writeFile(tmpFile, xml, "utf-8");
            /* to be completed */
        }

        const maxBrowseContinuationPoints = 2;
        const maxNodesPerBrowse = 100;

        const session = new PseudoSession(addressSpace);
        session.requestedMaxReferencesPerNode = 17;
        session.maxBrowseContinuationPoints = maxBrowseContinuationPoints;

        addressSpace.rootFolder.objects.server.serverCapabilities!.maxBrowseContinuationPoints!.setValueFromSource({
            dataType: DataType.UInt16,
            value: maxBrowseContinuationPoints
        });
        addressSpace.rootFolder.objects.server.serverCapabilities!.operationLimits!.maxNodesPerBrowse!.setValueFromSource({
            dataType: DataType.UInt32,
            value: maxNodesPerBrowse
        });

        // try to overflow the number of continuation points
        const browseResults = await session.browse(
            [d[0], d[1], d[2], d[3], d[4]].map(
                (d) =>
                    new BrowseDescription({
                        nodeId: d.nodeId,
                        browseDirection: BrowseDirection.Forward,
                        includeSubtypes: true,
                        nodeClassMask: NodeClassMask.DataType,
                        resultMask: 63
                    })
            )
        );
        console.log(
            browseResults.map(
                (a) => a.statusCode.toString() + " l=" + a.references?.length + " c=" + a.continuationPoint?.toString("hex")
            )
        );

        const browseSpy = spy(session, "browse");
        const browseNextSpy = spy(session, "browseNext");

        const dataTypeManager = new ExtraDataTypeManager();
        await populateDataTypeManager(session, dataTypeManager);

        // since 1.04 (september 2021) 1.04 datatype is in force
        browseSpy.callCount.should.be.greaterThanOrEqual(1);
        browseSpy.callCount.should.be.lessThanOrEqual(2425);
        browseNextSpy.callCount.should.eql(87);

        interface DataTypeFactoryPriv {
            _structureInfoByName: Map<any, any>;
            _structureInfoByDataTypeMap: Map<any, any>;
            _structureInfoByEncodingMap: Map<any, any>;
            _enumerations: Map<any, any>;
        }
        const a = dataTypeManager.getDataTypeFactory(1) as unknown as DataTypeFactoryPriv;
        a._structureInfoByDataTypeMap.size.should.eql(nbPerLevel * 6);
    });
});
