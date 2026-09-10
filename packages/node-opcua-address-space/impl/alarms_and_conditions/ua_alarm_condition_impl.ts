/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import { isDeepStrictEqual as isEqual } from "node:util";
import type { BaseNode, INamespace, UAEventType, UAObject, UAProperty, UAVariable } from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import { NodeClass } from "node-opcua-data-model";
import type { DataValue } from "node-opcua-data-value";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { NodeId, sameNodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, type VariantOptions } from "node-opcua-variant";
import type { ConditionInfo } from "../../api/interfaces/alarms_and_conditions/condition_info_i.js";
import type { InstantiateAlarmConditionOptions } from "../../api/interfaces/alarms_and_conditions/instantiate_alarm_condition_options.js";
import type { PromoteToAlarmOptions } from "../../api/interfaces/alarms_and_conditions/promote_to_alarm_options.js";
import type { UAAlarmConditionEx } from "../../api/interfaces/alarms_and_conditions/ua_alarm_condition_ex.js";
import type { UAShelvedStateMachineEx } from "../../api/interfaces/state_machine/ua_shelved_state_machine_ex.js";
import type { UATwoStateVariableEx } from "../../api/ua_two_state_variable_ex.js";
import type { AddressSpacePrivate } from "../address_space_private.js";
import {
    _clear_timer_if_any,
    type UAShelvedStateMachineExImpl,
    UAShelvedStateMachineExImplBase
} from "../state_machine/ua_shelving_state_machine_ex.js";
import { _install_TwoStateVariable_machinery } from "../state_machine/ua_two_state_variable.js";
import { ConditionInfoImpl } from "./condition_info_impl.js";
import {
    _initialize_acknowledgeable_condition_node,
    UAAcknowledgeableConditionImpl,
    UAAcknowledgeableConditionImplBase
} from "./ua_acknowledgeable_condition_impl.js";
import { _initialize_condition_node, type ConditionInitializationOptions } from "./ua_condition_impl.js";

const debugLog = make_debugLog("ua_alarm_condition_impl");
const doDebug = checkDebugFlag("ua_alarm_condition_impl");

function _update_suppressedOrShelved(alarmNode: UAAlarmConditionImpl) {
    alarmNode.suppressedOrShelved.setValueFromSource({
        dataType: DataType.Boolean,
        value: alarmNode.isSuppressedOrShelved()
    });
}

/** @internal */
export class UAAlarmConditionImplBase extends UAAcknowledgeableConditionImplBase implements UAAlarmConditionEx {
    /**
     * Installed as child nodes by the address space, not assigned here - hence `declare`.
     * enabledState, ackedState and confirmedState come from the base classes.
     */
    declare public readonly activeState: UATwoStateVariableEx;
    declare public readonly inputNode: UAProperty<NodeId, DataType.NodeId>;
    declare public readonly suppressedOrShelved: UAProperty<boolean, DataType.Boolean>;
    declare public readonly suppressedState?: UATwoStateVariableEx;
    declare public readonly outOfServiceState?: UATwoStateVariableEx;
    declare public readonly shelvingState?: UAShelvedStateMachineEx;
    declare public readonly silenceState?: UATwoStateVariableEx;
    declare public readonly latchedState?: UATwoStateVariableEx;
    declare public readonly maxTimeShelved?: UAProperty<number, DataType.Double>;

    public static MaxDuration = 2 ** 31;

    public static instantiate(
        namespace: INamespace,
        alarmConditionTypeId: UAEventType | string | NodeId,
        options: InstantiateAlarmConditionOptions,
        data?: Record<string, VariantOptions>
    ): UAAlarmConditionImpl {
        const addressSpace = namespace.addressSpace;
        // xx assert(Object.prototype.hasOwnProperty.call(options,"conditionOf")); // must provide a conditionOf
        assert(Object.hasOwn(options, "inputNode")); // must provide a inputNode
        assert(options.inputNode, " must provide options.inputNode (NodeId or BaseNode object)");
        const alarmConditionType = addressSpace.findEventType(alarmConditionTypeId);

        /* c8 ignore next */
        if (!alarmConditionType) {
            throw new Error(` cannot find Alarm Condition Type for ${alarmConditionTypeId}`);
        }

        const alarmConditionTypeBase = addressSpace.findEventType("AlarmConditionType");
        /* c8 ignore next */
        if (!alarmConditionTypeBase) {
            throw new Error("cannot find AlarmConditionType");
        }

        options.optionals = options.optionals || [];
        // ActiveState is a TwoStateVariable whose texts and transition times an alarm client
        // expects, as UAConditionImpl requests them for EnabledState. A subtype that re-declares
        // ActiveState with only Id (ExclusiveLimitAlarmType does) would otherwise get only Id.
        options.optionals.push(
            "ActiveState.TrueState",
            "ActiveState.FalseState",
            "ActiveState.TransitionTime",
            "ActiveState.EffectiveTransitionTime",
            "ActiveState.EffectiveDisplayName"
        );
        if (Object.hasOwn(options, "maxTimeShelved")) {
            options.optionals.push("MaxTimeShelved");
            assert(Number.isFinite(options.maxTimeShelved));
        }

        assert(alarmConditionTypeBase === alarmConditionType || alarmConditionType.isSubtypeOf(alarmConditionTypeBase));

        const alarmNode = UAAcknowledgeableConditionImplBase.instantiate(
            namespace,
            alarmConditionTypeId,
            options,
            data
        ) as unknown as UAAlarmConditionImpl;

        return _initialize_alarm_condition_node(alarmNode, options);
    }

    public dispose(): void {
        if (this.shelvingState) {
            _clear_timer_if_any(this.shelvingState as unknown as UAShelvedStateMachineExImpl);
        }
        super.dispose();
    }

    public activateAlarm(): void {
        // will set acknowledgeable to false and retain to true
        const branch = this.currentBranch();
        if (!branch) {
            return;
        }
        branch.setRetain(true);
        branch.setActiveState(true);
        branch.setAckedState(false);
    }

    public deactivateAlarm(retain?: boolean): void {
        const branch = this.currentBranch();
        if (!branch) {
            return;
        }
        branch.setRetain(retain === undefined ? true : retain);
        branch.setActiveState(false);
    }

    /**
     * @deprecated use deactivateAlarm instead (with no s after de-activate)
     */
    protected desactivateAlarm(): void {
        this.deactivateAlarm();
    }

    public isSuppressedOrShelved(): boolean {
        let suppressed = false;
        if (this.suppressedState) {
            suppressed = this.suppressedState?.id?.readValue().value.value || false;
        }
        let shelved = false;
        if (this.shelvingState) {
            const shelvedValue = this.shelvingState?.currentState.readValue().value.value;
            if (shelvedValue && shelvedValue.text !== "Unshelved") {
                shelved = true;
            }
        }
        return suppressed || shelved;
    }

    public getSuppressedOrShelved(): boolean {
        return this.suppressedOrShelved.readValue().value.value;
    }

    /**
     *
     * note: duration must be greater than 10ms and lesser than 2**31 ms
     */
    public setMaxTimeShelved(duration: number): void {
        if (duration < 10 || duration >= 2 ** 31) {
            throw new Error(` Invalid maxTimeShelved duration: ${duration}  must be [10,2**31] `);
        }
        this.maxTimeShelved?.setValueFromSource({
            dataType: "Duration", // <= Duration is basic Type Double! ( milliseconds)
            value: duration
        });
    }

    /**
     * note: return a  Duration
     */
    public getMaxTimeShelved(): number {
        if (!this.maxTimeShelved) {
            // if maxTimeShelved is not provided we assume MaxDuration
            assert(UAAlarmConditionImplBase.MaxDuration <= 2147483648, "MaxDuration cannot be greater than 2**31");
            return UAAlarmConditionImplBase.MaxDuration;
        }
        const dataValue = this.maxTimeShelved?.readValue();
        assert(dataValue?.value.dataType === DataType.Double); // Double <= Duration
        return dataValue?.value.value || 0;
    }

    /**

     * @return {BaseNode} return the node in the address space pointed by the inputNode value
     *
     * Note: please note the difference between alarm.inputNode
     *    *  alarm.inputNode is a UAVariable property of the alarm object holding the nodeid of the input
     *       node in its value.
     *    *  getInputNodeNode() is the UAVariable that contains the value that affects the state of the alarm and
     *       whose node id is stored in alarm.inputNode
     */
    public getInputNodeNode(): UAVariable | null {
        const nodeId = this.inputNode.readValue().value.value;
        assert(nodeId instanceof NodeId || nodeId === null);
        return this.addressSpace.findNode(nodeId) as UAVariable | null;
    }
    /**
     *
     */
    public getInputNodeValue(): number | null {
        const node = this.getInputNodeNode();
        if (!node) {
            return null;
        }
        assert(node.nodeClass === NodeClass.Variable);
        return node.readValue().value.value || 0;
    }

    public updateState(): void {
        const node = this.getInputNodeNode() as UAVariable;
        const dataValue = node.readValue();
        this._onInputDataValueChange(dataValue);
    }

    /**
     * What the alarm does when the value of its input node changes. Assign to it to give an
     * alarm a state machine of its own, without deriving from anything.
     *
     * @example
     *
     * ```ts
     * const myAlarm = namespace.instantiateAlarmCondition("AlarmConditionType", { ... });
     * myAlarm.onInputDataValueChange = (newValue) => {
     *     const tooHot = newValue.value.value > 80;
     *     if (tooHot !== myAlarm.activeState.getValue()) {
     *         myAlarm.signalNewCondition(tooHot ? "Active" : "Inactive", tooHot, `${newValue.value.value}`);
     *     }
     * };
     * ```
     *
     * The default does nothing: a plain AlarmConditionType has no idea what its input means.
     * The alarm types that do (limit alarms, off-normal alarms) override this.
     */
    public onInputDataValueChange(_newValue: DataValue): void {
        /**  */
    }

    /**
     * @deprecated assign {@link onInputDataValueChange} instead; this delegates to it.
     */
    protected _onInputDataValueChange(newValue: DataValue): void {
        this.onInputDataValueChange(newValue);
    }

    /**
     * install mechanism that listen to input node datavalue changes so that alarm status
     * can be automatically updated appropriately.
     * @param inputNode {BaseNode}
     * @return {void}
     * @protected
     */
    public installInputNodeMonitoring(inputNode: BaseNode | NodeId): void {
        /**
         *
         * The InputNode Property provides the NodeId of the Variable the Value of which is used as
         * primary input in the calculation of the Alarm state. If this Variable is not in the Address Space,
         * a Null NodeId shall be provided. In some systems, an Alarm may be calculated based on
         * multiple Variables Values; it is up to the system to determine which Variable’s NodeId is used.
         * dataType is DataType.NodeId
         * @property inputNode
         * @type     UAVariable
         */
        assert(this.inputNode.nodeClass === NodeClass.Variable);

        const addressSpace = this.addressSpace as AddressSpacePrivate;
        assert(inputNode, " must provide options.inputNode (NodeId or BaseNode object)");

        if (inputNode instanceof NodeId) {
            this.inputNode.setValueFromSource({
                dataType: DataType.NodeId,
                value: inputNode as NodeId
            });
        } else {
            this.inputNode.setValueFromSource({
                dataType: "NodeId",
                value: (inputNode as BaseNode).nodeId
            });

            const _node = addressSpace._coerceNode(inputNode);
            if (_node === null) {
                // c8 ignore next
                doDebug && debugLog(" cannot find nodeId ", inputNode);
            } else {
                assert(_node, "Expecting a valid input node");
                this.inputNode.setValueFromSource({
                    dataType: DataType.NodeId,
                    value: _node.nodeId
                });
            }

            const inputNode2 = this.getInputNodeNode();
            if (!inputNode2 || inputNode2 === null) {
                throw new Error("Invalid input node");
            }
            inputNode2.on("value_changed", (newDataValue: DataValue /*, oldDataValue */) => {
                if (!this.getEnabledState()) {
                    // disabled alarms shall ignored input node value change event
                    // (alarm shall be reevaluated when EnabledState goes back to true)
                    return;
                }
                this._onInputDataValueChange(newDataValue);
            });
        }
    }

    public getCurrentConditionInfo(): ConditionInfo {
        const oldSeverity = this.currentBranch().getSeverity();
        const oldQuality = this.currentBranch().getQuality();
        const oldMessage = this.currentBranch().getMessage();
        const oldRetain = this.currentBranch().getRetain();

        const oldConditionInfo = new ConditionInfoImpl({
            message: oldMessage,
            quality: oldQuality,
            retain: oldRetain,
            severity: oldSeverity
        });
        return oldConditionInfo;
    }

    /**
     * What this alarm reports when its state changes. Assign to it to give an alarm a message
     * and a severity of its own.
     *
     * @example
     *
     * ```ts
     * const myAlarm = namespace.instantiateExclusiveLimitAlarm({ ... });
     * myAlarm.calculateConditionInfo = (stateName, isActive, value, oldConditionInfo) =>
     *     new ConditionInfo({
     *         message: `Tank is almost ${Math.ceil(Number(value) * 100)}% full`,
     *         severity: 100,
     *         quality: StatusCodes.Good,
     *         retain: true
     *     });
     * ```
     *
     * This example is now runnable. It was written against `_calculateConditionInfo` and
     * `new ConditionInfo(...)`, while the method sat on this class only and ConditionInfo was
     * exported as a type with no constructor - so following the documentation meant importing
     * two names from inside the package.
     */
    public calculateConditionInfo(
        stateData: string | null,
        _isActive: boolean,
        value: string,
        _oldCondition: ConditionInfo
    ): ConditionInfo {
        if (!stateData) {
            return new ConditionInfoImpl({
                message: "Back to normal",
                quality: StatusCodes.Good,
                retain: true,
                severity: 0
            });
        } else {
            return new ConditionInfoImpl({
                message: `Condition is ${value} and state is ${stateData}`,
                quality: StatusCodes.Good,
                retain: true,
                severity: 150
            });
        }
    }

    /**
     * @deprecated assign {@link calculateConditionInfo} instead; this delegates to it.
     */
    public _calculateConditionInfo(
        stateData: string | null,
        isActive: boolean,
        value: string,
        oldCondition: ConditionInfo
    ): ConditionInfo {
        return this.calculateConditionInfo(stateData, isActive, value, oldCondition);
    }

    public _signalInitialCondition(): void {
        this.currentBranch().setActiveState(false);
        this.currentBranch().setAckedState(true);
    }
    /**
     * @deprecated call {@link signalNewCondition} instead; this delegates to it.
     */
    public _signalNewCondition(stateName: string | null, isActive: boolean, value: string): void {
        this.signalNewCondition(stateName, isActive, value);
    }

    /**
     * Raise a new condition event for this alarm.
     *
     * Call this only when the condition has actually changed: it throws when the new
     * ConditionInfo is equal to the current one, because raising an event that reports
     * nothing new is a bug in the caller rather than a state the alarm can represent.
     */
    public signalNewCondition(stateName: string | null, isActive: boolean, value: string): void {
        // xx if(stateName === null) {
        // xx     alarm.currentBranch().setActiveState(false);
        // xx     alarm.currentBranch().setAckedState(true);
        // xx     return;
        // xx }
        // disabled alarm shall not generate new condition events
        assert(this.getEnabledState() === true);
        // xx assert(isActive !== alarm.activeState.getValue());

        const oldConditionInfo = this.getCurrentConditionInfo();
        // deliberately the deprecated name: code that overrode `_calculateConditionInfo`
        // still takes effect through it, and code that assigns the published
        // `calculateConditionInfo` is reached by the default below. Both work.
        const newConditionInfo = this._calculateConditionInfo(stateName, isActive, value, oldConditionInfo);

        // detect potential internal bugs due to misused of signalNewCondition
        if (isEqual(oldConditionInfo, newConditionInfo)) {
            // c8 ignore next
            if (doDebug) {
                debugLog("oldConditionInfo", oldConditionInfo);
                debugLog("oldConditionInfo", newConditionInfo);
            }
            throw new Error(
                `condition values have not change, shall we really raise an event ? alarm ${this.browseName.toString()}`
            );
        }
        assert(!isEqual(oldConditionInfo, newConditionInfo), "condition values have not change, shall we really raise an event ?");

        if (isActive) {
            this.currentBranch().setActiveState(true);
            this.currentBranch().setAckedState(false);
            this.raiseNewCondition(newConditionInfo);
        } else {
            if (this.currentBranch().getAckedState() === false) {
                // prior state need acknowledgement
                // note : TODO : timestamp of branch and new state of current branch must be identical

                if (this.currentBranch().getRetain()) {
                    // we need to create a new branch so the previous state could be acknowledged
                    const newBranch = this.createBranch();
                    assert(!sameNodeId(newBranch.getBranchId(), NodeId.nullNodeId));
                    // also raised a new Event for the new branch as branchId has changed
                    this.raiseNewBranchState(newBranch);
                }
            }

            this.currentBranch().setActiveState(false);
            this.currentBranch().setAckedState(true);

            this.raiseNewCondition(newConditionInfo);
        }
    }
}

/** @internal */
export type UAAlarmConditionImpl = UAAlarmConditionImplBase;
/** @internal */
export const UAAlarmConditionImpl = UAAlarmConditionImplBase;

/**
 * The part of {@link InstantiateAlarmConditionOptions} that the initialization step below reads.
 *
 * @internal
 */
export type AlarmConditionInitializationOptions = ConditionInitializationOptions & {
    maxTimeShelved?: number;
    inputNode?: UAVariable | NodeId;
};

/**
 * The alarm half of the wiring, everything that follows the creation of the node.
 *
 * Shared by {@link UAAlarmConditionImplBase.instantiate} and by {@link promoteToAlarm}, so a node
 * that was created some other way ends up with exactly the same machinery rather than an
 * approximation of it. `inputNode` is optional here because a node being promoted may already
 * carry its InputNode property, or may be given one later.
 *
 * @internal
 */
export function _initialize_alarm_condition_node(
    alarmNode: UAAlarmConditionImpl,
    options: AlarmConditionInitializationOptions
): UAAlarmConditionImpl {
    Object.setPrototypeOf(alarmNode, UAAlarmConditionImpl.prototype);

    // ----------------------- Install Alarm specifics
    //

    // Specs 1.03:
    // ActiveState/Id when set to TRUE indicates that the situation the Condition is representing
    // currently exists. When a Condition instance is in the inactive state (ActiveState/Id when set to
    // FALSE) it is representing a situation that has returned to a normal state. The transitions of
    // Conditions to the inactive and Active states are triggered by Server specific actions. Sub-
    // Types of the AlarmConditionType specified later in this document will have sub-state models
    // that further define the Active state. Recommended state names are described in Annex A.
    // install activeState - Mandatory

    /**
     * @property activeState
     * @type {UATwoStateVariable}
     */
    _install_TwoStateVariable_machinery(alarmNode.activeState, {
        falseState: "Inactive",
        trueState: "Active"
    });

    alarmNode.currentBranch().setActiveState(false);

    // Specs 1.03:
    /**
     *
     * SuppressState is used internally by a Server to automatically suppress Alarms due to system
     * specific reasons. For example a system may be configured to suppress Alarms that are
     * associated with machinery that is shutdown, such as a low level Alarm for a tank that is
     * currently not in use.
     *
     * @property suppressedState
     * @type UATwoStateVariable
     */
    if (alarmNode.suppressedState) {
        // install activeState - Optional
        _install_TwoStateVariable_machinery(alarmNode.suppressedState, {
            falseState: "Unsuppressed",
            trueState: "Suppressed"
        });
    }
    // Specs 1.03:
    /**
     * ShelvingState suggests whether an Alarm shall (temporarily) be prevented from being
     * displayed to the user. It is quite often used to block nuisance Alarms.
     *
     * @property shelvingState
     * @type ShelvingStateMachine
     */
    if (alarmNode.shelvingState) {
        UAShelvedStateMachineExImplBase.promote(alarmNode.shelvingState);
    }

    // SuppressedOrShelved : Mandatory
    // install suppressedOrShelved automatic detection
    /**
     * The SuppressedState and the ShelvingState together result in the SuppressedOrShelved status of the
     * Condition. When an Alarm is in one of the states, the SuppressedOrShelved property will be set TRUE
     * and this Alarm is then typically not displayed by the Client. State transitions associated with the
     * Alarm do occur, but they are not typically displayed by the Clients as long as the Alarm remains in
     * either the Suppressed or Shelved state.
     * The dataType is Boolean.
     * @property suppressedState
     * @type UAVariable
     *
     */
    if (alarmNode.suppressedState) {
        alarmNode.suppressedState.on("value_changed", (_newDataValue: DataValue) => {
            _update_suppressedOrShelved(alarmNode);
        });
    }
    if (alarmNode.shelvingState) {
        alarmNode.shelvingState.currentState.on("value_changed", (_newDataValue: DataValue) => {
            _update_suppressedOrShelved(alarmNode);
        });
    }
    _update_suppressedOrShelved(alarmNode);

    /**
     * The optional Property MaxTimeShelved is used to set the maximum time that an Alarm Condition may be shelved.
     * The value is expressed as duration. Systems can use this Property to prevent permanent Shelving of an Alarm.
     * If this Property is present it will be an upper limit on the duration passed into a TimedShelve Method call.
     * If a value that exceeds the value of this property is passed to the TimedShelve Method,
     * than a BadShelvingTimeOutOfRange error code is returned on the call. If this Property is present it will
     * also be enforced for the OneShotShelved state, in that an Alarm Condition will transition to the Unshelved
     * state from the OneShotShelved state if the duration specified in this Property expires following a
     * OneShotShelve operation without a change of any of the other items associated with the Condition.
     *
     * @property maxTimeShelved
     * @type {UAVariable}
     */
    if (alarmNode.maxTimeShelved) {
        options.maxTimeShelved = options.maxTimeShelved || 60.0 * 1000; // 60 seconds
        alarmNode.maxTimeShelved.setValueFromSource({
            dataType: "Duration",
            value: options.maxTimeShelved
        });
    }

    // ---------- install inputNode
    if (options.inputNode) {
        alarmNode.installInputNodeMonitoring(options.inputNode);
    }

    assert(alarmNode instanceof UAAcknowledgeableConditionImpl);
    assert(alarmNode instanceof UAAlarmConditionImpl);
    return alarmNode;
}

/**
 * Give an existing node the behaviour of the alarm its type says it is.
 *
 * A node only becomes a working alarm when `namespace.instantiateAlarmCondition` builds it; a node
 * that arrived any other way - `objectType.instantiate()`, or a nodeset XML - carries the right
 * children but none of the machinery, so `activateAlarm` and `signalNewCondition` are simply not
 * there. This retypes the node in place, keeping its identity in the address space index and every
 * reference already pointing at it, and then runs the same initialization the factory runs.
 *
 * Limit alarms are refused rather than half-promoted: their behaviour lives in
 * UALimitAlarmImpl and its subclasses, and a node wearing the plain alarm prototype would look
 * promoted while ignoring its own limit set points.
 */
export function promoteToAlarm(node: UAObject, options?: PromoteToAlarmOptions): UAAlarmConditionEx {
    if (node instanceof UAAlarmConditionImplBase) {
        return node as unknown as UAAlarmConditionImpl; // already promoted
    }
    const addressSpace = node.addressSpace;
    const typeDefinition = node.typeDefinitionObj;

    const alarmConditionType = addressSpace.findObjectType("AlarmConditionType");
    /* c8 ignore next */
    if (!alarmConditionType) {
        throw new Error("promoteToAlarm: cannot find AlarmConditionType - is the standard nodeset loaded ?");
    }
    if (!typeDefinition || (typeDefinition !== alarmConditionType && !typeDefinition.isSubtypeOf(alarmConditionType))) {
        throw new Error(
            `promoteToAlarm: ${node.browseName.toString()} has type definition ` +
                `${typeDefinition ? typeDefinition.browseName.toString() : "<none>"} ` +
                "which does not derive from AlarmConditionType - only alarms can be promoted"
        );
    }
    const limitAlarmType = addressSpace.findObjectType("LimitAlarmType");
    if (limitAlarmType && (typeDefinition === limitAlarmType || typeDefinition.isSubtypeOf(limitAlarmType))) {
        throw new Error(
            `promoteToAlarm: ${node.browseName.toString()} is a ${typeDefinition.browseName.toString()}, ` +
                "a limit alarm - promoting limit alarms is not supported, use namespace.instantiateLimitAlarm instead"
        );
    }
    // CertificateExpirationAlarmType carries behaviour of its own - promoteToCertificateExpirationAlarm
    // starts an expiry timer and registers a shutdown task. Promoting one here would give it plain
    // alarm behaviour and silently drop that, which is worse than refusing: the node would look
    // promoted and never fire.
    const certificateExpirationAlarmType = addressSpace.findObjectType("CertificateExpirationAlarmType");
    if (
        certificateExpirationAlarmType &&
        (typeDefinition === certificateExpirationAlarmType || typeDefinition.isSubtypeOf(certificateExpirationAlarmType))
    ) {
        throw new Error(
            `promoteToAlarm: ${node.browseName.toString()} is a ${typeDefinition.browseName.toString()}, ` +
                "which has its own expiry machinery - use promoteToCertificateExpirationAlarm instead"
        );
    }
    const alarmConditionEventType = addressSpace.findEventType(typeDefinition.nodeId);
    /* c8 ignore next */
    if (!alarmConditionEventType) {
        throw new Error(`promoteToAlarm: cannot find event type for ${typeDefinition.browseName.toString()}`);
    }

    // conditionSource has to be an own property even when it is absent: the condition
    // initialization tells "no source" from "source not considered" by its presence.
    const initializationOptions: AlarmConditionInitializationOptions = {
        conditionClass: options?.conditionClass,
        conditionName: options?.conditionName || node.browseName.name || undefined,
        conditionSource: options?.conditionSource ?? null,
        inputNode: options?.inputNode,
        maxTimeShelved: options?.maxTimeShelved
    };

    const conditionNode = node as unknown as UAAlarmConditionImpl;
    _initialize_condition_node(node.namespace, conditionNode, alarmConditionEventType, initializationOptions);
    _initialize_acknowledgeable_condition_node(conditionNode);
    return _initialize_alarm_condition_node(conditionNode, initializationOptions);
}
