import { AttributeIds, BrowseDirection } from "node-opcua-data-model";
import { checkDebugFlag, make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";
import { DataTypeFactory, getStandardDataTypeFactory } from "node-opcua-factory";
import { NodeId, resolveNodeId, NodeIdLike } from "node-opcua-nodeid";
import { IBasicSessionAsync2, IBasicSessionBrowseAsync, IBasicSessionBrowseNext, IBasicSessionReadAsync, IBasicSessionTranslateBrowsePathAsync, browseAll } from "node-opcua-pseudo-session";
import { createDynamicObjectConstructor as createDynamicObjectConstructorAndRegister } from "node-opcua-schemas";
import {
    ReferenceDescription,
    BrowseDescriptionOptions,
    StructureDefinition,
    DataTypeDefinition} from "node-opcua-types";
//
import { ExtraDataTypeManager } from "../extra_data_type_manager";
import {
    ICache,
    convertDataTypeDefinitionToStructureTypeSchema
} from "../convert_data_type_definition_to_structuretype_schema";
import { StatusCodes } from "node-opcua-status-code";

const errorLog = make_errorLog(__filename);
const debugLog = make_debugLog(__filename);
const warningLog = make_warningLog(__filename);
const doDebug = checkDebugFlag(__filename);

type DependentNamespaces = Set<number>

export async function readDataTypeDefinitionAndBuildType(
    session: IBasicSessionAsync2,
    dataTypeNodeId: NodeId,
    name: string,
    dataTypeFactory: DataTypeFactory,
    cache: ICache
): Promise<DependentNamespaces> {
    const dependentNamespaces: DependentNamespaces = new Set();
    try {
        if (dataTypeFactory.getStructureInfoForDataType(dataTypeNodeId)) {
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
        if (isAbstractDataValue.statusCode == StatusCodes.BadNodeIdUnknown) {
            // may be model is incomplete and dataTypeNodeId is missing
            debugLog("Cannot find dataTypeNodeId = ", dataTypeNodeId.toString());
            return dependentNamespaces;
        }
        /* istanbul ignore next */
        if (isAbstractDataValue.statusCode.isNotGood()) {
            errorLog("browseName", browseNameDataValue.value.toString());
            throw new Error(" Cannot find dataType isAbstract ! with nodeId =" + dataTypeNodeId.toString() + " " + isAbstractDataValue.statusCode.toString());
        }
        const isAbstract = isAbstractDataValue.value.value as boolean;

        let dataTypeDefinition: DataTypeDefinition = dataTypeDefinitionDataValue.value.value as DataTypeDefinition;
        /* istanbul ignore next */
        if (dataTypeDefinitionDataValue.statusCode.isNotGood()) {
            // may be we are reading a 1.03 server
            // or it could be some of the di:ParameterResultDataType that are not marked as abstract
            // in some cases
            if (!isAbstract) {
                const [isAbstract2, browseNameDV] = await session.read([
                    { nodeId: dataTypeNodeId, attributeId: AttributeIds.IsAbstract },
                    { nodeId: dataTypeNodeId, attributeId: AttributeIds.BrowseName }
                ]);
                warningLog(" Cannot find dataType Definition ! with nodeId =" + dataTypeNodeId.toString(), browseNameDV.value?.value?.toString(), isAbstract2.value?.value);
                return dependentNamespaces;
            }
            // it is OK to not have dataTypeDefinition for Abstract type!
            dataTypeDefinition = new StructureDefinition();
        }

        // get dependencies of struct
        if (dataTypeDefinition instanceof StructureDefinition && dataTypeDefinition.fields) {
            for (const field of dataTypeDefinition.fields){
                const dataTypeNamespace = field.dataType.namespace
                if (dataTypeNamespace === dataTypeDefinition.defaultEncodingId.namespace) {
                    continue; // not dependent on own namespace
                };
                dependentNamespaces.add(dataTypeNamespace);
            }
        }

        const schema = await convertDataTypeDefinitionToStructureTypeSchema(
            session,
            dataTypeNodeId,
            name,
            dataTypeDefinition,
            null,
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
    return dependentNamespaces;
}

export async function populateDataTypeManager104(
    session: IBasicSessionAsync2,
    dataTypeManager: ExtraDataTypeManager
): Promise<void> {

    const dataFactoriesDependencies = new Map<number, DependentNamespaces>();

    const cache: ICache = {};

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
            doDebug && debugLog(" DataType => ", r.browseName.toString(), dataTypeNodeId.toString());
            const dependentNamespaces = await readDataTypeDefinitionAndBuildType(session, dataTypeNodeId, r.browseName.name!, dataTypeFactory, cache);
            
            // add dependent namespaces to dataFactoriesDependencies
            let dataFactoryDependencies = dataFactoriesDependencies.get(dataTypeNodeId.namespace);
            if (!dataFactoryDependencies){
                // add new dependencies set if not already existing
                dataFactoryDependencies = new Set([0]); // always dependent on UA node set
                dataFactoriesDependencies.set(dataTypeNodeId.namespace, dataFactoryDependencies);
            }
            dependentNamespaces.forEach((ns) => dataFactoryDependencies.add(ns));

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

    // set factory dependencies
    for (const [namespace, dependentNamespaces] of dataFactoriesDependencies){

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


    const oneLevel = async (nodeId: NodeIdLike) => {

        const nodeToBrowse: BrowseDescriptionOptions = {
            ...browseDescriptionTemplate,
            nodeId
        };

        const browseResult = await browseAll(session, nodeToBrowse);

        const promises: Promise<void>[] = [];
        for (const ref of browseResult.references || []) {
            promises.push((async () => {
                await action(ref);
                await oneLevel(ref.nodeId);
            })());
        }
        await Promise.all(promises);
    };
    await oneLevel(nodeId);
}