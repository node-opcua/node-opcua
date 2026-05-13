import type { UAMethod, UAProperty } from "node-opcua-address-space-base";
import type { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit";
import type { DataType } from "node-opcua-variant";

import type { UAContinuousScale, UAContinuousScale_Base } from "./ua_continuous_scale";
import type { UAMeasuredItem } from "./ua_measured_item";

// ----- this file has been automatically generated - do not edit

/**
 * Represents a loss in weight scale.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |LossInWeightScaleType i=50                                  |
 * |isAbstract      |false                                                       |
 */
export interface UALossInWeightScale_Base extends UAContinuousScale_Base {
    binWeight?: UAMeasuredItem<any, any>;
    dischargeStart: UAMethod;
    dischargeStop: UAMethod;
    /**
     * discharging
     * Indicates that a discharging process is taking
     * place.
     */
    discharging: UAProperty<boolean, DataType.Boolean>;
    hopperFillLevel: UAAnalogUnit<any, any>;
    hopperWeight: UAMeasuredItem<any, any>;
    refilling: UAProperty<boolean, DataType.Boolean>;
    refillStart: UAMethod;
    refillStop: UAMethod;
}
export interface UALossInWeightScale extends UAContinuousScale, UALossInWeightScale_Base {}