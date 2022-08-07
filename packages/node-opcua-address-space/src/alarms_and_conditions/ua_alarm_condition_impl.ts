/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import { isEqual } from "lodash";

import { assert } from "node-opcua-assert";
import { NodeClass } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { NodeId, sameNodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, VariantOptions } from "node-opcua-variant";
import { UAShelvedStateMachine } from "node-opcua-nodeset-ua";
import { BaseNode, INamespace, UAEventType, UAVariable } from "node-opcua-address-space-base";

import { _install_TwoStateVariable_machinery } from "../state_machine/ua_two_state_variable";
import { UAShelvedStateMachineExImpl, _clear_timer_if_any } from "../state_machine/ua_shelving_state_machine_ex";
import { AddressSpacePrivate } from "../address_space_private";
import { ConditionInfo } from "../../source/interfaces/alarms_and_conditions/condition_info_i";
import { UAAlarmConditionEx } from "../../source/interfaces/alarms_and_conditions/ua_alarm_condition_ex";
import { InstantiateAlarmConditionOptions } from "../../source/interfaces/alarms_and_conditions/instantiate_alarm_condition_options";

import { ConditionInfoImpl } from "./condition_info_impl";
import { UAAcknowledgeableConditionImpl } from "./ua_acknowledgeable_condition_impl";

function _update_suppressedOrShelved(alarmNode: UAAlarmConditionImpl) {
    alarmNode.suppressedOrShelved.setValueFromSource({
        dataType: DataType.Boolean,
        value: alarmNode.isSuppressedOrShelved()
    });
}
export declare interface UAAlarmConditionImpl extends UAAlarmConditionEx, UAAcknowledgeableConditionImpl {
    on(eventName: string, eventHandler: any): this;
}

export class UAAlarmConditionImpl extends UAAcknowledgeableConditionImpl implements UAAlarmConditionEx {
    public static MaxDuration = Math.pow(2, 31);

    public static instantiate(
        namespace: INamespace,
        alarmConditionTypeId: UAEventType | string | NodeId,
        options: InstantiateAlarmConditionOptions,
        data?: Record<string, VariantOptions>
    ): UAAlarmConditionImpl {
        const addressSpace = namespace.addressSpace;
        // xx assert(Object.prototype.hasOwnProperty.call(options,"conditionOf")); // must provide a conditionOf
        assert(Object.prototype.hasOwnProperty.call(options, "inputNode")); // must provide a inputNode
        const alarmConditionType = addressSpace.findEventType(alarmConditionTypeId);

        /* istanbul ignore next */
        if (!alarmConditionType) {
            throw new Error(" cannot find Alarm Condition Type for " + alarmConditionTypeId);
        }

        const alarmConditionTypeBase = addressSpace.findEventType("AlarmConditionType");
        /* istanbul ignore next */
        if (!alarmConditionTypeBase) {
            throw new Error("cannot find AlarmConditionType");
        }

        options.optionals = options.optionals || [];
        if (Object.prototype.hasOwnProperty.call(options, "maxTimeShelved")) {
            options.optionals.push("MaxTimeShelved");
            assert(isFinite(options.maxTimeShelved!));
        }

        assert(alarmConditionTypeBase === alarmConditionType || alarmConditionType.isSupertypeOf(alarmConditionTypeBase));

        const alarmNode = UAAcknowledgeableConditionImpl.instantiate(
            namespace,
            alarmConditionTypeId,
            options,
            data
        ) as UAAlarmConditionImpl;
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
            UAShelvedStateMachineExImpl.promote(alarmNode.shelvingState);
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
            alarmNode.suppressedState.on("value_changed", (newDataValue: DataValue) => {
                _update_suppressedOrShelved(alarmNode);
            });
        }
        if (alarmNode.shelvingState) {
            alarmNode.shelvingState.currentState.on("value_changed", (newDataValue: DataValue) => {
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
        assert(options.inputNode, " must provide options.inputNode (NodeId or BaseNode object)");
        alarmNode.installInputNodeMonitoring(options.inputNode);

        assert(alarmNode instanceof UAAcknowledgeableConditionImpl);
        assert(alarmNode instanceof UAAlarmConditionImpl);
        return alarmNode;
    }

    public dispose(): void {
        if (this.shelvingState) {
            _clear_timer_if_any(this.shelvingState as any as UAShelvedStateMachineExImpl);
        }
        super.dispose();
    }

    public activateAlarm(): void {
        // will set acknowledgeable to false and retain to true
        const branch = this.currentBranch();
        branch.setRetain(true);
        branch.setActiveState(true);
        branch.setAckedState(false);
    }

    public deactivateAlarm(retain?: boolean): void {
        const branch = this.currentBranch();
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
            suppressed = this.suppressedState.id!.readValue().value.value;
        }
        let shelved = false;
        if (this.shelvingState) {
            const shelvedValue = this.shelvingState.currentState.readValue().value.value;
            if (shelvedValue && shelvedValue.text !== "Unshelved") {
                shelved = true;
            }
            // console.log("shelved = shelved",shelvedValue,shelved);
        }
        // xx console.log(" isSuppressedOrShelved ",suppressed,shelved);
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
        if (duration < 10 || duration >= Math.pow(2, 31)) {
            throw new Error(" Invalid maxTimeShelved duration: " + duration + "  must be [10,2**31] ");
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
            assert(UAAlarmConditionImpl.MaxDuration <= 2147483648, "MaxDuration cannot be greater than 2**31");
            return UAAlarmConditionImpl.MaxDuration;
        }
        const dataValue = this.maxTimeShelved.readValue();
        assert(dataValue.value.dataType === DataType.Double); // Double <= Duration
        return dataValue.value.value;
    }

    /**
     * @method getInputNodeNode
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
     * @method getInputNodeValue
     * @return {*}
     */
    public getInputNodeValue(): any | null {
        const node = this.getInputNodeNode();
        if (!node) {
            return null;
        }
        assert(node.nodeClass === NodeClass.Variable);
        return node.readValue().value.value;
    }

    public updateState(): void {
        const node = this.getInputNodeNode() as UAVariable;
        const dataValue = node.readValue();
        this._onInputDataValueChange(dataValue);
    }

    protected _onInputDataValueChange(newValue: DataValue): void {
        // xx console.log("class=",this.constructor.name,this.browseName.toString());
        // xx throw new Error("_onInputDataValueChange must be overridden");
    }

    /**
     * @method installInputNodeMonitoring
     * install mechanism that listen to input node datavalue changes so that alarm status
     * can be automatically updated appropriatly.
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
                // tslint:disable-next-line:no-console
                console.log(" cannot find nodeId ", inputNode);
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

    /***
     * @method  _calculateConditionInfo
     * @param stateData {Object}   the new calculated state of the alarm
     * @param isActive  {Boolean}
     * @param value     {Number}   the new value of the limit alarm
     * @param oldCondition  {ConditionInfo} given for information purpose
     * @param oldCondition.severity
     * @param oldCondition.quality
     * @param oldCondition.message
     * @param oldCondition.retain
     * @return {ConditionInfo} the new condition info
     *
     * this method need to be overridden by the instantiate to allow custom message and severity
     * to be set based on specific context of the alarm.
     *
     * @example
     *
     *
     *    var myAlarm = addressSpace.instantiateExclusiveLimitAlarm({...});
     *    myAlarm._calculateConditionInfo = function(stateName,value,oldCondition) {
     *       var percent = Math.ceil(value * 100);
     *       return new ConditionInfo({
     *            message: "Tank is almost " + percent + "% full",
     *            severity: 100,
     *            quality: StatusCodes.Good
     *      });
     *    };
     *
     */
    public _calculateConditionInfo(
        stateData: string | null,
        isActive: boolean,
        value: string,
        oldCondition: ConditionInfo
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
                message: "Condition value is " + value + " and state is " + stateData,
                quality: StatusCodes.Good,
                retain: true,
                severity: 150
            });
        }
    }

    public _signalInitialCondition(): void {
        this.currentBranch().setActiveState(false);
        this.currentBranch().setAckedState(true);
    }
    public _signalNewCondition(stateName: string | null, isActive?: boolean, value?: string): void {
        // xx if(stateName === null) {
        // xx     alarm.currentBranch().setActiveState(false);
        // xx     alarm.currentBranch().setAckedState(true);
        // xx     return;
        // xx }
        // disabled alarm shall not generate new condition events
        assert(this.getEnabledState() === true);
        // xx assert(isActive !== alarm.activeState.getValue());

        const oldConditionInfo = this.getCurrentConditionInfo();
        const newConditionInfo = this._calculateConditionInfo(stateName, !!isActive, value!, oldConditionInfo);

        // detect potential internal bugs due to misused of _signalNewCondition
        if (isEqual(oldConditionInfo, newConditionInfo)) {
            // tslint:disable-next-line:no-console
            console.log(oldConditionInfo);
            throw new Error(
                "condition values have not change, shall we really raise an event ? alarm " + this.browseName.toString()
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
