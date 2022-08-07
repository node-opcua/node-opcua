/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */

// --------------------------------------------------------------------------------------------------
// ShelvingStateMachine
// --------------------------------------------------------------------------------------------------

import { assert } from "node-opcua-assert";
import { CallbackT, StatusCodes } from "node-opcua-status-code";
import { DataType, Variant, VariantLike } from "node-opcua-variant";

import { UAProperty, ISessionContext, UAMethod, UAObject } from "node-opcua-address-space-base";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { UAState, UATransition } from "node-opcua-nodeset-ua";
import { CallMethodResultOptions } from "node-opcua-service-call";
import { DataValue } from "node-opcua-data-value";

import { UAAlarmConditionImpl } from "../alarms_and_conditions/ua_alarm_condition_impl";
import { UAShelvedStateMachineEx } from "../../source/interfaces/state_machine/ua_shelved_state_machine_ex";
import { UATransitionEx } from "../../source/interfaces/state_machine/ua_transition_ex";

import { promoteToStateMachine, UAStateMachineImpl } from "./finite_state_machine";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

export interface UAShelvedStateMachineHelper {
    _timer: NodeJS.Timer | null;
    _sheveldTime: Date;
    _unshelvedTime: Date;
    _duration: number;
}

export interface UAShelvedStateMachineExImpl extends UAShelvedStateMachineHelper {
    unshelveTime: UAProperty<number, /*z*/ DataType.Double>;
    unshelved: UAState;
    timedShelved: UAState;
    oneShotShelved: UAState;
    unshelvedToTimedShelved: UATransitionEx;
    unshelvedToOneShotShelved: UATransitionEx;
    timedShelvedToUnshelved: UATransitionEx;
    timedShelvedToOneShotShelved: UATransitionEx;
    oneShotShelvedToUnshelved: UATransitionEx;
    oneShotShelvedToTimedShelved: UATransitionEx;
    timedShelve: UAMethod;
    timedShelve2?: UAMethod;
    unshelve: UAMethod;
    unshelve2?: UAMethod;
    oneShotShelve: UAMethod;
    oneShotShelve2?: UAMethod;
}

export class UAShelvedStateMachineExImpl extends UAStateMachineImpl implements UAShelvedStateMachineEx {
    public static promote(object: UAObject): UAShelvedStateMachineEx {
        const shelvingState = object as UAShelvedStateMachineExImpl;
        promoteToStateMachine(shelvingState);

        Object.setPrototypeOf(shelvingState, UAShelvedStateMachineExImpl.prototype);
        shelvingState._timer = null;

        if (shelvingState.unshelve) {
            shelvingState.unshelve.bindMethod(_unshelve_method);
        }
        if (shelvingState.timedShelve) {
            shelvingState.timedShelve.bindMethod(_timedShelve_method);
        }
        if (shelvingState.oneShotShelve) {
            shelvingState.oneShotShelve.bindMethod(_oneShotShelve_method);
        }
        // install unshelveTime
        if (shelvingState.unshelveTime) {
            shelvingState.unshelveTime.minimumSamplingInterval = 500;
            shelvingState.unshelveTime.bindVariable(
                {
                    timestamped_get: _unShelveTimeFunc.bind(null, shelvingState)
                },
                true
            );
        }

        assert(shelvingState instanceof UAShelvedStateMachineExImpl);
        return shelvingState;
    }
}

// The Unshelve Method sets the AlarmCondition to the Unshelved state. Normally, the MethodId found
// the Shelving child of the Condition instance and the NodeId of the Shelving object as the ObjectId
// are passed to the Call Service. However, some Servers do not expose Condition instances in the
// IAddressSpace. Therefore all Servers shall also allow Clients to call the Unshelve Method by
// specifying ConditionId as the ObjectId. The Method cannot be called with an ObjectId of the
// ShelvedStateMachineType Node.
// output => BadConditionNotShelved
function _unshelve_method(inputArguments: VariantLike[], context: ISessionContext, callback: CallbackT<CallMethodResultOptions>) {
    assert(inputArguments.length === 0);
    // var alarmNode = context.object.parent;
    // if (!(alarmNode instanceof UAAlarmConditionImpl)) {
    //     return callback(null, {statusCode: StatusCodes.BadNodeIdInvalid});
    // }
    //
    // if (!alarmNode.getEnabledState() ) {
    //     return callback(null, {statusCode: StatusCodes.BadConditionDisabled});
    // }

    const shelvingState = context.object! as UAShelvedStateMachineExImpl;
    promoteToStateMachine(shelvingState);

    if (shelvingState.getCurrentState() === "Unshelved") {
        return callback(null, {
            statusCode: StatusCodes.BadConditionNotShelved
        });
    }
    shelvingState.setState("Unshelved");

    (shelvingState as any)._unsheveldTime = new Date(); // now

    _clear_timer_if_any(shelvingState);
    assert(!shelvingState._timer);

    return callback(null, {
        statusCode: StatusCodes.Good
    });
}

export function _clear_timer_if_any(shelvingState: UAShelvedStateMachineExImpl): void {
    if (shelvingState._timer) {
        clearTimeout(shelvingState._timer);
        // xx console.log("_clear_timer_if_any shelvingState = ",shelvingState._timer,shelvingState.constructor.name);
        shelvingState._timer = null;
    }
}

function _automatically_unshelve(shelvingState: UAShelvedStateMachineExImpl) {
    assert(shelvingState._timer, "expecting timerId to be set");
    shelvingState._timer = null;

    if (doDebug) {
        debugLog("Automatically unshelving variable ", shelvingState.browseName.toString());
    }

    if (shelvingState.getCurrentState() === "Unshelved") {
        // just ignore !!!
        return;
        // throw new Error(StatusCodes.BadConditionNotShelved);
    }
    shelvingState.setState("Unshelved");
    shelvingState._unshelvedTime = new Date(); // now
    assert(!shelvingState._timer);
}

function _start_timer_for_automatic_unshelve(shelvingState: UAShelvedStateMachineExImpl, duration: number) {
    if (duration < 10 || duration >= Math.pow(2, 31)) {
        throw new Error(" Invalid maxTimeShelved duration: " + duration + "  must be [10,2**31] ");
    }
    assert(!shelvingState._timer);

    shelvingState._sheveldTime = new Date(); // now
    shelvingState._duration = duration;

    if (doDebug) {
        debugLog("shelvingState._duration", shelvingState._duration);
    }

    if (duration !== UAAlarmConditionImpl.MaxDuration) {
        assert(!shelvingState._timer);
        shelvingState._timer = setTimeout(_automatically_unshelve.bind(null, shelvingState), shelvingState._duration);
    }
}

// Spec 1.03:
// The TimedShelve Method sets the AlarmCondition to the TimedShelved state
// (parameters are defined in Table 38 and result codes are described in Table 39).
// Normally, the MethodId found in the Shelving child of the Condition instance and the NodeId of the Shelving object
// as the ObjectId are passed to the Call Service. However, some Servers do not expose Condition instances in the
// IAddressSpace. Therefore all Servers shall also allow Clients to call the TimedShelve Method by specifying
// ConditionId as the ObjectId. The Method cannot be called with an ObjectId of the ShelvedStateMachineType Node.
//
// Signature:   TimedShelve([in] Duration ShelvingTime);
//
// ShelvingTime Specifies a fixed time for which the Alarm is to be shelved. The Server may refuse
//              the provided duration.
//              If a MaxTimeShelved Property exist on the Alarm than the Shelving time shall be less than or equal
//              to the value of this Property.
// StatusCode :
//               BadConditionAlreadyShelved The Alarm is already in TimedShelved state and the system does not allow
//                                           a reset of the shelved timer.
//               BadShelvingTimeOutOfRange

function _timedShelve_method(
    inputArguments: VariantLike[],
    context: ISessionContext,
    callback: CallbackT<CallMethodResultOptions>
) {
    assert(inputArguments.length === 1);
    if (!context.object) {
        return;
    }
    const shelvingState = context.object! as UAShelvedStateMachineExImpl;

    if (shelvingState.getCurrentState() !== "Unshelved") {
        return callback(null, {
            statusCode: StatusCodes.BadConditionAlreadyShelved
        });
    }
    // checking duration ...
    const alarmNode = shelvingState.parent;

    // istanbul ignore next
    if (!(alarmNode instanceof UAAlarmConditionImpl)) {
        return callback(null, {
            statusCode: StatusCodes.BadNodeIdInvalid
        });
    }
    const maxTimeShelved = alarmNode.getMaxTimeShelved();
    assert(isFinite(maxTimeShelved));

    assert(inputArguments[0].dataType === DataType.Double); // Duration
    assert(inputArguments[0] instanceof Variant);

    // xx console.log("inputArguments",inputArguments[0].toString());

    const proposedDuration = inputArguments[0].value; // as double (milliseconds)
    if (proposedDuration > maxTimeShelved) {
        return callback(null, {
            statusCode: StatusCodes.BadShelvingTimeOutOfRange
        });
    }

    if (proposedDuration < 0) {
        return callback(null, {
            statusCode: StatusCodes.BadShelvingTimeOutOfRange
        });
    }

    _clear_timer_if_any(shelvingState);
    shelvingState.setState("TimedShelved");
    _start_timer_for_automatic_unshelve(shelvingState, proposedDuration);

    return callback(null, {
        statusCode: StatusCodes.Good
    });
}

// Spec 1.03:
// OneShotShelve Method
// The OneShotShelve Method sets the AlarmCondition to the OneShotShelved state. Normally, the MethodId found in the
// Shelving child of the Condition instance and the NodeId of the Shelving object as the ObjectId are passed to the
// Call Service. However, some Servers do not expose Condition instances in the IAddressSpace. Therefore all Servers
// shall also allow Clients to call the OneShotShelve Method by specifying ConditionId as the ObjectId. The Method
// cannot be called with an ObjectId of the ShelvedStateMachineType Node
function _oneShotShelve_method(
    this: UAMethod,
    inputArguments: Variant[],
    context: ISessionContext,
    callback: CallbackT<CallMethodResultOptions>
) {
    assert(inputArguments.length === 0);
    const shelvingState = context.object! as UAShelvedStateMachineExImpl;
    if (shelvingState.getCurrentState() === "OneShotShelved") {
        return callback(null, {
            statusCode: StatusCodes.BadConditionAlreadyShelved
        });
    }
    // checking duration ...
    const alarmNode = shelvingState.parent;

    // istanbul ignore next
    if (!(alarmNode instanceof UAAlarmConditionImpl)) {
        return callback(null, {
            statusCode: StatusCodes.BadNodeIdInvalid
        });
    }

    const maxTimeShelved = alarmNode.getMaxTimeShelved();
    assert(isFinite(maxTimeShelved));
    assert(maxTimeShelved !== UAAlarmConditionImpl.MaxDuration);

    // set automatic unshelving timer
    _clear_timer_if_any(shelvingState);
    shelvingState.setState("OneShotShelved");
    _start_timer_for_automatic_unshelve(shelvingState, maxTimeShelved);

    return callback(null, {
        statusCode: StatusCodes.Good
    });
}

// from spec 1.03 :
// * UnshelveTime specifies the remaining time in milliseconds until the Alarm automatically
//   transitions into the Un-shelved state.
// * For the TimedShelved state this time is initialised with the ShelvingTime argument of the
//   TimedShelve Method call.
// * For the OneShotShelved state the UnshelveTime will be a constant set to the maximum Duration
//   except if a MaxTimeShelved Property is provided.
function _unShelveTimeFunc(shelvingState: UAShelvedStateMachineExImpl): DataValue {
    if (shelvingState.getCurrentState() === "Unshelved") {
        return new DataValue({
            statusCode: StatusCodes.BadConditionNotShelved,
            value: { dataType: DataType.Double, value: 0 }
        });
    }

    if (!shelvingState._sheveldTime) {
        return new DataValue({
            statusCode: StatusCodes.BadConditionNotShelved,
            value: { dataType: DataType.Double, value: 0 }
        });
    }
    if (shelvingState.getCurrentState() === "OneShotShelved" && shelvingState._duration === UAAlarmConditionImpl.MaxDuration) {
        return new DataValue({
            statusCode: StatusCodes.Good,
            value: {
                dataType: DataType.Double,
                value: UAAlarmConditionImpl.MaxDuration
            }
        });
    }
    const now = new Date();

    let timeToAutomaticUnshelvedState = shelvingState._duration - (now.getTime() - shelvingState._sheveldTime.getTime());

    // timeToAutomaticUnshelvedState should always be greater than (or equal) zero
    timeToAutomaticUnshelvedState = Math.max(timeToAutomaticUnshelvedState, 0);
    return new DataValue({
        statusCode: StatusCodes.Good,
        value: {
            dataType: DataType.Double, // duration
            value: timeToAutomaticUnshelvedState
        }
    });
}
