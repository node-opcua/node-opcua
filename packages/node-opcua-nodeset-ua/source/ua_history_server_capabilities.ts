// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UAFolder } from "./ua_folder"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |HistoryServerCapabilitiesType ns=0;i=2330         |
 * |isAbstract      |false                                             |
 */
export interface UAHistoryServerCapabilities_Base {
    accessHistoryDataCapability: UAProperty<boolean, DataType.Boolean>;
    accessHistoryEventsCapability: UAProperty<boolean, DataType.Boolean>;
    maxReturnDataValues: UAProperty<UInt32, DataType.UInt32>;
    maxReturnEventValues: UAProperty<UInt32, DataType.UInt32>;
    insertDataCapability: UAProperty<boolean, DataType.Boolean>;
    replaceDataCapability: UAProperty<boolean, DataType.Boolean>;
    updateDataCapability: UAProperty<boolean, DataType.Boolean>;
    deleteRawCapability: UAProperty<boolean, DataType.Boolean>;
    deleteAtTimeCapability: UAProperty<boolean, DataType.Boolean>;
    insertEventCapability: UAProperty<boolean, DataType.Boolean>;
    replaceEventCapability: UAProperty<boolean, DataType.Boolean>;
    updateEventCapability: UAProperty<boolean, DataType.Boolean>;
    deleteEventCapability: UAProperty<boolean, DataType.Boolean>;
    insertAnnotationCapability: UAProperty<boolean, DataType.Boolean>;
    aggregateFunctions: UAFolder;
    serverTimestampSupported: UAProperty<boolean, DataType.Boolean>;
}
export interface UAHistoryServerCapabilities extends UAObject, UAHistoryServerCapabilities_Base {
}