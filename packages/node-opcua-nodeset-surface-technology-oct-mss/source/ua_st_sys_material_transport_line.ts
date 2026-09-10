import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { UAMachineryLifetimeCounter } from "node-opcua-nodeset-machinery/dist/ua_machinery_lifetime_counter.js";
import type { UAMonitoring } from "node-opcua-nodeset-machinery/dist/ua_monitoring.js";
import type { UASTSys, UASTSys_Base, UASTSys_machineryBuildingBlocks } from "node-opcua-nodeset-surface-technology-general-types/dist/ua_st_sys.js";
import type { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit.js";
import type { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder.js";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

export interface UASTSysMaterialTransportLine_$description extends UAFolder { // Object
      compressiveStrength?: UAAnalogUnit<number, DataType.Double>;
      contactMaterial?: UAProperty<UAString, DataType.String>;
      crossSection?: UAAnalogUnit<number, DataType.Double>;
      flowResistanceCoefficient?: UAAnalogUnit<number, DataType.Double>;
      "$length"?: UAAnalogUnit<number, DataType.Double>;
      pressureLossCoefficient?: UAAnalogUnit<number, DataType.Double>;
}
export interface UASTSysMaterialTransportLine_machineryBuildingBlocks extends UASTSys_machineryBuildingBlocks { // Object
      lifetimeCounters?: UAMachineryLifetimeCounter;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/SurfaceTechnology/OCT-MSS/      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |STSysMaterialTransportLineType i=1003                       |
 * |isAbstract      |false                                                       |
 */
export interface UASTSysMaterialTransportLine_Base extends UASTSys_Base {
    "$description"?: UASTSysMaterialTransportLine_$description;
    machineryBuildingBlocks: UASTSysMaterialTransportLine_machineryBuildingBlocks;
    monitoring?: UAMonitoring;
}
export interface UASTSysMaterialTransportLine extends Omit<UASTSys, "$description"|"machineryBuildingBlocks"|"monitoring">, UASTSysMaterialTransportLine_Base {}