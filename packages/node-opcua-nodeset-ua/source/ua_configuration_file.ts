// ----- this file has been automatically generated - do not edit
import { UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UInt32 } from "node-opcua-basic-types"
import { UAFile, UAFile_Base } from "./ua_file"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ConfigurationFileType i=15437                               |
 * |isAbstract      |false                                                       |
 */
export interface UAConfigurationFile_Base extends UAFile_Base {
    lastUpdateTime: UAProperty<Date, DataType.DateTime>;
    currentVersion: UAProperty<UInt32, DataType.UInt32>;
    activityTimeout: UAProperty<number, DataType.Double>;
    supportedDataType: UAProperty<NodeId, DataType.NodeId>;
    confirmUpdate: UAMethod;
    closeAndUpdate: UAMethod;
}
export interface UAConfigurationFile extends UAFile, UAConfigurationFile_Base {
}