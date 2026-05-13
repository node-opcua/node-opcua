import type { UAMethod, UAObject } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

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
export interface UAProductionPreset extends UAObject, UAProductionPreset_Base {}