import { assert } from "node-opcua-assert";
import { AttributeIds, BrowseDirection } from "node-opcua-data-model";
import { DataTypeFactory } from "node-opcua-factory";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { IBasicSession, BrowseDescriptionLike } from "node-opcua-pseudo-session";
import { createDynamicObjectConstructor } from "node-opcua-schemas";
import { StatusCodes } from "node-opcua-status-code";
import { ReferenceDescription, BrowseResult } from "node-opcua-types";

//
import { ExtraDataTypeManager } from "../extra_data_type_manager";
import {
    CacheForFieldResolution,
    convertDataTypeDefinitionToStructureTypeSchema
} from "../convert_data_type_definition_to_structuretype_schema";
import { make_debugLog, make_errorLog } from "node-opcua-debug";
const errorLog = make_errorLog(__filename);
const debugLog =make_debugLog(__filename);

export async function readDataTypeDefinitionAndBuildType(
    session: IBasicSession,
    dataTypeNodeId: NodeId,
    name: string,
    dataTypeFactory: DataTypeFactory,
    cache: { [key: string]: CacheForFieldResolution } 
) {
    try {
        const dataTypeDefinitionDataValue = await session.read({
            attributeId: AttributeIds.DataTypeDefinition,
            nodeId: dataTypeNodeId
        });
        /* istanbul ignore next */
        if (dataTypeDefinitionDataValue.statusCode !== StatusCodes.Good) {
            throw new Error(" Cannot find dataType Definition ! with nodeId =" + dataTypeNodeId.toString());
        }
        const dataTypeDefinition = dataTypeDefinitionDataValue.value.value;

        const schema = await convertDataTypeDefinitionToStructureTypeSchema(
            session,
            dataTypeNodeId,
            name,
            dataTypeDefinition,
            dataTypeFactory,
            cache
        );

        createDynamicObjectConstructor(schema, dataTypeFactory);
    } catch (err) {
        errorLog("Error", err);
    }
}

export async function populateDataTypeManager104(session: IBasicSession, dataTypeManager: ExtraDataTypeManager): Promise<void> {

    const cache: { [key: string]: CacheForFieldResolution } = {};
    
    async function withDataType(dataTypeNodeId: NodeId, r: ReferenceDescription): Promise<void> {
        try {
            const dataTypeFactory = dataTypeManager.getDataTypeFactory(dataTypeNodeId.namespace);
            if (dataTypeNodeId.namespace === 0) {
                // already known I guess
                return;
            }
            // if not found already
            if (dataTypeFactory.getConstructorForDataType(dataTypeNodeId)) {
                // already known !
                return;
            }
            // extract it formally
            debugLog(" DataType => ", r.browseName.toString(), dataTypeNodeId.toString());
            await readDataTypeDefinitionAndBuildType(session, dataTypeNodeId, r.browseName.name!, dataTypeFactory, cache);
            assert(dataTypeFactory.getConstructorForDataType(dataTypeNodeId));
        } catch (err) {
            errorLog("err=", err);
        }
    }

    function performAction(done: () => void) {
        let pendingNodesToBrowse: BrowseDescriptionLike[] = [];
        let pendingContinuationPoints: Buffer[] = [];
        function triggerFutureBrowse() {
            if (pendingNodesToBrowse.length + pendingContinuationPoints.length === 1) {
                fencedAction(async ()=>{
                    flushBrowse();
                });
            }
        }
        let busyCount = 0;
        function processBrowseResult(browseResults: BrowseResult[]) {
        
            for (const result of browseResults) {
                if (result.statusCode === StatusCodes.Good) {
                    if (result.continuationPoint) {
                        pendingContinuationPoints.push(result.continuationPoint);
                        triggerFutureBrowse();
                    }
                    for (const r of result.references || []) {
                        const dataTypeNodeId = r.nodeId;
                        fencedAction(async ()=>{
                            await withDataType(dataTypeNodeId, r);
                        });
                        // also explore sub types
                        browseSubDataTypeRecursively(dataTypeNodeId);
                    }
                }
            }
        }

        async function fencedAction(lambda: () => Promise<void>) {
            busyCount += 1;
            await lambda();
            busyCount -= 1;
            flushBrowse();
        }
        function flushBrowse() {
            assert(busyCount >= 0);
            if (pendingContinuationPoints.length) {
                const continuationPoints = pendingContinuationPoints;
                pendingContinuationPoints = [];
                fencedAction(async () => {
                    const browseResults = await session.browseNext(continuationPoints, false);
                    processBrowseResult(browseResults);
                });
            } else if (pendingNodesToBrowse.length) {
                const nodesToBrowse = pendingNodesToBrowse;
                pendingNodesToBrowse = [];

                fencedAction(async () => {
                    const browseResults = await session.browse(nodesToBrowse);
                    processBrowseResult(browseResults);
                });
            } else if (pendingContinuationPoints.length + pendingNodesToBrowse.length === 0 && busyCount === 0) {
                done();
            }
        }

        function browseSubDataTypeRecursively(nodeId: NodeId): void {
            const nodeToBrowse: BrowseDescriptionLike = {
                nodeId,
                includeSubtypes: true,
                browseDirection: BrowseDirection.Forward,
                nodeClassMask: 0xff,
                referenceTypeId: resolveNodeId("HasSubtype"),
                resultMask: 0xff
            };
            pendingNodesToBrowse.push(nodeToBrowse);
            triggerFutureBrowse();
        }

        browseSubDataTypeRecursively(resolveNodeId("Structure"));
    }
    await new Promise<void>((resolve) => performAction(resolve));
}
