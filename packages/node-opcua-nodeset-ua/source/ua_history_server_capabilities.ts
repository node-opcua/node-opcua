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
    accessHistoryDataCapability: UAProperty<boolean, /*z*/DataType.Boolean>;
    accessHistoryEventsCapability: UAProperty<boolean, /*z*/DataType.Boolean>;
    maxReturnDataValues: UAProperty<UInt32, /*z*/DataType.UInt32>;
    maxReturnEventValues: UAProperty<UInt32, /*z*/DataType.UInt32>;
    insertDataCapability: UAProperty<boolean, /*z*/DataType.Boolean>;
    replaceDataCapability: UAProperty<boolean, /*z*/DataType.Boolean>;
    updateDataCapability: UAProperty<boolean, /*z*/DataType.Boolean>;
    deleteRawCapability: UAProperty<boolean, /*z*/DataType.Boolean>;
    deleteAtTimeCapability: UAProperty<boolean, /*z*/DataType.Boolean>;
    insertEventCapability: UAProperty<boolean, /*z*/DataType.Boolean>;
    replaceEventCapability: UAProperty<boolean, /*z*/DataType.Boolean>;
    updateEventCapability: UAProperty<boolean, /*z*/DataType.Boolean>;
    deleteEventCapability: UAProperty<boolean, /*z*/DataType.Boolean>;
    insertAnnotationCapability: UAProperty<boolean, /*z*/DataType.Boolean>;
    aggregateFunctions: UAFolder;
    serverTimestampSupported: UAProperty<boolean, /*z*/DataType.Boolean>;
}
export interface UAHistoryServerCapabilities extends UAObject, UAHistoryServerCapabilities_Base {
}