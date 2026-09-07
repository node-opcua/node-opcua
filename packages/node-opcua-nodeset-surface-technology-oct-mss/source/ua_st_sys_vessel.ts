import type { UAMachineComponents } from "node-opcua-nodeset-machinery/dist/ua_machine_components";
import type { UAMonitoring } from "node-opcua-nodeset-machinery/dist/ua_monitoring";
import type { UASTSys, UASTSys_Base } from "node-opcua-nodeset-surface-technology-general-types/dist/ua_st_sys";
import type { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit";
import type { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

export interface UASTSysVessel_$description extends UAFolder { // Object
      vesselVolume?: UAAnalogUnit<number, DataType.Double>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/SurfaceTechnology/OCT-MSS/      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |STSysVesselType i=1005                                      |
 * |isAbstract      |false                                                       |
 */
export interface UASTSysVessel_Base extends UASTSys_Base {
    components?: UAMachineComponents;
    "$description"?: UASTSysVessel_$description;
    monitoring?: UAMonitoring;
}
export interface UASTSysVessel extends Omit<UASTSys, "components"|"$description"|"monitoring">, UASTSysVessel_Base {}