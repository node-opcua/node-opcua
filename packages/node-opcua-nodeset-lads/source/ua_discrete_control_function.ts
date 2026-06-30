import type { UADiscreteItem } from "node-opcua-nodeset-ua/dist/ua_discrete_item";

import type { UABaseControlFunction, UABaseControlFunction_Base } from "./ua_base_control_function";

// ----- this file has been automatically generated - do not edit

/**
 * The DiscreteControlFunctionType describes an
 * abstract discrete control function (using
 * discrete values). More specialized discrete
 * control functions can be derived from this
 * ObjectType.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |DiscreteControlFunctionType i=1017                          |
 * |isAbstract      |true                                                        |
 */
export interface UADiscreteControlFunction_Base extends UABaseControlFunction_Base {
    /**
     * currentValue
     * CurrentValue is a current discrete process value.
     */
    currentValue: UADiscreteItem<any, any>;
    /**
     * targetValue
     * TargetValue is the targeted discrete set-point
     * value.
     */
    targetValue: UADiscreteItem<any, any>;
}
export interface UADiscreteControlFunction extends UABaseControlFunction, UADiscreteControlFunction_Base {}