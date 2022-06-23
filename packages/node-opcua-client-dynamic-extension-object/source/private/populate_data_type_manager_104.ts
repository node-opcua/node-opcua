import { assert } from "node-opcua-assert";
import { AttributeIds, BrowseDirection } from "node-opcua-data-model";
import { make_debugLog, make_errorLog } from "node-opcua-debug";
import { DataTypeFactory } from "node-opcua-factory";
import { NodeId, NodeIdLike, resolveNodeId } from "node-opcua-nodeid";
import { IBasicSession, BrowseDescriptionLike } from "node-opcua-pseudo-session";
import { createDynamicObjectConstructor } from "node-opcua-schemas";
import { StatusCodes } from "node-opcua-status-code";
import { ReferenceDescription, BrowseResult, BrowseDescriptionOptions } from "node-opcua-types";

//
import { ExtraDataTypeManager } from "../extra_data_type_manager";
import {
    CacheForFieldResolution,
    convertDataTypeDefinitionToStructureTypeSchema
} from "../convert_data_type_definition_to_structuretype_schema";
const errorLog = make_errorLog(__filename);
const debugLog = make_debugLog(__filename);

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

class TaskMan {
    private readonly taskList: (() => Promise<void>)[] = [];
    private _runningTask = false;
    private _resolve: (() => void) | undefined = undefined;

    async flushTaskList() {
        const firstTask = this.taskList.shift()!;
        this._runningTask = true;
        await firstTask();
        this._runningTask = false;
        if (this.taskList.length > 0) {
            setImmediate(async () => {
                await this.flushTaskList();
            });
        } else {
            if (this._resolve) {
                const tmpResolve = this._resolve;
                this._resolve = undefined;
                tmpResolve();
            }
        }
    }
    /**
     *
     * a little async task queue that gets executed sequentially
     * outside the main loop
     */
    public registerTask(taskFunc: () => Promise<void>) {
        this.taskList.push(taskFunc);
        if (this.taskList.length === 1 && !this._runningTask) {
            this.flushTaskList();
        }
    }
    public async waitForCompletion() {
        if (this._resolve !== undefined) {
            throw new Error("already waiting");
        }
        await new Promise<void>((resolve) => {
            this._resolve = resolve;
        });
    }
}

async function applyOnReferenceRecursively(
    session: IBasicSession,
    nodeId: NodeId,
    browseDescriptionTemplate: BrowseDescriptionOptions,
    action: (ref: ReferenceDescription) => Promise<void>
): Promise<void> {
    const taskMan = new TaskMan();

    let pendingNodesToBrowse: BrowseDescriptionLike[] = [];
    let pendingContinuationPoints: Buffer[] = [];

    function processBrowseResult(browseResults: BrowseResult[]) {
        for (const result of browseResults) {
            if (result.statusCode === StatusCodes.Good) {
                if (result.continuationPoint) {
                    pendingContinuationPoints.push(result.continuationPoint);
                    taskMan.registerTask(flushBrowse);
                }
                for (const r of result.references || []) {
                    taskMan.registerTask(async () => {
                        await action(r);
                    });
                    // also explore sub types
                    browseSubDataTypeRecursively(r.nodeId);
                }
            }
        }
    }
    async function flushBrowse() {
        if (pendingContinuationPoints.length) {
            const continuationPoints = pendingContinuationPoints;
            pendingContinuationPoints = [];
            taskMan.registerTask(async () => {
                const browseResults = await session.browseNext(continuationPoints, false);
                processBrowseResult(browseResults);
            });
        } else if (pendingNodesToBrowse.length) {
            const nodesToBrowse = pendingNodesToBrowse;
            pendingNodesToBrowse = [];
            taskMan.registerTask(async () => {
                const browseResults = await session.browse(nodesToBrowse);
                processBrowseResult(browseResults);
            });
        }
    }

    function browseSubDataTypeRecursively(nodeId: NodeId): void {
        const nodeToBrowse: BrowseDescriptionOptions = {
            ...browseDescriptionTemplate,
            nodeId
        };
        pendingNodesToBrowse.push(nodeToBrowse);
        taskMan.registerTask(async () => {
            flushBrowse();
        });
    }
    browseSubDataTypeRecursively(nodeId);
    await taskMan.waitForCompletion();
}
export async function populateDataTypeManager104(session: IBasicSession, dataTypeManager: ExtraDataTypeManager): Promise<void> {
    const cache: { [key: string]: CacheForFieldResolution } = {};

    async function withDataType(r: ReferenceDescription): Promise<void> {
        const dataTypeNodeId = r.nodeId;
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

    const nodeToBrowse: BrowseDescriptionOptions = {
        nodeId: NodeId.nullNodeId, // to be replaced
        includeSubtypes: true,
        browseDirection: BrowseDirection.Forward,
        nodeClassMask: 0xff,
        referenceTypeId: resolveNodeId("HasSubtype"),
        resultMask: 0xff
    };
    await applyOnReferenceRecursively(session, resolveNodeId("Structure"), nodeToBrowse, withDataType);
}
