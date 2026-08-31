import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AddressSpace, adjustNamespaceArray, PseudoSession, type UADataType } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { assert } from "node-opcua-assert";
import { DataTypeExtractStrategy, ExtraDataTypeManager, populateDataTypeManager } from "node-opcua-client-dynamic-extension-object";
import type { EnumerationDefinitionSchema, StructureInfo } from "node-opcua-factory";
import { nodesets } from "node-opcua-nodesets";
import { BrowseDescription } from "node-opcua-types";
import should from "should";
import { spy } from "sinon";
import {
    addExtensionObjectDataType,
    BrowseDirection,
    DataType,
    type ExtensionObjectDefinition,
    NodeClassMask,
    StatusCodes,
    type StructureDefinitionOptions
} from "../dist/index.js";

interface DataTypeFactoryPriv {
    _structureInfoByName: Map<string, StructureInfo>;
    _structureInfoByDataTypeMap: Map<string, StructureInfo>;
    _structureInfoByEncodingMap: Map<string, StructureInfo>;
    _enumerations: Map<string, EnumerationDefinitionSchema>;
}

describe("loading very large DataType Definitions ", function (this: Mocha.Suite) {
    this.timeout(Math.max(10000, this.timeout()));
    const namespaceUri = "http://sterfive.org/UA/Demo/";

    let addressSpace: AddressSpace;
    let allDataTypes: UADataType[];
    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace(namespaceUri);
        const nodesetsXML = [nodesets.standard];
        await generateAddressSpace(addressSpace, nodesetsXML);
        adjustNamespaceArray(addressSpace);

        allDataTypes = await makeAddressSpace(addressSpace);
    });
    after(() => {
        addressSpace.dispose();
    });
    async function makeAddressSpace(addressSpace: AddressSpace): Promise<UADataType[]> {
        const namespace = addressSpace.getOwnNamespace();

        const allDataTypes: UADataType[] = [];
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
                    browseName: `T${counter}DataType`,
                    isAbstract: false,
                    description: { text: "" },
                    structureDefinition,
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

        allDataTypes.push(...d);
        const a2 = structure.allReferences();
        assert(a1.length < a2.length, "expecting parent structure to contain the created structures");

        for (let i = 0; i < 5; i++) {
            const subDatatypes = await addMany(d[i]);
            allDataTypes.push(...subDatatypes);
        }

        const xml = namespace.toNodeset2XML();
        const tmpFile = path.join(os.tmpdir(), "tmp_1.xml");
        await fs.promises.writeFile(tmpFile, xml, "utf-8");
        /* to be completed */
        return allDataTypes;
    }

    function createLimitedPseudoSession() {
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
        return session;
    }

    async function check(uaDataType: UADataType[], extractor: (uaDataType: UADataType) => Promise<StructureInfo | null>) {
        const results: StructureInfo[] = [];
        const notFound: UADataType[] = [];
        for (let i = 0; i < uaDataType.length; i++) {
            const structureInfo = await extractor(uaDataType[i]);

            if (!structureInfo) {
                notFound.push(uaDataType[i]);
            } else {
                results.push(structureInfo);
            }
        }
        return { results, notFound };
    }

    it("LGH #889  session has limited continuation points", async () => {
        const session = createLimitedPseudoSession();
        // try to overflow the number of continuation points
        const browseResults = await session.browse(
            [allDataTypes[0], allDataTypes[1], allDataTypes[2], allDataTypes[3], allDataTypes[4]].map(
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
                (a) => `${a.statusCode.toString()} l=${a.references?.length} c=${a.continuationPoint?.toString("hex")}`
            )
        );
        browseResults[0].statusCode.should.eql(StatusCodes.Good);
        should(browseResults[0].references?.length).eql(17);
        should(browseResults[0].continuationPoint?.toString("hex")).not.eql("");

        browseResults[1].statusCode.should.eql(StatusCodes.Good);
        should(browseResults[1].references?.length).eql(17);
        should(browseResults[1].continuationPoint?.toString("hex")).not.eql("");

        browseResults[2].statusCode.should.eql(StatusCodes.BadNoContinuationPoints);
        should(browseResults[2].references?.length).eql(0);
        // BadNoContinuationPoints means there is no continuation point at all; the
        // assertion here read continuationPoint?.toString(), so it never ran.
        should.not.exist(browseResults[2].continuationPoint);

        browseResults[3].statusCode.should.eql(StatusCodes.BadNoContinuationPoints);
        should(browseResults[3].references?.length).eql(0);
        should.not.exist(browseResults[3].continuationPoint);

        browseResults[4].statusCode.should.eql(StatusCodes.BadNoContinuationPoints);
        should(browseResults[4].references?.length).eql(0);
        should.not.exist(browseResults[4].continuationPoint);

        // now clear the continuation points
        const continuationPoints = browseResults
            .map((a) => a.continuationPoint)
            .filter((c) => c !== null && c?.toString("hex") !== "");
        console.log(
            "continuationPoints",
            continuationPoints.map((a) => a?.toString("hex"))
        );

        const browseResults2 = await session.browseNext(continuationPoints, /*releaseContinuationPoints*/ true);

        browseResults2.length.should.eql(continuationPoints.length);
    });
    it("LGH #889 should load large DataType tree - Auto", async () => {
        const session = createLimitedPseudoSession();

        const browseSpy = spy(session, "browse");
        const browseNextSpy = spy(session, "browseNext");

        const dataTypeManager = new ExtraDataTypeManager();
        await populateDataTypeManager(session, dataTypeManager, DataTypeExtractStrategy.Auto);

        // since 1.04 (september 2021) 1.04 datatype is in force
        browseSpy.callCount.should.be.greaterThanOrEqual(1);
        browseSpy.callCount.should.be.lessThanOrEqual(4878);
        browseNextSpy.callCount.should.eql(97);

        // verify that all datastructure have been extracted
        const extractor = async (uaDataType: UADataType) => dataTypeManager.getStructureInfoForDataType(uaDataType.nodeId);
        const { results, notFound } = await check(allDataTypes, extractor);
        notFound.length.should.eql(0, "all data types should be found");
        results.length.should.eql(allDataTypes.length, "all data types should be found");

        const a = dataTypeManager.getDataTypeFactory(1) as unknown as DataTypeFactoryPriv;
        a._structureInfoByDataTypeMap.size.should.eql(allDataTypes.length);
    });

    it("LGH #889 should load large DataType tree - Force104", async () => {
        const session = createLimitedPseudoSession();
        const browseSpy = spy(session, "browse");
        const browseNextSpy = spy(session, "browseNext");

        const dataTypeManager = new ExtraDataTypeManager();
        dataTypeManager.setSession(session);

        await populateDataTypeManager(session, dataTypeManager, DataTypeExtractStrategy.Force104);

        // since 1.04 (september 2021) 1.04 datatype is in force
        browseSpy.callCount.should.be.greaterThanOrEqual(1);
        browseSpy.callCount.should.be.lessThanOrEqual(4874);
        browseNextSpy.callCount.should.eql(97);

        const a = dataTypeManager.getDataTypeFactory(1) as unknown as DataTypeFactoryPriv;
        a._structureInfoByDataTypeMap.size.should.eql(allDataTypes.length);

        // verify that all datastructure have been extracted
        const extractor = async (uaDataType: UADataType) => dataTypeManager.getStructureInfoForDataType(uaDataType.nodeId);
        const { results, notFound } = await check(allDataTypes, extractor);
        notFound.length.should.eql(0, "all data types should be found");
        results.length.should.eql(allDataTypes.length, "all data types should be found");
    });

    it("LGH #889 should load large DataType tree - Lazy", async () => {
        const session = createLimitedPseudoSession();
        const browseSpy = spy(session, "browse");
        const browseNextSpy = spy(session, "browseNext");

        const dataTypeManager = new ExtraDataTypeManager();
        dataTypeManager.setSession(session);

        await populateDataTypeManager(session, dataTypeManager, DataTypeExtractStrategy.Lazy);

        // since 1.04 (september 2021) 1.04 datatype is in force
        browseSpy.callCount.should.be.greaterThanOrEqual(1);
        browseSpy.callCount.should.be.lessThanOrEqual(4886);
        browseNextSpy.callCount.should.eql(0);

        const a = dataTypeManager.getDataTypeFactory(1) as unknown as DataTypeFactoryPriv;
        should.exist(a, "expecting dataTypeFactory for namespace 1 to have been created");

        // verify that all datastructure have been extracted
        const extractor = async (uaDataType: UADataType) =>
            await dataTypeManager.getStructureInfoForDataTypeAsync(uaDataType.nodeId);
        const { results, notFound } = await check(allDataTypes, extractor);

        notFound.length.should.eql(0, "all data types should be found");
        results.length.should.eql(allDataTypes.length, "all data types should be found");
    });
});
