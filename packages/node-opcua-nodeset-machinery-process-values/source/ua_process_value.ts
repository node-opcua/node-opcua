// ----- this file has been automatically generated - do not edit
import { UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType, VariantOptions } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { EUInformation } from "node-opcua-data-access"
import { NodeId } from "node-opcua-nodeid"
import { StatusCode } from "node-opcua-status-code"
import { UInt32, UInt16, Int16, UAString } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { DTEnumValue } from "node-opcua-nodeset-ua/source/dt_enum_value"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/source/ua_analog_unit"
import { UAAnalogUnitRange } from "node-opcua-nodeset-ua/source/ua_analog_unit_range"
import { UAMultiStateValueDiscrete } from "node-opcua-nodeset-ua/source/ua_multi_state_value_discrete"
import { UAExclusiveDeviationAlarm } from "node-opcua-nodeset-ua/source/ua_exclusive_deviation_alarm"
import { UAExclusiveLimitAlarm } from "node-opcua-nodeset-ua/source/ua_exclusive_limit_alarm"
import { UAAnalogSignalVariable } from "node-opcua-nodeset-padim/source/ua_analog_signal_variable"
import { UAAnalogSignal, UAAnalogSignal_Base } from "node-opcua-nodeset-padim/source/ua_analog_signal"
import { UAProcessValueSetpointVariable } from "./ua_process_value_setpoint_variable"
export interface UAProcessValue_analogSignal<T, DT extends DataType> extends Omit<UAAnalogSignalVariable<T, DT>, "engineeringUnits"|"euRange"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      euRange: UAProperty<DTRange, DataType.ExtensionObject>;
      /**
       * highHighLimit
       * Defines the absolute high high limit
       */
      highHighLimit?: UAAnalogUnit<any, any>;
      /**
       * highLimit
       * Defines the absolute high limit
       */
      highLimit?: UAAnalogUnit<any, any>;
      /**
       * lowLimit
       * Defines the absolute low limit
       */
      lowLimit?: UAAnalogUnit<any, any>;
      /**
       * lowLowLimit
       * Defines the absolute low low limit
       */
      lowLowLimit?: UAAnalogUnit<any, any>;
      /**
       * percentageValue
       * Provides the process value in percentage.
       */
      percentageValue?: UAAnalogUnitRange<number, DataType.Double>;
}
/**
 * Represents a process value
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Machinery/ProcessValues/        |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ProcessValueType i=1003                                     |
 * |isAbstract      |false                                                       |
 */
export interface UAProcessValue_Base extends UAAnalogSignal_Base {
    /**
     * alarmSuppression
     * Indicates if alarms based on the Status shall be
     * suppressed.
     */
    alarmSuppression?: UAMultiStateValueDiscrete<UInt16, DataType.UInt16>;
    /**
     * analogSignal
     * The process value.
     */
    analogSignal: UAProcessValue_analogSignal<any, any>;
    /**
     * deviationAlarm
     * Becomes active, when the process values derivates
     * from the ProcessValueSetpoint.
     */
    deviationAlarm?: UAExclusiveDeviationAlarm;
    /**
     * limitAlarm
     * Becomes active, when absolute limits are reached.
     */
    limitAlarm?: UAExclusiveLimitAlarm;
    /**
     * processValueSetpoint
     * The desired value, may or may not be controlled
     * by the server.
     */
    processValueSetpoint?: UAProcessValueSetpointVariable<any, any>;
    /**
     * status
     * Indicates if a limit has been reached.
     */
    status?: UAMultiStateValueDiscrete<UInt16, DataType.UInt16>;
    zeroPointAdjustment?: UAMethod;
}
export interface UAProcessValue extends Omit<UAAnalogSignal, "analogSignal"|"zeroPointAdjustment">, UAProcessValue_Base {
}