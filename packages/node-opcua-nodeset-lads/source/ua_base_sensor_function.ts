import type { UAProperty } from "node-opcua-address-space-base";
import type { UAFunctionalGroup } from "node-opcua-nodeset-di/dist/ua_functional_group";
import type { DataType } from "node-opcua-variant";

import type { UAFunction, UAFunction_Base } from "./ua_function";

// ----- this file has been automatically generated - do not edit

export interface UABaseSensorFunction_configuration extends UAFunctionalGroup { // Object
      /**
       * isEnabled
       * Determnes whteher this function is currently
       * enabled (ready to be utilized).
       */
      isEnabled?: UAProperty<boolean, DataType.Boolean>;
}
/**
 * The BaseSensorFunctionType is an abstract
 * ObjectType used as a base for derivation of
 * Sensor Functions. A Sensor Function is a Function
 * that measures data.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |BaseSensorFunctionType i=1005                               |
 * |isAbstract      |true                                                        |
 */
export interface UABaseSensorFunction_Base extends UAFunction_Base {
    /**
     * configuration
     * Configuration is used to organize parameters for
     * configuration of the Function.
     */
    configuration?: UABaseSensorFunction_configuration;
}
export interface UABaseSensorFunction extends Omit<UAFunction, "configuration">, UABaseSensorFunction_Base {}