// ----- this file has been automatically generated - do not edit
import { UAMaterial, UAMaterial_Base } from "./ua_material"
import { UAAutomaticFillingProduct } from "./ua_automatic_filling_product"
/**
 * Represents a material in a recipe that will be
 * filled automatically.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |MaterialAutomaticType i=41                                  |
 * |isAbstract      |false                                                       |
 */
export interface UAMaterialAutomatic_Base extends UAMaterial_Base {
    /**
     * fillingProductInformation
     * Defines the parameters necessary for filling of
     * the material.
     */
    fillingProductInformation: UAAutomaticFillingProduct;
}
export interface UAMaterialAutomatic extends UAMaterial, UAMaterialAutomatic_Base {
}