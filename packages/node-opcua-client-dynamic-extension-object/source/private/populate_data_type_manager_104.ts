import { assert } from "node-opcua-assert";
import { AttributeIds, BrowseDirection } from "node-opcua-data-model";
import { make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";
import { DataTypeFactory } from "node-opcua-factory";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { IBasicSession, browseAll } from "node-opcua-pseudo-session";
import { createDynamicObjectConstructor as createDynamicObjectConstructorAndRegister } from "node-opcua-schemas";
import { StatusCodes } from "node-opcua-status-code";
import {
    ReferenceDescription,
    BrowseResult,
    BrowseDescriptionOptions,
    StructureDefinition,
    DataTypeDefinition,
    BrowseDescription
} from "node-opcua-types";
//
import { ExtraDataTypeManager } from "../extra_data_type_manager";
import {
    CacheForFieldResolution,
    convertDataTypeDefinitionToStructureTypeSchema
} from "../convert_data_type_definition_to_structuretype_schema";

const errorLog = make_errorLog(__filename);
const debugLog = make_debugLog(__filename);
const warningLog = make_warningLog(__filename);

export async function readDataTypeDefinitionAndBuildType(
    session: IBasicSession,
    dataTypeNodeId: NodeId,
    name: string,
    dataTypeFactory: DataTypeFactory,
    cache: { [key: string]: CacheForFieldResolution }
): Promise<void> {
    try {
        if (dataTypeFactory.getStructureInfoForDataType(dataTypeNodeId)) {
            return;
        }
        const [isAbstractDataValue, dataTypeDefinitionDataValue] = await session.read([
            {
                attributeId: AttributeIds.IsAbstract,
                nodeId: dataTypeNodeId
            },
            {
                attributeId: AttributeIds.DataTypeDefinition,
                nodeId: dataTypeNodeId
            }
        ]);
        /* istanbul ignore next */
        if (isAbstractDataValue.statusCode.isNotGood()) {
            throw new Error(" Cannot find dataType isAbstract ! with nodeId =" + dataTypeNodeId.toString());
        }
        const isAbstract = isAbstractDataValue.value.value as boolean;

        let dataTypeDefinition: DataTypeDefinition = dataTypeDefinitionDataValue.value.value as DataTypeDefinition;
        /* istanbul ignore next */
        if (dataTypeDefinitionDataValue.statusCode.isNotGood()) {
            // may be we are reading a 1.03 server
            if (!isAbstract) {
                warningLog(" Cannot find dataType Definition ! with nodeId =" + dataTypeNodeId.toString());
                return;
            }
            // it is OK to not have dataTypeDefinition for Abstract type!
            dataTypeDefinition = new StructureDefinition();
        }

        const schema = await convertDataTypeDefinitionToStructureTypeSchema(
            session,
            dataTypeNodeId,
            name,
            dataTypeDefinition,
            dataTypeFactory,
            isAbstract,
            cache
        );
        if (isAbstract) {
            // cannot construct an abstract structure
            dataTypeFactory.registerAbstractStructure(dataTypeNodeId, name, schema);
        } else {
            const Constructor = createDynamicObjectConstructorAndRegister(schema, dataTypeFactory);
        }
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
    const taskManager = new TaskMan();

    let pendingNodesToBrowse: BrowseDescriptionOptions[] = [];

    function processBrowseResults(nodesToBrowse: BrowseDescriptionOptions[], browseResults: BrowseResult[]) {
        for (let i = 0; i < browseResults.length; i++) {
            const result = browseResults[i];
            const nodeToBrowse = nodesToBrowse[i];
            if (
                result.statusCode.equals(StatusCodes.BadNoContinuationPoints) ||
                result.statusCode.equals(StatusCodes.BadContinuationPointInvalid)
            ) {
                // not enough continuation points .. we need to rebrowse
                pendingNodesToBrowse.push(nodeToBrowse);
                //                taskMananager.registerTask(flushBrowse);
            } else if (result.statusCode.isGood()) {
                for (const r of result.references || []) {
                    // also explore sub types
                    browseSubDataTypeRecursively(r.nodeId);
                    taskManager.registerTask(async () => await action(r));
                }
            } else {
                errorLog(
                    "Unexpected status code",
                    i,
                    new BrowseDescription(nodesToBrowse[i] || {})?.toString(),
                    result.statusCode.toString()
                );
            }
        }
    }
    async function flushBrowse() {
        if (pendingNodesToBrowse.length) {
            const nodesToBrowse = pendingNodesToBrowse;
            pendingNodesToBrowse = [];
            taskManager.registerTask(async () => {
                try {
                    const browseResults = await browseAll(session, nodesToBrowse);
                    processBrowseResults(nodesToBrowse, browseResults);
                } catch (err) {
                    errorLog("err", (err as Error).message);
                    errorLog(nodesToBrowse.toString());
                }
            });
        }
    }

    function browseSubDataTypeRecursively(nodeId: NodeId): void {
        const nodeToBrowse: BrowseDescriptionOptions = {
            ...browseDescriptionTemplate,
            nodeId
        };
        pendingNodesToBrowse.push(nodeToBrowse);
        taskManager.registerTask(async () => flushBrowse());
    }
    browseSubDataTypeRecursively(nodeId);
    await taskManager.waitForCompletion();
}
export async function populateDataTypeManager104(session: IBasicSession, dataTypeManager: ExtraDataTypeManager): Promise<void> {
    const cache: { [key: string]: CacheForFieldResolution } = {};

    async function withDataType(r: ReferenceDescription): Promise<void> {
        const dataTypeNodeId = r.nodeId;
        try {
            if (dataTypeNodeId.namespace === 0) {
                // already known I guess
                return;
            }
            let dataTypeFactory = dataTypeManager.getDataTypeFactory(dataTypeNodeId.namespace);
            if (!dataTypeFactory) {
                dataTypeFactory = new DataTypeFactory([]);
                dataTypeManager.registerDataTypeFactory(dataTypeNodeId.namespace, dataTypeFactory);
                //   throw new Error("cannot find dataType Manager for namespace of " + dataTypeNodeId.toString());
            }
            // if not found already
            if (dataTypeFactory.getStructureInfoForDataType(dataTypeNodeId)) {
                // already known !
                return;
            }
            // extract it formally
            debugLog(" DataType => ", r.browseName.toString(), dataTypeNodeId.toString());
            await readDataTypeDefinitionAndBuildType(session, dataTypeNodeId, r.browseName.name!, dataTypeFactory, cache);
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
