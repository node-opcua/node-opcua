/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import { EventEmitter } from "events";

import { IEventData, UAVariable, BaseNode, UAObject } from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import { UInt16 } from "node-opcua-basic-types";
import { coerceLocalizedText, LocalizedText, LocalizedTextLike, NodeClass } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { NodeId, sameNodeId } from "node-opcua-nodeid";
import { UAAcknowledgeableCondition } from "node-opcua-nodeset-ua";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { TimeZoneDataType } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";

import { ConditionSnapshot } from "../../source/interfaces/alarms_and_conditions/condition_snapshot";
import { IConditionVariableTypeSetterOptions } from "../../source/interfaces/i_condition_variable_type_setter_options";
import { UtcTime } from "../../source/interfaces/state_machine/ua_state_machine_type";
import { ISetStateOptions } from "../../source/interfaces/i_set_state_options";
import { EventData } from "../event_data";
import { UATwoStateVariableImpl } from "../state_machine/ua_two_state_variable";
import { UAConditionImpl } from "./ua_condition_impl";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

function normalizeName(str: string): string {
    // return str.split(".").map(utils.lowerFirstLetter).join(".");
    return str;
}

const disabledVar = new Variant({
    dataType: "StatusCode",
    value: StatusCodes.BadConditionDisabled
});

// list of Condition variables that should not be published as BadConditionDisabled when the condition
// is in a disabled state.
const _varTable = {
    BranchId: 1,
    ConditionClassId: 1,
    ConditionClassName: 1,
    ConditionName: 1,
    EnabledState: 1,
    "EnabledState.EffectiveDisplayName": 1,
    "EnabledState.Id": 1,
    "EnabledState.TransitionTime": 1,
    "EnabledState.EffectiveTransitionTime": 1,
    EventId: 1,
    EventType: 1,
    LocalTime: 1,
    SourceName: 1,
    SourceNode: 1,
    Time: 1
};

type FullBrowsePath = string;
export class ConditionSnapshotImpl extends EventEmitter implements ConditionSnapshot {
    public static normalizeName = normalizeName;

    public condition: BaseNode;
    public eventData: IEventData | null = null;
    public branchId: NodeId | null = null;

    private _map: Map<FullBrowsePath, Variant> = new Map();
    private _node_index: Map<FullBrowsePath, UAVariable> = new Map();

    /**
     */
    constructor(condition: BaseNode, branchId: NodeId) {
        super();
        assert(branchId instanceof NodeId);
        // xx self.branchId = branchId;
        this.condition = condition;
        this.eventData = new EventData(condition);
        // a nodeId/Variant map
        this.#_record_condition_state(condition);

        if (sameNodeId(branchId, NodeId.nullNodeId)) {
            this.#_installOnChangeEventHandlers(condition, "");
        }
        this.#_set_var("BranchId", DataType.NodeId, branchId);
    }

    public _constructEventData(): IEventData {
        if (this.branchId && sameNodeId(this.branchId, NodeId.nullNodeId)) {
            this.#_ensure_condition_values_correctness(this.condition!, "", []);
        }
        const c = this.condition as UAConditionImpl;
        const isDisabled = !c.getEnabledState();
        const eventData = new EventData(this.condition!);

        for (const fullBrowsePath of this._map.keys()) {
            const node = this._node_index.get(fullBrowsePath);
            if (!node) {
                debugLog("cannot node for find key", fullBrowsePath);
                continue;
            }
            if (isDisabled && !Object.prototype.hasOwnProperty.call(_varTable, fullBrowsePath)) {
                eventData._createValue(fullBrowsePath, node, disabledVar);
            } else {
                eventData._createValue(fullBrowsePath, node, this._map.get(fullBrowsePath)!);
            }
        }
        return eventData;
    }
    #_ensure_condition_values_correctness(node: BaseNode, prefix: string, error: string[]) {
        const displayError = !!error;
        error = error || [];

        const aggregates = node.getAggregates();

        for (const aggregate of aggregates) {
            if (aggregate.nodeClass === NodeClass.Variable) {
                const name = aggregate.browseName.toString();

                const key = prefix + name;

                const snapshot_value = this._map.get(key)!.toString();

                const aggregateVariable = aggregate as UAVariable;
                const condition_value = aggregateVariable.readValue().value.toString();

                if (snapshot_value !== condition_value) {
                    error.push(
                        " Condition Branch0 is not in sync with node values for " +
                        key +
                        "\n v1= " +
                        snapshot_value +
                        "\n v2= " +
                        condition_value
                    );
                }

                this._node_index.set(key, aggregateVariable);
                this.#_ensure_condition_values_correctness(aggregate, prefix + name + ".", error);
            }
        }

        if (displayError && error.length) {
            throw new Error(error.join("\n"));
        }
    }
    #_visit(node: BaseNode, prefix: string): void {
        const aggregates = node.getAggregates();
        for (const aggregate of aggregates) {
            if (aggregate.nodeClass === NodeClass.Variable) {
                const name = aggregate.browseName.toString();
                const key = prefix + name;

                // istanbul ignore next
                if (doDebug) {
                    debugLog("adding key =", key);
                }

                const aggregateVariable = aggregate as UAVariable;
                this._map.set(key, aggregateVariable.readValue().value);
                this._node_index.set(key, aggregateVariable);

                this.#_visit(aggregate, prefix + name + ".");
            }
        }
    }
    #_installOnChangeEventHandlers(node: BaseNode, prefix: string): void {
        const aggregates = node.getAggregates();
        for (const aggregate of aggregates) {
            if (aggregate.nodeClass === NodeClass.Variable) {
                const name = aggregate.browseName.toString();

                const key = prefix + name;

                // istanbul ignore next
                if (doDebug) {
                    debugLog("adding key =", key);
                }

                aggregate.on("value_changed", (newDataValue: DataValue) => {
                    this._map.set(key, newDataValue.value);
                    this._node_index.set(key, aggregate as UAVariable);
                });

                this.#_installOnChangeEventHandlers(aggregate, prefix + name + ".");
            }
        }
    }
    #_record_condition_state(condition: any) {
        this._map.clear();
        this._node_index.clear();
        assert(condition instanceof UAConditionImpl);
        this.#_visit(condition, "");
    }

    /**
     * @internal
     */
    #_get_var(varName: string): any {
        const c = this.condition as UAConditionImpl;
        if (!c.getEnabledState() && !Object.prototype.hasOwnProperty.call(_varTable, varName)) {
            // xx debuglog("ConditionSnapshot#_get_var condition enabled =", self.condition.getEnabledState());
            return disabledVar;
        }

        const key = normalizeName(varName);
        const variant = this._map.get(key);
        if (!variant) {
            throw new Error("cannot find key " + key);
        }
        return variant.value;
    }

    /**
     * @internal
     */
    #_set_var(varName: string, dataType: DataType, value: unknown, options?: IConditionVariableTypeSetterOptions): void {
        const key = normalizeName(varName);
        // istanbul ignore next
        if (!this._map.has(key)) {
            // istanbul ignore next
            if (doDebug) {
                debugLog(" cannot find node " + varName);
                debugLog("  map=", [...this._map.keys()].join(" "));
            }
        }
        this._map.set(
            key,
            new Variant({
                dataType,
                value
            })
        );

        const sourceTimestamp = options?.sourceTimestamp || new Date();
        const sourceTimestampKey = key + ".SourceTimestamp";
        if (this._map.has(sourceTimestampKey)) {
            // from spec 1.03 : 5.3 condition variables
            // a condition VariableType has a sourceTimeStamp exposed property
            // SourceTimestamp indicates the time of the last change of the Value of this ConditionVariable.
            // It shall be the same time that would be returned from the Read Service inside the DataValue
            // structure for the ConditionVariable Value Attribute.
            const variant = new Variant({
                dataType: DataType.DateTime,
                value: sourceTimestamp
            });
            this._map.set(sourceTimestampKey, variant);
            const node = this._node_index.get(sourceTimestampKey);
            this.emit("valueChanged", node, variant, { sourceTimestamp });
        }

        const variant = this._map.get(key);
        const node = this._node_index.get(key);
        if (!node) {
            // for instance localTime is optional
            debugLog("Cannot serVar " + varName + " dataType " + DataType[dataType]);
            return;
        }
        assert(node.nodeClass === NodeClass.Variable);
        this.emit("valueChanged", node, variant, { sourceTimestamp });
    }

    /**
     *
     */
    public getBranchId(): NodeId {
        return this.#_get_var("BranchId") as NodeId;
    }

    /**
     *
     */
    public getEventId(): Buffer {
        return this.#_get_var("EventId") as Buffer;
    }

    /**
     *
     */
    public getRetain(): boolean {
        return this.#_get_var("Retain") as boolean;
    }

    /**
     *
     */
    public setRetain(retainFlag: boolean): void {
        retainFlag = !!retainFlag;
        return this.#_set_var("Retain", DataType.Boolean, retainFlag);
    }

    /**
     *
     */
    public renewEventId(): void {
        const addressSpace = this.condition.addressSpace;
        // create a new event  Id for this new condition
        const eventId = addressSpace.generateEventId();
        const ret = this.#_set_var("EventId", DataType.ByteString, eventId.value);

        return ret;
    }

    /**
     *
     */
    public getEnabledState(): boolean {
        return this.#_get_twoStateVariable("EnabledState");
    }

    /**
     *
     */
    public setEnabledState(value: boolean, options?: ISetStateOptions): void {
        return this.#_set_twoStateVariable("EnabledState", value, options);
    }

    /**
     *
     */
    public getEnabledStateAsString(): string {
        return this.#_get_var("EnabledState").text;
    }

    /**
     *
     */
    public getComment(): LocalizedText {
        return this.#_get_var("Comment");
    }

    /**
     * Set condition comment
     *
     * Comment contains the last comment provided for a certain state (ConditionBranch). It may
     * have been provided by an AddComment Method, some other Method or in some other
     * manner. The initial value of this Variable is null, unless it is provided in some other manner. If
     * a Method provides as an option the ability to set a Comment, then the value of this Variable is
     * reset to null if an optional comment is not provided.
     *
     */
    public setComment(txtMessage: LocalizedTextLike, options?: IConditionVariableTypeSetterOptions): void {
        const txtMessage1 = coerceLocalizedText(txtMessage);
        this.#_set_var("Comment", DataType.LocalizedText, txtMessage1, options);
    }

    /**
     * set the condition message (localized text)
     */
    public setMessage(txtMessage: LocalizedTextLike | LocalizedText): void {
        const txtMessage1 = coerceLocalizedText(txtMessage);
        return this.#_set_var("Message", DataType.LocalizedText, txtMessage1);
    }

    /**
     *
     */
    public setClientUserId(userIdentity: string): void {
        return this.#_set_var("ClientUserId", DataType.String, userIdentity.toString());
    }

    /*
     *
     */

    /**
     * set the condition quality
     *
     *
     * as per spec 1.0.3 - Part 9
     *
     * Quality reveals the status of process values or other resources that this Condition
     * instance is based upon.
     *
     * If, for example, a process value is “Uncertain”, the associated “LevelAlarm”
     * Condition is also questionable.
     *
     * Values for the Quality can be any of the OPC StatusCodes defined in Part 8
     * as well as Good, Uncertain and Bad as defined in Part 4.
     *
     * These  StatusCodes are similar to but slightly more generic than the description
     * of data quality in the various field bus specifications.
     *
     * It is the responsibility of the Server to map internal status information to these codes.
     *
     * A Server which supports no quality information shall return Good.
     *
     * This quality can also reflect the communication status associated with the system that this
     * value or resource is based on and from which this Alarm was received. For communication
     * errors to the underlying system, especially those that result in some unavailable
     * Event fields, the quality shall be BadNoCommunication error.
     *
     * Quality refers to the quality of the data value(s) upon which this Condition is based.
     *
     * Since a Condition is usually based on one or more Variables, the Condition inherits
     *  the quality of these Variables. E.g., if the process value is “Uncertain”,
     *  the “LevelAlarm” Condition is also questionable.
     *
     * If more than one variable is represented by a given condition or if the condition
     * is from an underlining system and no direct mapping to a variable is available,
     * it is up to the application to determine what quality is displayed as part of the condition.
     */
    public setQuality(quality: StatusCode, options?: IConditionVariableTypeSetterOptions): void {
        this.#_set_var("Quality", DataType.StatusCode, quality, options);
    }

    /**
     *
     */
    public getQuality(): StatusCode {
        return this.#_get_var("Quality") as StatusCode;
    }

    /**
     * **as per spec 1.0.3 - Part 9**
     *
     * The Severity of a Condition is inherited from the base Event model defined in Part 5. It
     * indicates the urgency of the Condition and is also commonly called ‘priority’, especially in
     * relation to Alarms in the ProcessConditionClass.
     *
     * **as per spec 1.0.3 - Part 5**
     *
     * Severity is an indication of the urgency of the Event. This is also commonly
     * called “priority”.
     *
     * Values will range from 1 to 1 000, with 1 being the lowest severity and 1 000
     * being the highest.
     *
     * Typically, a severity of 1 would indicate an Event which is informational in nature,
     * while a value of 1 000 would indicate an Event of catastrophic nature, which could
     * potentially result in severe financial loss or loss of life.
     *
     * It is expected that very few Server implementations will support 1 000 distinct
     * severity levels.
     *
     * Therefore, Server developers are responsible for distributing their severity levels
     * across the  1 to 1 000 range in such a manner that clients can assume a linear
     * distribution.
     *
     *
     * For example, a  client wishing to present five severity levels to a user should be
     * able to do the following mapping:
     *
     *
     *            Client Severity OPC Severity
     *                HIGH        801 – 1 000
     *                MEDIUM HIGH 601 – 800
     *                MEDIUM      401 – 600
     *                MEDIUM LOW  201 – 400
     *                LOW           1 – 200
     *
     * In many cases a strict linear mapping of underlying source severities to the OPC
     * Severity range is not appropriate. The Server developer will instead intelligently
     * map the underlying source severities to the 1 to 1 000 OPC Severity range in some
     * other fashion.
     *
     * In particular, it it recommended that Server developers map Events of high urgency
     * into the OPC severity range of 667 to 1 000, Events of medium urgency into the
     * OPC severity range of 334 to 666 and Events of low urgency into OPC severities
     * of 1 to 333.
     */
    public setSeverity(severity: UInt16, options?: IConditionVariableTypeSetterOptions): void {
        assert(isFinite(severity), "expecting a UInt16");

        // record automatically last severity
        const lastSeverity = this.getSeverity();
        const sourceTimestamp = this.getSeveritySourceTimestamp();
        this.setLastSeverity(lastSeverity, { sourceTimestamp });

        this.#_set_var("Severity", DataType.UInt16, severity, options);
    }

    /**
     */
    public getSeverity(): UInt16 {
        const c = this.condition as UAConditionImpl;
        assert(c.getEnabledState(), "condition must be enabled");
        const value = this.#_get_var("Severity");
        return +value;
    }
    public getSeveritySourceTimestamp(): Date {
        const c = this.condition as UAConditionImpl;
        return c.severity.readValue().sourceTimestamp || new Date();
    }

    /**
     *  LastSeverity provides the previous severity of the ConditionBranch.
     *
     * **as per spec 1.0.3 - part 9**
     *
     *
     *  Initially this Variable  contains a zero value;
     *  it will return a value only after a severity change. The new severity is
     *  supplied via the Severity Property which is inherited from the BaseEventType.
     *
     */
    public setLastSeverity(severity: UInt16, options?: IConditionVariableTypeSetterOptions): void {
        severity = +severity;
        return this.#_set_var("LastSeverity", DataType.UInt16, severity, options);
    }

    /**
     *
     */
    public getLastSeverity(): UInt16 {
        const value = this.#_get_var("LastSeverity");
        return +value;
    }

    /**
     * setReceiveTime
     *
     * **as per OPCUA 1.0.3 part 5**:
     *
     * ReceiveTime provides the time the OPC UA Server received the Event from the underlying
     * device of another Server.
     *
     * ReceiveTime is analogous to ServerTimestamp defined in Part 4, i.e.
     * in the case where the OPC UA Server gets an Event from another OPC UA Server, each Server
     * applies its own ReceiveTime. That implies that a Client may get the same Event, having the
     * same EventId, from different Servers having different values of the ReceiveTime.
     *
     * The ReceiveTime shall always be returned as value and the Server is not allowed to return a
     * StatusCode for the ReceiveTime indicating an error.
     *
     */
    public setReceiveTime(time: UtcTime): void {
        return this.#_set_var("ReceiveTime", DataType.DateTime, time, { sourceTimestamp: time || undefined });
    }

    /**
     * Time provides the time the Event occurred.
     *
     * **as per OPCUA 1.0.3 part 5**:
     *
     * This value is set as close to the event generator as
     * possible. It often comes from the underlying system or device.
     *
     * Once set, intermediate OPC UA Servers shall not alter the value.
     *
     */
    public setTime(time: Date): void {
        return this.#_set_var("Time", DataType.DateTime, time, { sourceTimestamp: time });
    }

    /**
     * LocalTime is a structure containing the Offset and the DaylightSavingInOffset flag.
     *
     * The Offset specifies the time difference (in minutes) between the Time Property
     * and the time at the location in which the event was issued.
     *
     *
     * If DaylightSavingInOffset is TRUE, then Standard/Daylight savings time (DST) at
     * the originating location is in effect and Offset includes the DST correction.
     *
     * If `false` then the Offset does not include DST correction and DST may or may not have been
     * in effect.
     *
     */
    public setLocalTime(localTime: TimeZoneDataType): void {
        assert(localTime instanceof TimeZoneDataType);
        return this.#_set_var("LocalTime", DataType.ExtensionObject, new TimeZoneDataType(localTime));
    }

    // read only !
    public getSourceName(): LocalizedText {
        return this.#_get_var("SourceName");
    }

    /**
     *
     */
    public getSourceNode(): NodeId {
        return this.#_get_var("SourceNode");
    }

    /**
     *
     */
    public getEventType(): NodeId {
        return this.#_get_var("EventType");
    }

    public getMessage(): LocalizedText {
        return this.#_get_var("Message");
    }

    public isCurrentBranch(): boolean {
        return sameNodeId(this.#_get_var("BranchId"), NodeId.nullNodeId);
    }

    // -- ACKNOWLEDGEABLE -------------------------------------------------------------------

    public getAckedState(): boolean {
        const acknowledgeableCondition = this.condition as UAAcknowledgeableCondition;
        if (!acknowledgeableCondition.ackedState) {
            throw new Error(
                "Node " +
                acknowledgeableCondition.browseName.toString() +
                " of type " +
                acknowledgeableCondition.typeDefinitionObj.browseName.toString() +
                " has no AckedState"
            );
        }
        return this.#_get_twoStateVariable("AckedState");
    }

    public setAckedState(ackedState: boolean, options?: ISetStateOptions): StatusCode {
        ackedState = !!ackedState;
        return this._setAckedState(ackedState, undefined, undefined, options);
    }

    public getConfirmedState(): boolean {
        const acknowledgeableCondition = this.condition as UAAcknowledgeableCondition;
        assert(acknowledgeableCondition.confirmedState, "Must have a confirmed state");
        return this.#_get_twoStateVariable("ConfirmedState");
    }

    public setConfirmedStateIfExists(confirmedState: boolean, options?: ISetStateOptions): void {
        confirmedState = !!confirmedState;
        const acknowledgeableCondition = this.condition as UAAcknowledgeableCondition;
        if (!acknowledgeableCondition.confirmedState) {
            // no condition node has been defined (this is valid)
            // confirm state cannot be set
            return;
        }
        // todo deal with Error code BadConditionBranchAlreadyConfirmed
        return this.#_set_twoStateVariable("ConfirmedState", confirmedState, options);
    }

    public setConfirmedState(confirmedState: boolean): void {
        const acknowledgeableCondition = this.condition as UAAcknowledgeableCondition;
        assert(acknowledgeableCondition.confirmedState, "Must have a confirmed state.  Add ConfirmedState to the optionals");
        return this.setConfirmedStateIfExists(confirmedState);
    }

    // ---- Shelving
    public getSuppressedState(): boolean {
        return this.#_get_twoStateVariable("SuppressedState");
    }

    public setSuppressedState(suppressed: boolean, options?: ISetStateOptions): void {
        suppressed = !!suppressed;
        this.#_set_twoStateVariable("SuppressedState", suppressed, options);
    }

    public getActiveState(): boolean {
        return this.#_get_twoStateVariable("ActiveState");
    }

    public setActiveState(newActiveState: boolean, options?: ISetStateOptions): StatusCode {
        // xx var activeState = self.getActiveState();
        // xx if (activeState === newActiveState) {
        // xx     return StatusCodes.Bad;
        // xx }
        this.#_set_twoStateVariable("ActiveState", newActiveState, options);
        return StatusCodes.Good;
    }

    public setLatchedState(newLatchedState: boolean, options?: ISetStateOptions): StatusCode {
        this.#_set_twoStateVariable("LatchedState", newLatchedState, options);
        return StatusCodes.Good;
    }
    public getLatchedState(): boolean {
        return this.#_get_twoStateVariable("LatchedState");
    }
    public setOutOfServiceState(newOutOfServiceState: boolean, options?: ISetStateOptions): StatusCode {
        this.#_set_twoStateVariable("OutOfServiceState", newOutOfServiceState, options);
        return StatusCodes.Good;
    }
    public getOutOfServiceState(): boolean {
        return this.#_get_twoStateVariable("OutOfServiceState");
    }
    public setSilentState(newSilentState: boolean, options?: ISetStateOptions): StatusCode {
        this.#_set_twoStateVariable("SilentState", newSilentState, options);
        return StatusCodes.Good;
    }
    public getSilentState(): boolean {
        return this.#_get_twoStateVariable("SilentState");
    }
    public setShelvingState(): void {
        throw new Error("Method not implemented.");
    }
    public toString(): string {
        //   public condition: any = null;
        //   public eventData: any = null;
        //   public branchId: NodeId | null = null;
        const t = this.condition.addressSpace.findNode((this.condition as UAObject).typeDefinition)!;
        return (
            "" +
            "condition: " +
            (this.condition.browseName.toString() + " " + this.condition.nodeId.toString()) +
            ", type: " +
            (t.browseName.toString() + " " + t.nodeId.toString()) +
            ", branchId: " +
            (this.branchId ? this.branchId.toString() : "<null>") +
            ", acked: " +
            this.getAckedState() +
            ", confirmed: " +
            this.getConfirmedState() +
            ", activeState: " +
            this.getActiveState() +
            // + ", suppressed: " + this.getSuppressedState()
            ", retain: " +
            this.getRetain() +
            ", message: " +
            this.getMessage() +
            ", comment: " +
            this.getComment()
        );
    }
    #_set_twoStateVariable(varName: string, value: boolean, options?: ISetStateOptions): void {
        value = !!value;

        const hrKey = ConditionSnapshotImpl.normalizeName(varName);
        const idKey = ConditionSnapshotImpl.normalizeName(varName + ".Id");

        const variant = new Variant({ dataType: DataType.Boolean, value });
        this._map.set(idKey, variant);

        // also change varName with human readable text
        const twoStateNode = this._node_index.get(hrKey);
        if (!twoStateNode) {
            throw new Error("Cannot find twoState Variable with name " + varName);
        }
        if (!(twoStateNode instanceof UATwoStateVariableImpl)) {
            throw new Error("Cannot find twoState Variable with name " + varName + " " + twoStateNode);
        }

        const hrValue = new Variant({
            dataType: DataType.LocalizedText,
            value: value ? twoStateNode.getTrueState() : twoStateNode.getFalseState()
        });
        this._map.set(hrKey, hrValue);

        const node = this._node_index.get(idKey);

        // also change ConditionNode if we are on currentBranch
        if (this.isCurrentBranch()) {
            assert(twoStateNode instanceof UATwoStateVariableImpl);
            twoStateNode.setValue(value as boolean, options);
        }
        const sourceTimestamp = options?.effectiveTransitionTime || new Date();
        this.emit("valueChanged", node, variant, { sourceTimestamp });
    }

    #_get_twoStateVariable(varName: string): any {
        const key = ConditionSnapshotImpl.normalizeName(varName) + ".Id";
        const variant = this._map.get(key);

        // istanbul ignore next
        if (!variant) {
            return "???";
            // throw new Error("Cannot find TwoStateVariable with name " + varName);
        }
        return variant.value;
    }

    _setAckedState(
        requestedAckedState: boolean,
        conditionEventId?: Buffer,
        comment?: string | LocalizedText | LocalizedTextLike,
        options?: ISetStateOptions
    ): StatusCode {
        const ackedState = this.getAckedState();

        if (ackedState && requestedAckedState) {
            return StatusCodes.BadConditionBranchAlreadyAcked;
        }
        this.#_set_twoStateVariable("AckedState", requestedAckedState, options);
        return StatusCodes.Good;
    }
}
