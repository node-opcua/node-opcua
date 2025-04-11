// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt16, UAString } from "node-opcua-basic-types"
import { UAAnalogUnitRange } from "node-opcua-nodeset-ua/dist/ua_analog_unit_range"
import { UABaseTool_location, UABaseTool, UABaseTool_Base } from "node-opcua-nodeset-machine-tool/dist/ua_base_tool"
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
export interface UAFormingTool extends Omit<UABaseTool, "location">, UAFormingTool_Base {
}