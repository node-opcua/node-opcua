import { QualifiedName, AttributeIds } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";
import { IBasicSession } from "node-opcua-pseudo-session";
import { AnyConstructorFunc } from "node-opcua-schemas";
//
import { getExtraDataTypeManager } from "./get_extra_data_type_manager";
import { readDataTypeDefinitionAndBuildType } from "./private/populate_data_type_manager_104";

/**
 *
 */
export async function getExtensionObjectConstructor(session: IBasicSession, dataTypeNodeId: NodeId): Promise<AnyConstructorFunc> {
    const extraDataTypeManager = await getExtraDataTypeManager(session);

    const dataTypeFactory = extraDataTypeManager.getDataTypeFactory(dataTypeNodeId.namespace);
    const Constructor = dataTypeFactory.getConstructorForDataType(dataTypeNodeId);
    if (Constructor) {
        return Constructor as unknown as AnyConstructorFunc;
    }
    const dataValue = await session.read({
        nodeId: dataTypeNodeId,
        attributeId: AttributeIds.BrowseName
    });
    const browseName = dataValue.value.value as QualifiedName;
    await readDataTypeDefinitionAndBuildType(session, dataTypeNodeId, browseName.name!, dataTypeFactory, {});

    return await extraDataTypeManager.getExtensionObjectConstructorFromDataType(dataTypeNodeId);
}
