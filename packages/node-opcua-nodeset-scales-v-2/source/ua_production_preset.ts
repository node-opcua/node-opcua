// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder"
/**
 * Provides methods to manage the Production preset.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ProductionPresetType i=14                                   |
 * |isAbstract      |false                                                       |
 */
export interface UAProductionPreset_Base {
    addProduct?: UAMethod;
    currentProducts?: UABaseDataVariable<UAString[], DataType.String>;
    deselectProduct?: UAMethod;
    /**
     * products
     * The products used in the scale aggregated in the
     * Products Object.
     */
    products?: UAFolder;
    removeProduct?: UAMethod;
    selectProduct?: UAMethod;
    switchProduct?: UAMethod;
}
export interface UAProductionPreset extends UAObject, UAProductionPreset_Base {
}