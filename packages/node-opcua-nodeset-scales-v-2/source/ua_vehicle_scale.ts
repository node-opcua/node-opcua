import type { UAMethod } from "node-opcua-address-space-base";

import type { UAProductionPreset } from "./ua_production_preset";
import type { UAScaleDevice, UAScaleDevice_Base } from "./ua_scale_device";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |VehicleScaleType i=834                                      |
 * |isAbstract      |false                                                       |
 */
export interface UAVehicleScale_Base extends UAScaleDevice_Base {
    inboundWeighing?: UAMethod;
    onePassWeighing?: UAMethod;
    outboundWeighing?: UAMethod;
    /**
     * productionPreset
     * Contains the productions presets.
     */
    productionPreset?: UAProductionPreset;
}
export interface UAVehicleScale extends Omit<UAScaleDevice, "productionPreset">, UAVehicleScale_Base {}