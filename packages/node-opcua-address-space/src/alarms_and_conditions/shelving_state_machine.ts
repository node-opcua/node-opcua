/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */

// --------------------------------------------------------------------------------------------------
// ShelvingStateMachine
// --------------------------------------------------------------------------------------------------

import { assert } from "node-opcua-assert";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant, VariantLike } from "node-opcua-variant";

import { MethodFunctorCallback, SessionContext, UAMethod } from "../../source";
import { promoteToStateMachine, StateMachine } from "../state_machine/finite_state_machine";
import { UAObject } from "../ua_object";
import { UAVariable } from "../ua_variable";
import { UAAlarmConditionBase } from "./ua_alarm_condition_base";

import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

export interface ShelvingStateMachine {
    unshelve: UAMethod;
    timedShelve: UAMethod;
    oneShotShelve: UAMethod;
    unshelveTime: UAVariable;

    _timer: NodeJS.Timer | null;
    _sheveldTime: Date;
    _unshelvedTime: Date;
    _duration: number;
}
export class ShelvingStateMachine extends StateMachine {
    public static promote(object: UAObject): ShelvingStateMachine {
        const shelvingState = object as ShelvingStateMachine;
        promoteToStateMachine(shelvingState);

        Object.setPrototypeOf(shelvingState, ShelvingStateMachine.prototype);
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
                    get: _unShelveTimeFunc.bind(null, shelvingState)
                },
                true
            );
        }

        assert(shelvingState instanceof ShelvingStateMachine);
        return shelvingState;
    }
}

// The Unshelve Method sets the AlarmCondition to the Unshelved state. Normally, the MethodId found
// the Shelving child of the Condition instance and the NodeId of the Shelving object as the ObjectId
// are passed to the Call Service. However, some Servers do not expose Condition instances in the
// AddressSpace. Therefore all Servers shall also allow Clients to call the Unshelve Method by
// specifying ConditionId as the ObjectId. The Method cannot be called with an ObjectId of the
// ShelvedStateMachineType Node.
// output => BadConditionNotShelved
function _unshelve_method(inputArguments: VariantLike[], context: SessionContext, callback: any) {
    assert(inputArguments.length === 0);
    // var alarmNode = context.object.parent;
    // if (!(alarmNode instanceof UAAlarmConditionBase)) {
    //     return callback(null, {statusCode: StatusCodes.BadNodeIdInvalid});
    // }
    //
    // if (!alarmNode.getEnabledState() ) {
    //     return callback(null, {statusCode: StatusCodes.BadConditionDisabled});
    // }

    const shelvingState = context.object as ShelvingStateMachine;
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

export function _clear_timer_if_any(shelvingState: ShelvingStateMachine) {
    if (shelvingState._timer) {
        clearTimeout(shelvingState._timer);
        // xx console.log("_clear_timer_if_any shelvingState = ",shelvingState._timer,shelvingState.constructor.name);
        shelvingState._timer = null;
    }
}

function _automatically_unshelve(shelvingState: ShelvingStateMachine) {
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

function _start_timer_for_automatic_unshelve(shelvingState: ShelvingStateMachine, duration: number) {
    if (duration < 10 || duration >= Math.pow(2, 31)) {
        throw new Error(" Invalid maxTimeShelved duration: " + duration + "  must be [10,2**31] ");
    }
    assert(!shelvingState._timer);

    shelvingState._sheveldTime = new Date(); // now
    shelvingState._duration = duration;

    if (doDebug) {
        debugLog("shelvingState._duration", shelvingState._duration);
    }

    if (duration !== UAAlarmConditionBase.MaxDuration) {
        assert(!shelvingState._timer);
        shelvingState._timer = setTimeout(_automatically_unshelve.bind(null, shelvingState), shelvingState._duration);
    }
}

// Spec 1.03:
// The TimedShelve Method sets the AlarmCondition to the TimedShelved state
// (parameters are defined in Table 38 and result codes are described in Table 39).
// Normally, the MethodId found in the Shelving child of the Condition instance and the NodeId of the Shelving object
// as the ObjectId are passed to the Call Service. However, some Servers do not expose Condition instances in the
// AddressSpace. Therefore all Servers shall also allow Clients to call the TimedShelve Method by specifying
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

function _timedShelve_method(inputArguments: VariantLike[], context: SessionContext, callback: any) {
    assert(inputArguments.length === 1);

    const shelvingState = context.object as ShelvingStateMachine;

    if (shelvingState.getCurrentState() !== "Unshelved") {
        return callback(null, {
            statusCode: StatusCodes.BadConditionAlreadyShelved
        });
    }
    // checking duration ...
    const alarmNode = shelvingState.parent;

    // istanbul ignore next
    if (!(alarmNode instanceof UAAlarmConditionBase)) {
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
// Call Service. However, some Servers do not expose Condition instances in the AddressSpace. Therefore all Servers
// shall also allow Clients to call the OneShotShelve Method by specifying ConditionId as the ObjectId. The Method
// cannot be called with an ObjectId of the ShelvedStateMachineType Node
function _oneShotShelve_method(
    this: UAMethod,
    inputArguments: Variant[],
    context: SessionContext,
    callback: MethodFunctorCallback
) {
    assert(inputArguments.length === 0);
    const shelvingState = context.object as ShelvingStateMachine;
    if (shelvingState.getCurrentState() === "OneShotShelved") {
        return callback(null, {
            statusCode: StatusCodes.BadConditionAlreadyShelved
        });
    }
    // checking duration ...
    const alarmNode = shelvingState.parent;

    // istanbul ignore next
    if (!(alarmNode instanceof UAAlarmConditionBase)) {
        return callback(null, {
            statusCode: StatusCodes.BadNodeIdInvalid
        });
    }

    const maxTimeShelved = alarmNode.getMaxTimeShelved();
    assert(isFinite(maxTimeShelved));
    assert(maxTimeShelved !== UAAlarmConditionBase.MaxDuration);

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
function _unShelveTimeFunc(shelvingState: ShelvingStateMachine) {
    if (shelvingState.getCurrentState() === "Unshelved") {
        return new Variant({
            dataType: DataType.StatusCode,
            value: StatusCodes.BadConditionNotShelved
        });
    }

    if (!shelvingState._sheveldTime) {
        return new Variant({
            dataType: DataType.StatusCode,
            value: StatusCodes.BadConditionNotShelved
        });
    }
    if (shelvingState.getCurrentState() === "OneShotShelved" && shelvingState._duration === UAAlarmConditionBase.MaxDuration) {
        return new Variant({
            dataType: DataType.Double,
            value: UAAlarmConditionBase.MaxDuration
        });
    }
    const now = new Date();

    let timeToAutomaticUnshelvedState = shelvingState._duration - (now.getTime() - shelvingState._sheveldTime.getTime());

    // timeToAutomaticUnshelvedState should always be greater than (or equal) zero
    timeToAutomaticUnshelvedState = Math.max(timeToAutomaticUnshelvedState, 0);
    return new Variant({
        dataType: DataType.Double, // duration
        value: timeToAutomaticUnshelvedState
    });
}
