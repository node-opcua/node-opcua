import type { UAObject } from "node-opcua-address-space-base";
import type { UAAnalogItem } from "node-opcua-nodeset-ua/dist/ua_analog_item";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

import type { EnumLevelDisplayMode } from "./enum_level_display_mode";

// ----- this file has been automatically generated - do not edit

/**
 * Contains information relevant to a stacklight
 * operating as a level meter. The whole stack is
 * controlled by a percentual value.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IA/                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |StackLevelType i=1003                                       |
 * |isAbstract      |false                                                       |
 */
export interface UAStackLevel_Base {
    /**
     * displayMode
     * Indicates in what way the percentual value is
     * displayed with the stacklight.
     */
    displayMode: UABaseDataVariable<EnumLevelDisplayMode, DataType.Int32>;
    /**
     * levelPercent
     * Shows the percentual value the stacklight is
     * representing. The mandatory EURange Property of
     * the Variable indicates the lowest and highest
     * value and thereby allows to calculate the
     * percentage represented by the value. The lowest
     * value is interpreted as 0 percent, the highest is
     * interpreted as 100 percent.
     */
    levelPercent: UAAnalogItem<number, DataType.Float>;
}
export interface UAStackLevel extends UAObject, UAStackLevel_Base {}