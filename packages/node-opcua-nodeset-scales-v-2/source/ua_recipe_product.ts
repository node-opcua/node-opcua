import type { NodeId } from "node-opcua-nodeid";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { UAFile } from "node-opcua-nodeset-ua/dist/ua_file";
import type { DataType } from "node-opcua-variant";

import type { DTRecipeReportElement } from "./dt_recipe_report_element";
import type { UAProduct, UAProduct_Base } from "./ua_product";

// ----- this file has been automatically generated - do not edit

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
export interface UARecipeProduct extends UAProduct, UARecipeProduct_Base {}