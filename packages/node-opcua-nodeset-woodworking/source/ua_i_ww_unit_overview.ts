// ----- this file has been automatically generated - do not edit
import { DataType, Variant } from "node-opcua-variant"
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/source/ua_base_interface"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
/**
 * The IWwUnitOverviewType represents the
 * generalized state of a unit
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Woodworking/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |12:IWwUnitOverviewType ns=12;i=5                  |
 * |isAbstract      |true                                              |
 */
export interface UAIWwUnitOverview_Base extends UABaseInterface_Base {
    /**
     * currentMode
     * The CurrentMode Variable provides the generalized
     * mode of the component.
     */
    currentMode: UABaseDataVariable<any, any>;
    /**
     * currentState
     * The CurrentState Variable provides the
     * generalized state of the component.
     */
    currentState: UABaseDataVariable<any, any>;
}
export interface UAIWwUnitOverview extends UABaseInterface, UAIWwUnitOverview_Base {
}