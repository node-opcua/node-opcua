// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAFolder } from "./ua_folder"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |HistoricalEventConfigurationType i=32621                    |
 * |isAbstract      |false                                                       |
 */
export interface UAHistoricalEventConfiguration_Base {
    eventTypes: UAFolder;
    startOfArchive?: UAProperty<Date, DataType.DateTime>;
    startOfOnlineArchive?: UAProperty<Date, DataType.DateTime>;
}
export interface UAHistoricalEventConfiguration extends UAObject, UAHistoricalEventConfiguration_Base {
}