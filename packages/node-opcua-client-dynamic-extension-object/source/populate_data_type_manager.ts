import { AttributeIds, BrowseDirection, NodeClassMask, ResultMask } from "node-opcua-data-model";
import { resolveNodeId } from "node-opcua-nodeid";
import {
    IBasicSessionAsync2,
    browseAll
} from "node-opcua-pseudo-session";
import { DataTypeIds, ObjectIds, VariableIds, VariableTypeIds } from "node-opcua-constants";
import { DataType } from "node-opcua-variant";
import { ReferenceDescription } from "node-opcua-types";
import { makeBrowsePath } from "node-opcua-service-translate-browse-path";
//
import { ExtraDataTypeManager } from "./extra_data_type_manager";
import { populateDataTypeManager103 } from "./private/populate_data_type_manager_103";
import { populateDataTypeManager104 } from "./private/populate_data_type_manager_104";


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
                return false;
            }
            const deprecatedNodeId = p.targets[0].targetId;
            const dataValue = await session.read({ nodeId: deprecatedNodeId, attributeId: AttributeIds.Value });
            if (dataValue.statusCode.isGood() && dataValue.value.value === false) {
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
            return true;
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
            return true;
        }
    }

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
        return;
    }
    if (strategy === DataTypeExtractStrategy.Auto) {
        const force104 = await serverImplementsDataTypeDefinition(session);
        if (force104) {
            // we are in lazy mode for 1.04+
            return;
        }
        // old way for 1.03 and early 1.04 prototype
        await populateDataTypeManager103(session, dataTypeManager);
        await populateDataTypeManager104(session, dataTypeManager);
        return;
    }
    if (strategy == DataTypeExtractStrategy.Force103 || strategy == DataTypeExtractStrategy.Both) {
        await populateDataTypeManager103(session, dataTypeManager);
    }
    if (strategy == DataTypeExtractStrategy.Force104 || strategy == DataTypeExtractStrategy.Both) {
        await populateDataTypeManager104(session, dataTypeManager);
    }
}
