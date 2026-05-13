import type { UAMethod, UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UInt16 } from "node-opcua-basic-types";
import type { NodeId } from "node-opcua-nodeid";
import type { DataType } from "node-opcua-variant";

import type { DTKeyValuePair } from "./dt_key_value_pair";
import type { DTStructure } from "./dt_structure";
import type { UABaseDataVariable } from "./ua_base_data_variable";

// ----- this file has been automatically generated - do not edit

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
export interface UASerializationEntity extends UAObject, UASerializationEntity_Base {}