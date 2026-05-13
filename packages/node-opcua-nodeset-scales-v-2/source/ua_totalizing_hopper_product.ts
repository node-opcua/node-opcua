import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";

import type { UAProduct, UAProduct_Base } from "./ua_product";
import type { UATargetItem } from "./ua_target_item";

// ----- this file has been automatically generated - do not edit

/**
 * Represents a product of a totalizing hopper scale.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |TotalizingHopperProductType i=22                            |
 * |isAbstract      |false                                                       |
 */
export interface UATotalizingHopperProduct_Base extends UAProduct_Base {
    /**
     * tipCounter
     * Defines the number of fillings (downpour, bulk
     * produce)
     */
    tipCounter: UABaseDataVariable<any, any>;
    /**
     * volumeTargetValue
     * Defines the preset of the volume to be processed.
     */
    volumeTargetValue?: UATargetItem<any, any>;
}
export interface UATotalizingHopperProduct extends UAProduct, UATotalizingHopperProduct_Base {}