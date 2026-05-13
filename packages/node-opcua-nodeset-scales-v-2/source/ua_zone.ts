import type { UAObject } from "node-opcua-address-space-base";
import type { LocalizedText } from "node-opcua-data-model";
import type { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

import type { UAStatisticCounter } from "./ua_statistic_counter";

// ----- this file has been automatically generated - do not edit

/**
 * Container for the weighing zones in a
 * Checkweigher.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ZoneType i=42                                               |
 * |isAbstract      |false                                                       |
 */
export interface UAZone_Base {
    /**
     * lowerLimit
     * Defines the lower weight limit of this zone. The
     * lower limit is prior to the upper limit if two
     * zones are beside each other.
     */
    lowerLimit: UAAnalogUnit<any, any>;
    /**
     * name
     * Defines the user-readable name of the zone.
     */
    name: UABaseDataVariable<LocalizedText, DataType.LocalizedText>;
    /**
     * upperLimit
     * Defines the upper weight limit of this zone.
     */
    upperLimit: UAAnalogUnit<any, any>;
    /**
     * zoneStatistic
     * Contains statistics regarding this zone.
     */
    zoneStatistic?: UAStatisticCounter;
}
export interface UAZone extends UAObject, UAZone_Base {}