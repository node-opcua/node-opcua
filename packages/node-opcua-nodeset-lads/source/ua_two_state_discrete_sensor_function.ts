import type { UADiscreteItem } from "node-opcua-nodeset-ua/dist/ua_discrete_item";
import type { DataType } from "node-opcua-variant";

import type { UADiscreteSensorFunction, UADiscreteSensorFunction_Base } from "./ua_discrete_sensor_function";

// ----- this file has been automatically generated - do not edit

/**
 * The TwoStateDiscreteSensorFunctionType represents
 * a Boolean value that is measured by a Sensor.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |TwoStateDiscreteSensorFunctionType i=1031                   |
 * |isAbstract      |false                                                       |
 */
export interface UATwoStateDiscreteSensorFunction_Base extends UADiscreteSensorFunction_Base {
    /**
     * sensorValue
     * Boolean sensor value.
     */
    sensorValue: UADiscreteItem<boolean, DataType.Boolean>;
}
export interface UATwoStateDiscreteSensorFunction extends Omit<UADiscreteSensorFunction, "sensorValue">, UATwoStateDiscreteSensorFunction_Base {}