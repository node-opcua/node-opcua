import type { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit";

import type { UAProduct, UAProduct_Base } from "./ua_product";
import type { UATargetItem } from "./ua_target_item";

// ----- this file has been automatically generated - do not edit

/**
 * Represents a product of a continuous scale.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ContinuousProductType i=18                                  |
 * |isAbstract      |false                                                       |
 */
export interface UAContinuousProduct_Base extends UAProduct_Base {
    /**
     * materialDensity
     * Defines the density of the used material.
     */
    materialDensity?: UAAnalogUnit<any, any>;
    /**
     * targetFlowRate
     * Defines a preset of flowrate that needs to be
     * conveyed. This value defines the setpoint for the
     * FlowRate control loop.
     */
    targetFlowRate?: UATargetItem<any, any>;
    /**
     * targetWeight
     * Defines a preset of the volume to be processed.
     */
    targetWeight?: UATargetItem<any, any>;
}
export interface UAContinuousProduct extends UAProduct, UAContinuousProduct_Base {}