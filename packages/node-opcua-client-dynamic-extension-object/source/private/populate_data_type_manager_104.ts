import { AttributeIds, BrowseDirection } from "node-opcua-data-model";
import { checkDebugFlag, make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";
import { DataTypeFactory, getStandardDataTypeFactory } from "node-opcua-factory";
import { NodeId, type NodeIdLike, resolveNodeId } from "node-opcua-nodeid";
import {
    browseAll,
    type IBasicSessionAsync2,
    type IBasicSessionBrowseAsync,
    type IBasicSessionBrowseNext,
    type IBasicSessionReadAsync,
    type IBasicSessionTranslateBrowsePathAsync
} from "node-opcua-pseudo-session";
import { createDynamicObjectConstructor as createDynamicObjectConstructorAndRegister } from "node-opcua-schemas";
import { StatusCodes } from "node-opcua-status-code";
import {
    type BrowseDescriptionOptions,
    type DataTypeDefinition,
    type ReferenceDescription,
    StructureDefinition
} from "node-opcua-types";
import {
    convertDataTypeDefinitionToStructureTypeSchema,
    type ICache
} from "../convert_data_type_definition_to_structuretype_schema.js";
//
import type { ExtraDataTypeManager } from "../extra_data_type_manager.js";
import { hasBoostedSession } from "../get_extra_data_type_manager.js";

const errorLog = make_errorLog("populateDataTypeManager");
const debugLog = make_debugLog("populateDataTypeManager");
const warningLog = make_warningLog("populateDataTypeManager");
const doDebug = checkDebugFlag("populateDataTypeManager");

type DependentNamespaces = Set<number>;

/**
 * A dataType that could not be turned into a constructor.
 *
 * These are collected rather than only logged. A failure here means the class is never
 * registered, so decoding that extension object fails later with nothing pointing back
 * to this load - and the 1.03 loader had exactly that fault for five standard types
 * while every test passed. One line naming the count and the types makes the state
 * visible without anyone having to read scrollback.
 */
export interface IDataTypeLoadFailure {
    dataTypeNodeId: string;
    name: string;
    message: string;
}

export async function readDataTypeDefinitionAndBuildType(
    session: IBasicSessionAsync2,
    dataTypeNodeId: NodeId,
    name: string | undefined,
    dataTypeManager: ExtraDataTypeManager,
    cache: ICache,
    failures?: IDataTypeLoadFailure[]
): Promise<DependentNamespaces> {
    const dependentNamespaces: DependentNamespaces = new Set();
    try {
        if (dataTypeManager.getStructureInfoForDataType(dataTypeNodeId)) {
            return dependentNamespaces;
        }
        const [isAbstractDataValue, dataTypeDefinitionDataValue, browseNameDataValue] = await session.read([
            {
                attributeId: AttributeIds.IsAbstract,
                nodeId: dataTypeNodeId
            },
            {
                attributeId: AttributeIds.DataTypeDefinition,
                nodeId: dataTypeNodeId
            },
            {
                attributeId: AttributeIds.BrowseName,
                nodeId: dataTypeNodeId
            }
        ]);
        if (isAbstractDataValue.statusCode === StatusCodes.BadNodeIdUnknown) {
            // may be model is incomplete and dataTypeNodeId is missing
            // c8 ignore next
            doDebug && debugLog("Cannot find dataTypeNodeId = ", dataTypeNodeId.toString());
            return dependentNamespaces;
        }

        const resolvedName = name || (browseNameDataValue.value?.value?.name as string) || "Unknown";

        /* c8 ignore next */
        if (isAbstractDataValue.statusCode.isNotGood()) {
            errorLog("browseName", browseNameDataValue.value.toString());
            throw new Error(
                ` Cannot find dataType isAbstract ! with nodeId =${dataTypeNodeId.toString()} ${isAbstractDataValue.statusCode.toString()}`
            );
        }
        const isAbstract = isAbstractDataValue.value.value as boolean;

        let dataTypeDefinition: DataTypeDefinition = dataTypeDefinitionDataValue.value.value as DataTypeDefinition;
        /* c8 ignore next */
        if (dataTypeDefinitionDataValue.statusCode.isNotGood()) {
            // may be we are reading a 1.03 server
            // or it could be some of the di:ParameterResultDataType that are not marked as abstract
            // in some cases
            if (!isAbstract) {
                const [isAbstract2, browseNameDV] = await session.read([
                    { nodeId: dataTypeNodeId, attributeId: AttributeIds.IsAbstract },
                    { nodeId: dataTypeNodeId, attributeId: AttributeIds.BrowseName }
                ]);
                warningLog(
                    ` Cannot find dataType Definition ! with nodeId =${dataTypeNodeId.toString()}`,
                    browseNameDV.value?.value?.toString(),
                    isAbstract2.value?.value
                );
                return dependentNamespaces;
            }
            // it is OK to not have dataTypeDefinition for Abstract type!
            dataTypeDefinition = new StructureDefinition();
        }

        // get dependencies of struct
        if (dataTypeDefinition instanceof StructureDefinition && dataTypeDefinition.fields) {
            for (const field of dataTypeDefinition.fields) {
                const dataTypeNamespace = field.dataType.namespace;
                if (dataTypeNamespace === dataTypeDefinition.defaultEncodingId.namespace) {
                    continue; // not dependent on own namespace
                }
                dependentNamespaces.add(dataTypeNamespace);
            }
        }

        const schema = await convertDataTypeDefinitionToStructureTypeSchema(
            session,
            dataTypeNodeId,
            resolvedName,
            dataTypeDefinition,
            null,
            dataTypeManager,
            isAbstract,
            cache
        );

        const dataTypeFactory = dataTypeManager.getDataTypeFactoryForNamespace(dataTypeNodeId.namespace);
        if (isAbstract) {
            // cannot construct an abstract structure
            dataTypeFactory.registerAbstractStructure(dataTypeNodeId, resolvedName, schema);
        } else {
            createDynamicObjectConstructorAndRegister(schema, dataTypeFactory);
        }
    } catch (err) {
        const message = (err as Error).message;
        if (failures) {
            // the caller reports these together; logging here as well would only
            // reproduce the scattered lines this is meant to replace
            failures.push({ dataTypeNodeId: dataTypeNodeId.toString(), name: name || "?", message });
        } else {
            errorLog("Error", message, " while processing dataTypeNodeId =", dataTypeNodeId.toString());
        }
    }
    return dependentNamespaces;
}

export async function populateDataTypeManager104(
    session: IBasicSessionAsync2,
    dataTypeManager: ExtraDataTypeManager
): Promise<void> {
    const dataFactoriesDependencies = new Map<number, DependentNamespaces>();

    const cache: ICache = {};
    const failures: IDataTypeLoadFailure[] = [];

    async function withDataType(r: ReferenceDescription): Promise<void> {
        const dataTypeNodeId = r.nodeId;
        try {
            if (dataTypeNodeId.namespace === 0) {
                // already known I guess
                doDebug && debugLog("populateDataTypeManager104: skiping dataType = namespace 0", dataTypeNodeId.toString());
                return;
            }

            // register factory if not already registered
            let dataTypeFactory = dataTypeManager.getDataTypeFactory(dataTypeNodeId.namespace);
            if (!dataTypeFactory) {
                dataTypeFactory = new DataTypeFactory([]);
                dataTypeManager.registerDataTypeFactory(dataTypeNodeId.namespace, dataTypeFactory);
                //   throw new Error("cannot find dataType Manager for namespace of " + dataTypeNodeId.toString());
            }

            // if not found already
            if (dataTypeFactory.getStructureInfoForDataType(dataTypeNodeId)) {
                // already known !
                doDebug && debugLog("populateDataTypeManager104: skiping dataType = already known", dataTypeNodeId.toString());
                return;
            }

            // extract it formally
            doDebug &&
                debugLog("populateDataTypeManager104: processing dataType = ", r.browseName.toString(), dataTypeNodeId.toString());
            if (!r.browseName.name) {
                throw new Error(`Unexpected: BrowseName has no name for nodeId ${dataTypeNodeId.toString()}`);
            }
            const dependentNamespaces = await readDataTypeDefinitionAndBuildType(
                session,
                dataTypeNodeId,
                r.browseName.name,
                dataTypeManager,
                cache,
                failures
            );

            // add dependent namespaces to dataFactoriesDependencies
            let dataFactoryDependencies = dataFactoriesDependencies.get(dataTypeNodeId.namespace);
            if (!dataFactoryDependencies) {
                // add new dependencies set if not already existing
                dataFactoryDependencies = new Set([0]); // always dependent on UA node set
                dataFactoriesDependencies.set(dataTypeNodeId.namespace, dataFactoryDependencies);
            }
            for (const ns of dependentNamespaces) {
                dataFactoryDependencies.add(ns);
            }
        } catch (err) {
            // named, so the summary below can say which type failed rather than "err="
            failures.push({
                dataTypeNodeId: dataTypeNodeId.toString(),
                name: r.browseName.name || "?",
                message: (err as Error).message
            });
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

    // One line for the whole load. A dataType that fails here is simply absent from the
    // factory, and every later decode of it fails somewhere unrelated, so the count
    // belongs where it can be seen rather than spread across the run.
    if (failures.length > 0) {
        warningLog(
            `populateDataTypeManager104: ${failures.length} dataType(s) could not be registered;` +
                " decoding those extension objects will fail:"
        );
        for (const f of failures) {
            warningLog(`    ${f.name} (${f.dataTypeNodeId}): ${f.message}`);
        }
    }

    // set factory dependencies
    for (const [namespace, dependentNamespaces] of dataFactoriesDependencies) {
        const namespaceDataTypeFactory = dataTypeManager.getDataTypeFactoryForNamespace(namespace);
        const dependentTypeFactories = new Set<DataTypeFactory>([getStandardDataTypeFactory()]);

        for (const dependentNamespace of dependentNamespaces) {
            if (dependentNamespace === 0) continue; // already added above
            const dependentTypeFactory = dataTypeManager.getDataTypeFactoryForNamespace(dependentNamespace);
            dependentTypeFactories.add(dependentTypeFactory);
        }

        const baseDataFactories = Array.from(dependentTypeFactories);
        namespaceDataTypeFactory.repairBaseDataFactories(baseDataFactories);
    }
}
async function applyOnReferenceRecursively(
    session: IBasicSessionTranslateBrowsePathAsync & IBasicSessionReadAsync & IBasicSessionBrowseAsync & IBasicSessionBrowseNext,
    nodeId: NodeId,
    browseDescriptionTemplate: BrowseDescriptionOptions,
    action: (ref: ReferenceDescription) => Promise<void>
): Promise<void> {
    const hasBoosted = hasBoostedSession(session as unknown as IBasicSessionAsync2);
    const useHeavyParallelization = hasBoosted;

    // c8 ignore next
    doDebug && debugLog("applyOnReferenceRecursively = useHeavyParallelization", useHeavyParallelization);

    const oneLevel = async (nodeId: NodeIdLike, level: number) => {
        doDebug && debugLog("applyOnReferenceRecursively = level", level, "nodeId", nodeId.toString());
        const nodeToBrowse: BrowseDescriptionOptions = {
            ...browseDescriptionTemplate,
            nodeId
        };

        const browseResult = await browseAll(session, nodeToBrowse);
        if (useHeavyParallelization) {
            // @sterfive/optimized-client (PRO module) we can
            // parallelize and minimize the number of calls to the server to
            // drastically improve performance
            const promises: Promise<void>[] = [];
            for (const ref of browseResult.references || []) {
                promises.push(
                    (async () => {
                        await action(ref);
                        await oneLevel(ref.nodeId, level + 1);
                    })()
                );
            }
            await Promise.all(promises);
        } else {
            // important: we dont parallelize the action on browse reference
            // to avoid overloading browseContinuationToken on client side
            for (const ref of browseResult.references || []) {
                await action(ref);
                await oneLevel(ref.nodeId, level + 1);
            }
        }
    };
    await oneLevel(nodeId, 0);
}
