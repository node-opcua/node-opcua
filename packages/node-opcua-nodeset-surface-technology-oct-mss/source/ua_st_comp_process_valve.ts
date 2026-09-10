import type { UAProperty } from "node-opcua-address-space-base";
import type { UInt16 } from "node-opcua-basic-types";
import type { UAMachineryLifetimeCounter } from "node-opcua-nodeset-machinery/dist/ua_machinery_lifetime_counter.js";
import type { UAMachineryOperationCounter } from "node-opcua-nodeset-machinery/dist/ua_machinery_operation_counter.js";
import type { UAMonitoring } from "node-opcua-nodeset-machinery/dist/ua_monitoring.js";
import type { UASTComp, UASTComp_Base, UASTComp_machineryBuildingBlocks } from "node-opcua-nodeset-surface-technology-general-types/dist/ua_st_comp.js";
import type { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit.js";
import type { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder.js";
import type { UAMultiStateValueDiscrete } from "node-opcua-nodeset-ua/dist/ua_multi_state_value_discrete.js";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

export interface UASTCompProcessValve_$description extends UAFolder { // Object
      closingTime?: UAProperty<number, DataType.Double>;
      flowCrossSection?: UAAnalogUnit<number, DataType.Double>;
      flowVolumeMax?: UAAnalogUnit<number, DataType.Double>;
      lifetimeCycles?: UAProperty<UInt16, DataType.UInt16>;
      materialPressureMax?: UAAnalogUnit<number, DataType.Double>;
      minimumPulseCloseTime?: UAProperty<number, DataType.Double>;
      minimumPulseOpenTime?: UAProperty<number, DataType.Double>;
      openingTime?: UAProperty<number, DataType.Double>;
      travel?: UAAnalogUnit<number, DataType.Double>;
      typeOfActuationEnergy?: UAMultiStateValueDiscrete<UInt16, DataType.UInt16>;
}
export interface UASTCompProcessValve_machineryBuildingBlocks extends UASTComp_machineryBuildingBlocks { // Object
      lifetimeCounters?: UAMachineryLifetimeCounter;
      operationCounters?: UAMachineryOperationCounter;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/SurfaceTechnology/OCT-MSS/      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |STCompProcessValveType i=1012                               |
 * |isAbstract      |false                                                       |
 */
export interface UASTCompProcessValve_Base extends UASTComp_Base {
    "$description"?: UASTCompProcessValve_$description;
    machineryBuildingBlocks: UASTCompProcessValve_machineryBuildingBlocks;
    monitoring?: UAMonitoring;
}
export interface UASTCompProcessValve extends Omit<UASTComp, "$description"|"machineryBuildingBlocks"|"monitoring">, UASTCompProcessValve_Base {}