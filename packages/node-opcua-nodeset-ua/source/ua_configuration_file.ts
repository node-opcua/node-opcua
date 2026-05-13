import type { UAMethod, UAProperty } from "node-opcua-address-space-base";
import type { UInt32 } from "node-opcua-basic-types";
import type { NodeId } from "node-opcua-nodeid";
import type { DataType } from "node-opcua-variant";

import type { UAFile, UAFile_Base } from "./ua_file";

// ----- this file has been automatically generated - do not edit

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
export interface UAConfigurationFile extends UAFile, UAConfigurationFile_Base {}