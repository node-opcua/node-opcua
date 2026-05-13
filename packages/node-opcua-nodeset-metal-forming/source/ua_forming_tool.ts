import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString, UInt16 } from "node-opcua-basic-types";
import type { UABaseTool, UABaseTool_Base, UABaseTool_location } from "node-opcua-nodeset-machine-tool/dist/ua_base_tool";
import type { UAAnalogUnitRange } from "node-opcua-nodeset-ua/dist/ua_analog_unit_range";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

export interface UAFormingTool_location extends UABaseTool_location { // Object
      name: UAProperty<UAString, DataType.String>;
      orientation?: UAProperty<UAString, DataType.String>;
      placeNumber: UAProperty<UInt16, DataType.UInt16>;
      position?: UAAnalogUnitRange<number, DataType.Double>;
      stage?: UAProperty<UInt16, DataType.UInt16>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MetalForming/                   |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |FormingToolType i=1010                                      |
 * |isAbstract      |false                                                       |
 */
export interface UAFormingTool_Base extends UABaseTool_Base {
    location?: UAFormingTool_location;
}
export interface UAFormingTool extends Omit<UABaseTool, "location">, UAFormingTool_Base {}