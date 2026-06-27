import type { UInt32 } from "node-opcua-basic-types";
import type { UADiscreteItem } from "node-opcua-nodeset-ua/dist/ua_discrete_item";
import type { DataType } from "node-opcua-variant";

import type { UADiscreteSensorFunction, UADiscreteSensorFunction_Base } from "./ua_discrete_sensor_function";

// ----- this file has been automatically generated - do not edit

/**
 * The MultiStateDiscreteSensorFunctionType
 * represents a value that is measured by a Sensor
 * and can only be set to a discrete set of values.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |MultiStateDiscreteSensorFunctionType i=1037                 |
 * |isAbstract      |false                                                       |
 */
export interface UAMultiStateDiscreteSensorFunction_Base extends UADiscreteSensorFunction_Base {
    /**
     * sensorValue
     * Discrete sensor value.
     */
    sensorValue: UADiscreteItem<UInt32, DataType.UInt32>;
}
export interface UAMultiStateDiscreteSensorFunction extends Omit<UADiscreteSensorFunction, "sensorValue">, UAMultiStateDiscreteSensorFunction_Base {}