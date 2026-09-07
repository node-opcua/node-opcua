import type { UInt16 } from "node-opcua-basic-types";
import type { UAMachineryLifetimeCounter } from "node-opcua-nodeset-machinery/dist/ua_machinery_lifetime_counter";
import type { UAMonitoring } from "node-opcua-nodeset-machinery/dist/ua_monitoring";
import type { UASTComp, UASTComp_Base, UASTComp_machineryBuildingBlocks } from "node-opcua-nodeset-surface-technology-general-types/dist/ua_st_comp";
import type { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit";
import type { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder";
import type { UAMultiStateValueDiscrete } from "node-opcua-nodeset-ua/dist/ua_multi_state_value_discrete";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

export interface UASTCompRam_$description extends UAFolder { // Object
      drumInnerDiameter?: UAAnalogUnit<number, DataType.Double>;
      drumVolumeClass?: UAMultiStateValueDiscrete<UInt16, DataType.UInt16>;
      typeOfRam?: UAMultiStateValueDiscrete<UInt16, DataType.UInt16>;
}
export interface UASTCompRam_machineryBuildingBlocks extends UASTComp_machineryBuildingBlocks { // Object
      lifetimeCounters?: UAMachineryLifetimeCounter;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/SurfaceTechnology/OCT-MSS/      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |STCompRamType i=1009                                        |
 * |isAbstract      |false                                                       |
 */
export interface UASTCompRam_Base extends UASTComp_Base {
    "$description"?: UASTCompRam_$description;
    machineryBuildingBlocks: UASTCompRam_machineryBuildingBlocks;
    monitoring?: UAMonitoring;
}
export interface UASTCompRam extends Omit<UASTComp, "$description"|"machineryBuildingBlocks"|"monitoring">, UASTCompRam_Base {}