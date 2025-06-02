// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { UAFile } from "node-opcua-nodeset-ua/dist/ua_file"
import { DTRecipeReportElement } from "./dt_recipe_report_element"
import { UAProduct, UAProduct_Base } from "./ua_product"
/**
 * Represents a product of a recipe scale.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |RecipeProductType i=19                                      |
 * |isAbstract      |false                                                       |
 */
export interface UARecipeProduct_Base extends UAProduct_Base {
    /**
     * recipeNodeId
     * Defines the NodeId of the recipe that is being
     * produced.
     */
    recipeNodeId: UABaseDataVariable<NodeId, DataType.NodeId>;
    /**
     * report
     * Defines an array with the various messages from
     * the recipe. Each RecipeElement generates its own
     * report message.
     */
    report: UABaseDataVariable<DTRecipeReportElement[], DataType.ExtensionObject>;
    /**
     * reportFile
     * Defines the file (binary, xml or other) that
     * contains the report of the current process.
     */
    reportFile?: UAFile;
}
export interface UARecipeProduct extends UAProduct, UARecipeProduct_Base {
}