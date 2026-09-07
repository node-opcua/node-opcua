import type { UInt16 } from "node-opcua-basic-types";
import type { UAMonitoring } from "node-opcua-nodeset-machinery/dist/ua_monitoring";
import type { UASTComp, UASTComp_Base } from "node-opcua-nodeset-surface-technology-general-types/dist/ua_st_comp";
import type { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder";
import type { UAMultiStateValueDiscrete } from "node-opcua-nodeset-ua/dist/ua_multi_state_value_discrete";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

export interface UASTCompHeater_$description extends UAFolder { // Object
      typeOfDevice: UAMultiStateValueDiscrete<UInt16, DataType.UInt16>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/SurfaceTechnology/OCT-MSS/      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |STCompHeaterType i=1013                                     |
 * |isAbstract      |false                                                       |
 */
export interface UASTCompHeater_Base extends UASTComp_Base {
    "$description"?: UASTCompHeater_$description;
    monitoring?: UAMonitoring;
}
export interface UASTCompHeater extends Omit<UASTComp, "$description"|"monitoring">, UASTCompHeater_Base {}