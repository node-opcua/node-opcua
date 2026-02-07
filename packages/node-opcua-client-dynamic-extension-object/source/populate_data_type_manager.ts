import { AttributeIds, BrowseDirection, NodeClassMask, ResultMask } from "node-opcua-data-model";
import { resolveNodeId } from "node-opcua-nodeid";
import {
    IBasicSessionAsync2,
    browseAll,
    readNamespaceArray
} from "node-opcua-pseudo-session";
import { DataTypeIds, ObjectIds, VariableIds, VariableTypeIds } from "node-opcua-constants";
import { DataType } from "node-opcua-variant";
import { ReferenceDescription } from "node-opcua-types";
import { makeBrowsePath } from "node-opcua-service-translate-browse-path";
//
import { ExtraDataTypeManager } from "./extra_data_type_manager";
import { populateDataTypeManager103 } from "./private/populate_data_type_manager_103";
import { populateDataTypeManager104 } from "./private/populate_data_type_manager_104";
import { DataTypeFactory } from "node-opcua-factory";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";


const doDebug = checkDebugFlag("populateDataTypeManager");
const debugLog = make_debugLog("populateDataTypeManager");

const ComplexTypes2017 = "http://opcfoundation.org/UA-Profile/Server/ComplexTypes2017";

export async function serverImplementsDataTypeDefinition(
    session: IBasicSessionAsync2
): Promise<boolean> {

    const dataValueServerCapabilities = await session.read({
        nodeId: resolveNodeId(VariableIds.Server_ServerCapabilities_ServerProfileArray),
        attributeId: AttributeIds.Value
    });
    const serverCapabilities = dataValueServerCapabilities.value?.value as string[] ?? [];

    if (serverCapabilities.indexOf(ComplexTypes2017) >= 0) {
        doDebug && debugLog("server implements ComplexTypes2017");
        return true;
    }

    // Check if any non-deprecated 1.03 dictionary exists
    const browseResult1 = await session.browse({
        browseDirection: BrowseDirection.Forward,
        includeSubtypes: true,
        nodeClassMask: NodeClassMask.Variable,
        nodeId: resolveNodeId(ObjectIds.OPCBinarySchema_TypeSystem),
        resultMask: ResultMask.TypeDefinition
    });

    const references103 = browseResult1.references || [];
    for (const ref of references103) {
        const td = ref.typeDefinition;
        if (td.namespace === 0 && td.value === VariableTypeIds.DataTypeDictionaryType) {
            const p = await session.translateBrowsePath(makeBrowsePath(ref.nodeId, "/Deprecated"));
            if (!p.statusCode.isGood() || !p.targets || p.targets.length === 0) {
                doDebug && debugLog("server implements 1.03 dictionary but no Deprecated node found");
                return false;
            }
            const deprecatedNodeId = p.targets[0].targetId;
            const dataValue = await session.read({ nodeId: deprecatedNodeId, attributeId: AttributeIds.Value });
            if (dataValue.statusCode.isGood() && dataValue.value.value === false) {
                doDebug && debugLog("server implements 1.03 dictionary but Deprecated node is true");
                return false;
            }
        }
    }

    // Try to find AT LEAST ONE custom DataType and check its DataTypeDefinition
    // We browse the Structure type (22) without recursion first
    const browseResult2 = await session.browse({
        browseDirection: BrowseDirection.Forward,
        includeSubtypes: true,
        nodeClassMask: NodeClassMask.DataType,
        nodeId: resolveNodeId(DataTypeIds.Structure),
        referenceTypeId: resolveNodeId("HasSubtype"),
        resultMask: 63
    });

    const references = browseResult2.references || [];
    const customDataType = references.find(r => r.nodeId.namespace !== 0);
    if (customDataType) {
        const dv = await session.read({ nodeId: customDataType.nodeId, attributeId: AttributeIds.DataTypeDefinition });
        if (dv.statusCode.isGood()) {
            doDebug && debugLog("server implements 1.04 dictionary with custom DataType");
            return true;
        }
    } else {
        const standardDataType = references.find(r => r.nodeId.namespace == 0);
        if (standardDataType) {
            const dv = await session.read({ nodeId: standardDataType.nodeId, attributeId: AttributeIds.DataTypeDefinition });
            if (dv.statusCode.isGood()) {
                doDebug && debugLog("server implements 1.04 dictionary with standard DataType");
                return true;
            }
        }
    }

    // If no custom type at first level, check Union too
    const browseResult3 = await session.browse({
        browseDirection: BrowseDirection.Forward,
        includeSubtypes: true,
        nodeClassMask: NodeClassMask.DataType,
        nodeId: resolveNodeId(DataTypeIds.Union),
        referenceTypeId: resolveNodeId("HasSubtype"),
        resultMask: 63
    });
    const customDataType2 = (browseResult3.references || []).find(r => r.nodeId.namespace !== 0);
    if (customDataType2) {
        const dv = await session.read({ nodeId: customDataType2.nodeId, attributeId: AttributeIds.DataTypeDefinition });
        if (dv.statusCode.isGood()) {
            doDebug && debugLog("server implements 1.04 dictionary with custom Union");
            return true;
        }
    }

    doDebug && debugLog("server does not implement 1.04 dictionary or we cannot find any evidence of it");
    return false;
}

export enum DataTypeExtractStrategy {
    Auto = 0,
    Force103 = 1,
    Force104 = 2,
    Both = 3,
    Lazy = 4
};

export async function populateDataTypeManager(
    session: IBasicSessionAsync2,
    dataTypeManager: ExtraDataTypeManager,
    strategy: DataTypeExtractStrategy
): Promise<void> {
    dataTypeManager.setSession(session);


    if (strategy === DataTypeExtractStrategy.Lazy) {
        doDebug && debugLog("populateDataTypeManager: Lazy mode");
        const force104 = await serverImplementsDataTypeDefinition(session);
        if (force104) {
            doDebug && debugLog("populateDataTypeManager: Lazy mode - server implements 1.04 dictionary - we will be lazy");
            // we are in lazy mode for 1.0.5+
            // create teh dataTypeFactory for namespace 1
            const namespace = await readNamespaceArray(session);
            for (let i = 1; i < namespace.length; i++) {
                let dataTypeFactory = dataTypeManager.getDataTypeFactory(i);
                if (!dataTypeFactory) {
                    dataTypeFactory = new DataTypeFactory([]);
                    dataTypeManager.registerDataTypeFactory(i, dataTypeFactory);
                    //   throw new Error("cannot find dataType Manager for namespace of " + dataTypeNodeId.toString());
                }
            }
            return;
        }
        doDebug && debugLog("populateDataTypeManager: Lazy mode - server does not implement 1.04 dictionary - we will be eager");
        // for old 1.03 servers we must be eager as we don't have a way to lazy load 1.03 dictionaries yet
        await populateDataTypeManager103(session, dataTypeManager);
        await populateDataTypeManager104(session, dataTypeManager);
        return;
    }
    if (strategy === DataTypeExtractStrategy.Auto) {
        doDebug && debugLog("populateDataTypeManager: Auto mode");
        const force104 = await serverImplementsDataTypeDefinition(session);

        if (force104) {
            doDebug && debugLog("populateDataTypeManager: Auto mode - server implements 1.04 dictionary - we will be 104 eager");
            await populateDataTypeManager104(session, dataTypeManager);
            return;
        }
        doDebug && debugLog("populateDataTypeManager: Auto mode - server does not implement 1.04 dictionary - we will be 103 eager and 104 eager");
        // old way for 1.03 and early 1.04 prototype
        await populateDataTypeManager103(session, dataTypeManager);
        await populateDataTypeManager104(session, dataTypeManager);
        return;
    }
    if (strategy == DataTypeExtractStrategy.Force103 || strategy == DataTypeExtractStrategy.Both) {
        doDebug && debugLog("populateDataTypeManager: Force103 mode - we will be 103 eager");
        await populateDataTypeManager103(session, dataTypeManager);
    }
    if (strategy == DataTypeExtractStrategy.Force104 || strategy == DataTypeExtractStrategy.Both) {
        doDebug && debugLog("populateDataTypeManager: Force104 mode - we will be 104 eager");
        await populateDataTypeManager104(session, dataTypeManager);
    }
}
