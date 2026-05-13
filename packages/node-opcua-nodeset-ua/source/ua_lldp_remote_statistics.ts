import type { UAObject } from "node-opcua-address-space-base";
import type { UInt32 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UABaseDataVariable } from "./ua_base_data_variable";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |LldpRemoteStatisticsType i=18996                            |
 * |isAbstract      |false                                                       |
 */
export interface UALldpRemoteStatistics_Base {
    lastChangeTime: UABaseDataVariable<UInt32, DataType.UInt32>;
    remoteInserts: UABaseDataVariable<UInt32, DataType.UInt32>;
    remoteDeletes: UABaseDataVariable<UInt32, DataType.UInt32>;
    remoteDrops: UABaseDataVariable<UInt32, DataType.UInt32>;
    remoteAgeouts: UABaseDataVariable<UInt32, DataType.UInt32>;
}
export interface UALldpRemoteStatistics extends UAObject, UALldpRemoteStatistics_Base {}