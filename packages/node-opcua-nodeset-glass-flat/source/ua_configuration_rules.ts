// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { DTFileFormat } from "./dt_file_format"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/           |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |13:ConfigurationRulesType ns=13;i=1063            |
 * |isAbstract      |false                                             |
 */
export interface UAConfigurationRules_Base {
    allowedEngineeringUnits?: UAProperty<EUInformation[], /*z*/DataType.ExtensionObject>;
    allowedFileFormats?: UAProperty<DTFileFormat[], /*z*/DataType.ExtensionObject>;
    machineProcessingCoordinateSystem: UAProperty<any, any>;
}
export interface UAConfigurationRules extends UAObject, UAConfigurationRules_Base {
}