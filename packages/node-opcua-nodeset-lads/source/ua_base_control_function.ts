import type { UAMethod, UAProperty } from "node-opcua-address-space-base";
import type { UAString, UInt16 } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { NodeId } from "node-opcua-nodeid";
import type { UAFunctionalGroup } from "node-opcua-nodeset-di/dist/ua_functional_group";
import type { UAConditionVariable } from "node-opcua-nodeset-ua/dist/ua_condition_variable";
import type { UAExclusiveDeviationAlarm } from "node-opcua-nodeset-ua/dist/ua_exclusive_deviation_alarm";
import type { UAExclusiveLimitStateMachine } from "node-opcua-nodeset-ua/dist/ua_exclusive_limit_state_machine";
import type { UAFiniteStateVariable } from "node-opcua-nodeset-ua/dist/ua_finite_state_variable";
import type { UATwoStateVariable } from "node-opcua-nodeset-ua/dist/ua_two_state_variable";
import type { StatusCode } from "node-opcua-status-code";
import type { DataType } from "node-opcua-variant";

import type { UAControlFunctionStateMachine } from "./ua_control_function_state_machine";
import type { UAControllerTuningParameter } from "./ua_controller_tuning_parameter";
import type { UAFunction, UAFunction_Base } from "./ua_function";

// ----- this file has been automatically generated - do not edit

export interface UABaseControlFunction_alarmMonitor extends Omit<UAExclusiveDeviationAlarm, "ackedState"|"acknowledge"|"activeState"|"addComment"|"branchId"|"clientUserId"|"comment"|"conditionClassId"|"conditionClassName"|"conditionName"|"disable"|"enable"|"enabledState"|"eventId"|"eventType"|"highHighLimit"|"highLimit"|"inputNode"|"lastSeverity"|"limitState"|"lowLimit"|"lowLowLimit"|"message"|"quality"|"receiveTime"|"retain"|"setpointNode"|"severity"|"sourceName"|"sourceNode"|"suppressedOrShelved"|"time"> { // Object
      ackedState: UATwoStateVariable<LocalizedText>;
      acknowledge: UAMethod;
      activeState: UATwoStateVariable<LocalizedText>;
      addComment: UAMethod;
      branchId: UAProperty<NodeId, DataType.NodeId>;
      clientUserId: UAProperty<UAString, DataType.String>;
      comment: UAConditionVariable<LocalizedText, DataType.LocalizedText>;
      conditionClassId: UAProperty<NodeId, DataType.NodeId>;
      conditionClassName: UAProperty<LocalizedText, DataType.LocalizedText>;
      conditionName: UAProperty<UAString, DataType.String>;
      disable: UAMethod;
      enable: UAMethod;
      enabledState: UATwoStateVariable<LocalizedText>;
      eventId: UAProperty<Buffer, DataType.ByteString>;
      eventType: UAProperty<NodeId, DataType.NodeId>;
      highHighLimit: UAProperty<number, DataType.Double>;
      highLimit: UAProperty<number, DataType.Double>;
      inputNode: UAProperty<NodeId, DataType.NodeId>;
      lastSeverity: UAConditionVariable<UInt16, DataType.UInt16>;
      limitState: UAExclusiveLimitStateMachine;
      lowLimit: UAProperty<number, DataType.Double>;
      lowLowLimit: UAProperty<number, DataType.Double>;
      message: UAProperty<LocalizedText, DataType.LocalizedText>;
      quality: UAConditionVariable<StatusCode, DataType.StatusCode>;
      receiveTime: UAProperty<Date, DataType.DateTime>;
      retain: UAProperty<boolean, DataType.Boolean>;
      setpointNode: UAProperty<NodeId, DataType.NodeId>;
      severity: UAProperty<UInt16, DataType.UInt16>;
      sourceName: UAProperty<UAString, DataType.String>;
      sourceNode: UAProperty<NodeId, DataType.NodeId>;
      suppressedOrShelved: UAProperty<boolean, DataType.Boolean>;
      time: UAProperty<Date, DataType.DateTime>;
}
export interface UABaseControlFunction_operational extends UAFunctionalGroup { // Object
      currentState: UAFiniteStateVariable<LocalizedText>;
      reset?: UAMethod;
      stop: UAMethod;
}
/**
 * The BaseControlFunctionType provides an abstract
 * superclass for all control functions.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |BaseControlFunctionType i=1007                              |
 * |isAbstract      |true                                                        |
 */
export interface UABaseControlFunction_Base extends UAFunction_Base {
    /**
     * alarmMonitor
     * AlarmMonitor indicates whether the deviation from
     * a set point exceeds the limit. See: 10000-9:
     * Alarms & Conditions | ExclusiveDeviationAlarmType.
     */
    alarmMonitor?: UABaseControlFunction_alarmMonitor;
    /**
     * operational
     * Operational is a FunctionalGroup that shall
     * organize the CurrentState property of the
     * StateMachine and all its remote invocable
     * Methods. Furthermore, it shall organize at least
     * the CurrentValue and TargetValue variables.
     */
    operational: UABaseControlFunction_operational;
    /**
     * controlFunctionState
     * ControlFunctionState is a state machine which
     * represents the execution state and controls the
     * execution of the Function.
     */
    controlFunctionState: UAControlFunctionStateMachine;
    /**
     * controllerTuningParameter
     * The ControllerTuningParameterType is an abstract
     * class. It is formally defined in Table 85.
     * Subtypes of the ControllerTuningParameterType
     * contain the parameters and information about a
     * Controller (configuration).
     */
    controllerTuningParameter?: UAControllerTuningParameter;
}
export interface UABaseControlFunction extends UAFunction, UABaseControlFunction_Base {}