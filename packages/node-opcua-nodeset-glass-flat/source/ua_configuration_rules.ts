import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { EUInformation } from "node-opcua-data-access";
import type { DataType } from "node-opcua-variant";

import type { DTFileFormat } from "./dt_file_format";
import type { EnumCoordinateSystem } from "./enum_coordinate_system";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/                     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ConfigurationRulesType i=1063                               |
 * |isAbstract      |false                                                       |
 */
export interface UAConfigurationRules_Base {
    allowedEngineeringUnits?: UAProperty<EUInformation[], DataType.ExtensionObject>;
    allowedFileFormats?: UAProperty<DTFileFormat[], DataType.ExtensionObject>;
    machineProcessingCoordinateSystem: UAProperty<EnumCoordinateSystem, DataType.Int32>;
}
export interface UAConfigurationRules extends UAObject, UAConfigurationRules_Base {}