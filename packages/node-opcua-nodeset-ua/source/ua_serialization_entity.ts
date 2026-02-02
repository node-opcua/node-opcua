// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UInt16 } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
import { DTKeyValuePair } from "./dt_key_value_pair"
import { UABaseDataVariable } from "./ua_base_data_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |SerializationEntityType i=19824                             |
 * |isAbstract      |false                                                       |
 */
export interface UASerializationEntity_Base {
    serializedData: UABaseDataVariable<DTStructure, DataType.ExtensionObject>;
    includeReferenceTypes?: UAProperty<NodeId[], DataType.NodeId>;
    excludeReferenceTypes?: UAProperty<NodeId[], DataType.NodeId>;
    serializationDepth?: UAProperty<UInt16, DataType.UInt16>;
    considerSubElementSerializationProperties?: UAProperty<boolean, DataType.Boolean>;
    customMetaDataProperties?: UAProperty<DTKeyValuePair[], DataType.ExtensionObject>;
    customMetaDataRef?: UAProperty<NodeId, DataType.NodeId>;
    includeStatus?: UAProperty<boolean, DataType.Boolean>;
    includeSourceTimestamp?: UAProperty<boolean, DataType.Boolean>;
    includeDictionaryReference?: UAProperty<boolean, DataType.Boolean>;
    configureSerialization?: UAMethod;
}
export interface UASerializationEntity extends UAObject, UASerializationEntity_Base {
}