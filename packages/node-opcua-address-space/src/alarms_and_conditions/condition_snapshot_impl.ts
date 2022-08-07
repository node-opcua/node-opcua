/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import { EventEmitter } from "events";

import { IEventData, UAVariable, BaseNode, ISessionContext, UAObject } from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import { UInt16 } from "node-opcua-basic-types";
import { coerceLocalizedText, LocalizedText, LocalizedTextLike, NodeClass } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { NodeId, sameNodeId } from "node-opcua-nodeid";
import { UAAcknowledgeableCondition } from "node-opcua-nodeset-ua";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { SimpleAttributeOperand, TimeZoneDataType } from "node-opcua-types";
import * as utils from "node-opcua-utils";
import { DataType, Variant } from "node-opcua-variant";

import { ConditionSnapshot } from "../../source/interfaces/alarms_and_conditions/condition_snapshot";
import { UtcTime } from "../../source/interfaces/state_machine/ua_state_machine_type";
import { EventData } from "../event_data";
import { UATwoStateVariableImpl } from "../state_machine/ua_two_state_variable";
import { _setAckedState } from "./condition";
import { UAConditionImpl } from "./ua_condition_impl";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);


function normalizeName(str: string): string {
    return str.split(".").map(utils.lowerFirstLetter).join(".");
}

function _visit(self: any, node: BaseNode, prefix: string): void {
    const aggregates = node.getAggregates();
    for (const aggregate of aggregates) {
        if (aggregate.nodeClass === NodeClass.Variable) {
            let name = aggregate.browseName.toString();
            name = utils.lowerFirstLetter(name);

            const key = prefix + name;

            // istanbul ignore next
            if (doDebug) {
                debugLog("adding key =", key);
            }

            const aggregateVariable = aggregate as UAVariable;
            self._map[key] = aggregateVariable.readValue().value;
            self._node_index[key] = aggregateVariable;

            _visit(self, aggregate, prefix + name + ".");
        }
    }
}

function _record_condition_state(self: any, condition: any) {
    self._map = {};
    self._node_index = {};
    assert(condition instanceof UAConditionImpl);
    _visit(self, condition, "");
}

function _installOnChangeEventHandlers(self: any, node: BaseNode, prefix: string): void {
    const aggregates = node.getAggregates();
    for (const aggregate of aggregates) {
        if (aggregate.nodeClass === NodeClass.Variable) {
            let name = aggregate.browseName.toString();
            name = utils.lowerFirstLetter(name);

            const key = prefix + name;

            // istanbul ignore next
            if (doDebug) {
                debugLog("adding key =", key);
            }

            aggregate.on("value_changed", (newDataValue: DataValue) => {
                self._map[key] = newDataValue.value;
                self._node_index[key] = aggregate;
            });

            _installOnChangeEventHandlers(self, aggregate, prefix + name + ".");
        }
    }
}

function _ensure_condition_values_correctness(self: any, node: BaseNode, prefix: string, error: string[]) {
    const displayError = !!error;
    error = error || [];

    const aggregates = node.getAggregates();

    for (const aggregate of aggregates) {
        if (aggregate.nodeClass === NodeClass.Variable) {
            let name = aggregate.browseName.toString();
            name = utils.lowerFirstLetter(name);

            const key = prefix + name;

            const snapshot_value = self._map[key].toString();

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

            self._node_index[key] = aggregate;
            _ensure_condition_values_correctness(self, aggregate, prefix + name + ".", error);
        }
    }

    if (displayError && error.length) {
        throw new Error(error.join("\n"));
    }
}

const disabledVar = new Variant({
    dataType: "StatusCode",
    value: StatusCodes.BadConditionDisabled
});

// list of Condition variables that should not be published as BadConditionDisabled when the condition
// is in a disabled state.
const _varTable = {
    branchId: 1,
    conditionClassId: 1,
    conditionClassName: 1,
    conditionName: 1,
    enabledState: 1,
    "enabledState.effectiveDisplayName": 1,
    "enabledState.id": 1,
    "enabledState.transitionTime": 1,
    eventId: 1,
    eventType: 1,
    localTime: 1,
    sourceName: 1,
    sourceNode: 1,
    time: 1
};
export class ConditionSnapshotImpl extends EventEmitter implements ConditionSnapshot {
    public static normalizeName = normalizeName;

    public condition: BaseNode;
    public eventData: IEventData | null = null;
    public branchId: NodeId | null = null;
    private _map: { [key: string]: Variant } = {};
    private _node_index: { [key: string]: UAVariable } = {};

    /**
     * @class ConditionSnapshot
     * @extends EventEmitter
     * @param condition
     * @param branchId
     * @constructor
     */
    constructor(condition: BaseNode, branchId: NodeId) {
        super();
        assert(branchId instanceof NodeId);
        // xx self.branchId = branchId;
        this.condition = condition;
        this.eventData = new EventData(condition);
        // a nodeId/Variant map
        _record_condition_state(this, condition);

        if (sameNodeId(branchId, NodeId.nullNodeId)) {
            _installOnChangeEventHandlers(this, condition, "");
        }
        this._set_var("branchId", DataType.NodeId, branchId);
    }

    public _constructEventData(): IEventData {
        if (this.branchId && sameNodeId(this.branchId, NodeId.nullNodeId)) {
            _ensure_condition_values_correctness(this, this.condition!, "", []);
        }
        const c = this.condition as UAConditionImpl;
        const isDisabled = !c.getEnabledState();
        const eventData = new EventData(this.condition!);
        for (const key of Object.keys(this._map)) {
            const node = this._node_index[key];
            if (!node) {
                debugLog("cannot node for find key", key);
                continue;
            }
            if (isDisabled && !Object.prototype.hasOwnProperty.call(_varTable, key)) {
                eventData.setValue(key, node, disabledVar);
            } else {
                eventData.setValue(key, node, this._map[key]);
            }
        }

        return eventData;
    }

    /**
     * @method resolveSelectClause
     * @param selectClause {SelectClause}
     */
    public resolveSelectClause(selectClause: SimpleAttributeOperand): NodeId | null {
        return this.eventData?.resolveSelectClause(selectClause) || null;
    }

    /**
     *
     */
    public readValue(sessionContext: ISessionContext, nodeId: NodeId, selectClause: SimpleAttributeOperand): Variant {
        const c = this.condition as UAConditionImpl;
        const isDisabled = !c.getEnabledState();
        if (isDisabled) {
            return disabledVar;
        }

        const key = nodeId.toString();
        const variant = this._map[key];
        if (!variant) {
            // the value is not handled by us .. let's delegate
            // to the eventData helper object
            return this.eventData?.readValue(sessionContext, nodeId, selectClause) || disabledVar;
        }
        return variant;
    }

    public _get_var(varName: string): any {
        const c = this.condition as UAConditionImpl;
        if (!c.getEnabledState() && !Object.prototype.hasOwnProperty.call(_varTable, varName)) {
            // xx console.log("ConditionSnapshot#_get_var condition enabled =", self.condition.getEnabledState());
            return disabledVar;
        }

        const key = normalizeName(varName);
        const variant = this._map[key];
        return variant.value;
    }

    public _set_var(varName: string, dataType: DataType, value: unknown): void {
        const key = normalizeName(varName);
        // istanbul ignore next
        if (!Object.prototype.hasOwnProperty.call(this._map, key)) {
            if (doDebug) {
                debugLog(" cannot find node " + varName);
                debugLog("  map=", Object.keys(this._map).join(" "));
            }
        }
        this._map[key] = new Variant({
            dataType,
            value
        });

        if (this._map[key + ".sourceTimestamp"]) {
            this._map[key + ".sourceTimestamp"] = new Variant({
                dataType: DataType.DateTime,
                value: new Date()
            });
        }

        const variant = this._map[key];
        const node = this._node_index[key];
        if (!node) {
            // for instance localTime is optional
            debugLog("Cannot serVar " + varName + " dataType " + DataType[dataType]);
            return;
        }
        assert(node.nodeClass === NodeClass.Variable);
        this.emit("value_changed", node, variant);
    }

    /**
     * @method getBrandId
     * @return {NodeId}
     */
    public getBranchId(): NodeId {
        return this._get_var("branchId") as NodeId;
    }

    /**
     * @method getEventId
     * @return {ByteString}
     */
    public getEventId(): Buffer {
        return this._get_var("eventId") as Buffer;
    }

    /**
     * @method getRetain
     * @return {Boolean}
     */
    public getRetain(): boolean {
        return this._get_var("retain") as boolean;
    }

    /**
     *
     * @method setRetain
     * @param retainFlag {Boolean}
     */
    public setRetain(retainFlag: boolean): void {
        retainFlag = !!retainFlag;
        return this._set_var("retain", DataType.Boolean, retainFlag);
    }

    /**
     * @method renewEventId
     *
     */
    public renewEventId(): void {
        const addressSpace = this.condition.addressSpace;
        // create a new event  Id for this new condition
        const eventId = addressSpace.generateEventId();
        const ret = this._set_var("eventId", DataType.ByteString, eventId.value);

        // xx var branch = self; console.log("MMMMMMMMrenewEventId branch  " +
        // branch.getBranchId().toString() + " eventId = " + branch.getEventId().toString("hex"));

        return ret;
    }

    /**
     * @method getEnabledState
     * @return {Boolean}
     */
    public getEnabledState(): boolean {
        return this._get_twoStateVariable("enabledState");
    }

    /**
     * @method setEnabledState
     * @param value {Boolean}
     * @return void
     */
    public setEnabledState(value: boolean): void {
        return this._set_twoStateVariable("enabledState", value);
    }

    /**
     * @method getEnabledStateAsString
     * @return {String}
     */
    public getEnabledStateAsString(): string {
        return this._get_var("enabledState").text;
    }

    /**
     * @method getComment
     * @return {LocalizedText}
     */
    public getComment(): LocalizedText {
        return this._get_var("comment");
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
     * @method setComment
     * @param txtMessage {LocalizedText}
     */
    public setComment(txtMessage: LocalizedTextLike): void {
        const txtMessage1 = coerceLocalizedText(txtMessage);
        this._set_var("comment", DataType.LocalizedText, txtMessage1);
    }

    /**
     *
     * @method setMessage
     * @param txtMessage {LocalizedText}
     */
    public setMessage(txtMessage: LocalizedTextLike | LocalizedText): void {
        const txtMessage1 = coerceLocalizedText(txtMessage);
        return this._set_var("message", DataType.LocalizedText, txtMessage1);
    }

    /**
     * @method setClientUserId
     * @param userIdentity {String}
     */
    public setClientUserId(userIdentity: string): void {
        return this._set_var("clientUserId", DataType.String, userIdentity.toString());
    }

    /*
     *
     *
     * as per spec 1.0.3 - Part 9
     *
     * Quality reveals the status of process values or other resources that this Condition instance is
     * based upon. If, for example, a process value is “Uncertain”, the associated “LevelAlarm”
     * Condition is also questionable. Values for the Quality can be any of the OPC StatusCodes
     * defined in Part 8 as well as Good, Uncertain and Bad as defined in Part 4. These
     * StatusCodes are similar to but slightly more generic than the description of data quality in the
     * various field bus specifications. It is the responsibility of the Server to map internal status
     * information to these codes. A Server which supports no quality information shall return Good.
     * This quality can also reflect the communication status associated with the system that this
     * value or resource is based on and from which this Alarm was received. For communication
     * errors to the underlying system, especially those that result in some unavailable Event fields,
     * the quality shall be BadNoCommunication error.
     *
     * Quality refers to the quality of the data value(s) upon which this Condition is based. Since a
     * Condition is usually based on one or more Variables, the Condition inherits the quality of
     * these Variables. E.g., if the process value is “Uncertain”, the “LevelAlarm” Condition is also
     * questionable. If more than one variable is represented by a given condition or if the condition
     * is from an underlining system and no direct mapping to a variable is available, it is up to the
     * application to determine what quality is displayed as part of the condition.
     */

    /**
     * set the condition quality
     * @method setQuality
     * @param quality {StatusCode}
     */
    public setQuality(quality: StatusCode): void {
        this._set_var("quality", DataType.StatusCode, quality);
    }

    /**
     * @method getQuality
     * @return {StatusCode}
     */
    public getQuality(): StatusCode {
        return this._get_var("quality") as StatusCode;
    }

    /*
     * as per spec 1.0.3 - Part 9
     * The Severity of a Condition is inherited from the base Event model defined in Part 5. It
     * indicates the urgency of the Condition and is also commonly called ‘priority’, especially in
     * relation to Alarms in the ProcessConditionClass.
     *
     * as per spec 1.0.3 - PArt 5
     * Severity is an indication of the urgency of the Event. This is also commonly called “priority”.
     * Values will range from 1 to 1 000, with 1 being the lowest severity and 1 000 being the highest.
     * Typically, a severity of 1 would indicate an Event which is informational in nature, while a value
     * of 1 000 would indicate an Event of catastrophic nature, which could potentially result in severe
     * financial loss or loss of life.
     * It is expected that very few Server implementations will support 1 000 distinct severity levels.
     * Therefore, Server developers are responsible for distributing their severity levels across the
     * 1 to 1 000 range in such a manner that clients can assume a linear distribution. For example, a
     * client wishing to present five severity levels to a user should be able to do the following
     * mapping:
     *            Client Severity OPC Severity
     *                HIGH        801 – 1 000
     *                MEDIUM HIGH 601 – 800
     *                MEDIUM      401 – 600
     *                MEDIUM LOW  201 – 400
     *                LOW           1 – 200
     * In many cases a strict linear mapping of underlying source severities to the OPC Severity range
     * is not appropriate. The Server developer will instead intelligently map the underlying source
     * severities to the 1 to 1 000 OPC Severity range in some other fashion. In particular, it is
     * recommended that Server developers map Events of high urgency into the OPC severity range
     * of 667 to 1 000, Events of medium urgency into the OPC severity range of 334 to 666 and
     * Events of low urgency into OPC severities of 1 to 333.
     */
    /**
     * @method setSeverity
     * @param severity {UInt16}
     */
    public setSeverity(severity: UInt16): void {
        assert(isFinite(severity), "expecting a UInt16");

        // record automatically last severity
        const lastSeverity = this.getSeverity();
        this.setLastSeverity(lastSeverity);
        this._set_var("severity", DataType.UInt16, severity);
    }

    /**
     * @method getSeverity
     * @return {UInt16}
     */
    public getSeverity(): UInt16 {
        const c = this.condition as UAConditionImpl;
        assert(c.getEnabledState(), "condition must be enabled");
        const value = this._get_var("severity");
        return +value;
    }

    /*
     * as per spec 1.0.3 - part 9:
     *  LastSeverity provides the previous severity of the ConditionBranch. Initially this Variable
     *  contains a zero value; it will return a value only after a severity change. The new severity is
     *  supplied via the Severity Property which is inherited from the BaseEventType.
     *
     */
    /**
     * @method setLastSeverity
     * @param severity {UInt16}
     */
    public setLastSeverity(severity: UInt16): void {
        severity = +severity;
        return this._set_var("lastSeverity", DataType.UInt16, severity);
    }

    /**
     * @method getLastSeverity
     * @return {UInt16}
     */
    public getLastSeverity(): UInt16 {
        const value = this._get_var("lastSeverity");
        return +value;
    }

    /**
     * setReceiveTime
     *
     * (as per OPCUA 1.0.3 part 5)
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
     * @method setReceiveTime
     * @param time {Date} : UTCTime
     */
    public setReceiveTime(time: UtcTime): void {
        assert(time instanceof Date);
        return this._set_var("receiveTime", DataType.DateTime, time);
    }

    /**
     * (as per OPCUA 1.0.3 part 5)
     * Time provides the time the Event occurred. This value is set as close to the event generator as
     * possible. It often comes from the underlying system or device. Once set, intermediate OPC UA
     * Servers shall not alter the value.
     *
     * @method setTime
     * @param time {Date}
     */
    public setTime(time: Date): void {
        assert(time instanceof Date);
        return this._set_var("time", DataType.DateTime, time);
    }

    /**
     * LocalTime is a structure containing the Offset and the DaylightSavingInOffset flag. The Offset
     * specifies the time difference (in minutes) between the Time Property and the time at the location
     * in which the event was issued. If DaylightSavingInOffset is TRUE, then Standard/Daylight
     * savings time (DST) at the originating location is in effect and Offset includes the DST c orrection.
     * If FALSE then the Offset does not include DST correction and DST may or may not have been
     * in effect.
     * @method setLocalTime
     * @param localTime {TimeZone}
     */
    public setLocalTime(localTime: TimeZoneDataType): void {
        assert(localTime instanceof TimeZoneDataType);
        return this._set_var("localTime", DataType.ExtensionObject, new TimeZoneDataType(localTime));
    }

    // read only !
    public getSourceName(): LocalizedText {
        return this._get_var("sourceName");
    }

    /**
     * @method getSourceNode
     * return {NodeId}
     */
    public getSourceNode(): NodeId {
        return this._get_var("sourceNode");
    }

    /**
     * @method getEventType
     * return {NodeId}
     */
    public getEventType(): NodeId {
        return this._get_var("eventType");
    }

    public getMessage(): LocalizedText {
        return this._get_var("message");
    }

    public isCurrentBranch(): boolean {
        return sameNodeId(this._get_var("branchId"), NodeId.nullNodeId);
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
        return this._get_twoStateVariable("ackedState");
    }

    public setAckedState(ackedState: boolean): StatusCode {
        ackedState = !!ackedState;

        return _setAckedState(this, ackedState);
    }

    public getConfirmedState(): boolean {
        const acknowledgeableCondition = this.condition as UAAcknowledgeableCondition;
        assert(acknowledgeableCondition.confirmedState, "Must have a confirmed state");
        return this._get_twoStateVariable("confirmedState");
    }

    public setConfirmedStateIfExists(confirmedState: boolean): void {
        confirmedState = !!confirmedState;
        const acknowledgeableCondition = this.condition as UAAcknowledgeableCondition;
        if (!acknowledgeableCondition.confirmedState) {
            // no condition node has been defined (this is valid)
            // confirm state cannot be set
            return;
        }
        // todo deal with Error code BadConditionBranchAlreadyConfirmed
        return this._set_twoStateVariable("confirmedState", confirmedState);
    }

    public setConfirmedState(confirmedState: boolean): void {
        const acknowledgeableCondition = this.condition as UAAcknowledgeableCondition;
        assert(acknowledgeableCondition.confirmedState, "Must have a confirmed state.  Add ConfirmedState to the optionals");
        return this.setConfirmedStateIfExists(confirmedState);
    }

    // ---- Shelving
    /**
     * @class ConditionSnapshot
     */
    /**
     * @method getSuppressedState
     * @return {Boolean}
     */
    public getSuppressedState(): boolean {
        return this._get_twoStateVariable("suppressedState");
    }

    /**
     * @method setSuppressedState
     * @param suppressed {Boolean}
     */
    public setSuppressedState(suppressed: boolean): void {
        suppressed = !!suppressed;
        this._set_twoStateVariable("suppressedState", suppressed);
    }

    public getActiveState(): boolean {
        return this._get_twoStateVariable("activeState");
    }

    public setActiveState(newActiveState: boolean): StatusCode {
        // xx var activeState = self.getActiveState();
        // xx if (activeState === newActiveState) {
        // xx     return StatusCodes.Bad;
        // xx }
        this._set_twoStateVariable("activeState", newActiveState);
        return StatusCodes.Good;
    }

    // tslint:disable:no-empty
    public setShelvingState(): void {
        // todo
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
    /**
     * @class ConditionSnapshot
     * @param varName
     * @param value
     * @private
     */
    public _set_twoStateVariable(varName: string, value: boolean): void {
        value = !!value;

        const hrKey = ConditionSnapshotImpl.normalizeName(varName);
        const idKey = ConditionSnapshotImpl.normalizeName(varName) + ".id";

        const variant = new Variant({ dataType: DataType.Boolean, value });
        this._map[idKey] = variant;

        // also change varName with human readable text
        const twoStateNode = this._node_index[hrKey];
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
        this._map[hrKey] = hrValue;

        const node = this._node_index[idKey];

        // also change ConditionNode if we are on currentBranch
        if (this.isCurrentBranch()) {
            assert(twoStateNode instanceof UATwoStateVariableImpl);
            twoStateNode.setValue(value as boolean);
            // xx console.log("Is current branch", twoStateNode.toString(),variant.toString());
            // xx console.log("  = ",twoStateNode.getValue());
        }
        this.emit("value_changed", node, variant);
    }

    protected _get_twoStateVariable(varName: string): any {
        const key = ConditionSnapshotImpl.normalizeName(varName) + ".id";
        const variant = this._map[key];

        // istanbul ignore next
        if (!variant) {
            return "???";
            // throw new Error("Cannot find TwoStateVariable with name " + varName);
        }
        return variant.value;
    }
}
