import type { UAFunctionalGroup } from "node-opcua-nodeset-di/dist/ua_functional_group";
import type { UADiscreteItem } from "node-opcua-nodeset-ua/dist/ua_discrete_item";

import type { UABaseSensorFunction, UABaseSensorFunction_Base } from "./ua_base_sensor_function";

// ----- this file has been automatically generated - do not edit

export interface UADiscreteSensorFunction_operational extends UAFunctionalGroup { // Object
      /**
       * sensorValue
       * SensorValue is a discrete measurement value.
       */
      sensorValue: UADiscreteItem<any, any>;
}
/**
 * The DiscreteSensorFunctionType is an abstract
 * ObjectType used as a base for derivation of
 * sensors with discrete signals.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |DiscreteSensorFunctionType i=1012                           |
 * |isAbstract      |true                                                        |
 */
export interface UADiscreteSensorFunction_Base extends UABaseSensorFunction_Base {
    /**
     * sensorValue
     * SensorValue is a discrete measurement value.
     */
    sensorValue: UADiscreteItem<any, any>;
    /**
     * operational
     * Used to organize parameters for operation of this
     * function.
     */
    operational: UADiscreteSensorFunction_operational;
}
export interface UADiscreteSensorFunction extends UABaseSensorFunction, UADiscreteSensorFunction_Base {}