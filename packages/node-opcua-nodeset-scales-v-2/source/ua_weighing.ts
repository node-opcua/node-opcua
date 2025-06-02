// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { UARecipeElement, UARecipeElement_Base } from "./ua_recipe_element"
import { UAMaterial } from "./ua_material"
import { UATargetItem } from "./ua_target_item"
/**
 * Represents a weighing process in a recipe. The
 * process can be an automatic or manual filling
 * process.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |WeighingType i=34                                           |
 * |isAbstract      |false                                                       |
 */
export interface UAWeighing_Base extends UARecipeElement_Base {
    /**
     * material
     * Defines the material which needs to be measured.
     * Each material has different characteristics that
     * are defined in MaterialType.
     */
    material?: UAMaterial;
    /**
     * targetWeight
     * Defines the preset of the volume to be processed.
     */
    targetWeight: UATargetItem<any, any>;
    /**
     * weighingModuleNodeId
     * Defines the Id of the load cell which is used for
     * weighing the product.
     */
    weighingModuleNodeId: UABaseDataVariable<NodeId, DataType.NodeId>;
}
export interface UAWeighing extends UARecipeElement, UAWeighing_Base {
}