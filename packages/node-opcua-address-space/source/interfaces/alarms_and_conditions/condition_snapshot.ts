import { EventEmitter } from "events";
import { Variant } from "node-opcua-variant";
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
import { UtcTime } from "../state_machine/ua_state_machine_type";

export interface ConditionSnapshot {
    on(eventName: "value_changed", eventHandler: (node: UAVariable, variant: Variant) => void): this;
}
/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */

function normalizeName(str: string): string {
    return str.split(".").map(utils.lowerFirstLetter).join(".");
}

export interface ConditionSnapshot extends EventEmitter {
    // static normalizeName = normalizeName;

    condition: BaseNode;
    eventData: IEventData| null;
    branchId: NodeId| null;

    /**
     * @method resolveSelectClause
     * @param selectClause {SelectClause}
     */
    resolveSelectClause(selectClause: SimpleAttributeOperand): NodeId | null;

    /**
     *
     */
    readValue(sessionContext: ISessionContext, nodeId: NodeId, selectClause: SimpleAttributeOperand): Variant;

    /**
     * @method getBrandId
     * @return {NodeId}
     */
    getBranchId(): NodeId;
    /**
     * @method getEventId
     * @return {ByteString}
     */
    getEventId(): Buffer;
    /**
     * @method getRetain
     * @return {Boolean}
     */
    getRetain(): boolean;
    /**
     *
     * @method setRetain
     * @param retainFlag {Boolean}
     */
    setRetain(retainFlag: boolean): void;

    /**
     * @method renewEventId
     *
     */
    renewEventId(): void;

    /**
     * @method getEnabledState
     * @return {Boolean}
     */
    getEnabledState(): boolean;
    /**
     * @method setEnabledState
     * @param value {Boolean}
     * @return void
     */
    setEnabledState(value: boolean): void;
    /**
     * @method getEnabledStateAsString
     * @return {String}
     */
    getEnabledStateAsString(): string;
    /**
     * @method getComment
     * @return {LocalizedText}
     */
    getComment(): LocalizedText;

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
    setComment(txtMessage: LocalizedTextLike): void;
    /**
     *
     * @method setMessage
     * @param txtMessage {LocalizedText}
     */
    setMessage(txtMessage: LocalizedTextLike | LocalizedText): void;

    /**
     * @method setClientUserId
     * @param userIdentity {String}
     */
    setClientUserId(userIdentity: string): void;
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
    setQuality(quality: StatusCode): void;
    /**
     * @method getQuality
     * @return {StatusCode}
     */
    getQuality(): StatusCode;
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
    setSeverity(severity: UInt16): void;

    /**
     * @method getSeverity
     * @return {UInt16}
     */
    getSeverity(): UInt16;

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
    setLastSeverity(severity: UInt16): void;
    /**
     * @method getLastSeverity
     * @return {UInt16}
     */
    getLastSeverity(): UInt16;

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
    setReceiveTime(time: UtcTime): void;
    /**
     * (as per OPCUA 1.0.3 part 5)
     * Time provides the time the Event occurred. This value is set as close to the event generator as
     * possible. It often comes from the underlying system or device. Once set, intermediate OPC UA
     * Servers shall not alter the value.
     *
     * @method setTime
     * @param time {Date}
     */
    setTime(time: Date): void;
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
    setLocalTime(localTime: TimeZoneDataType): void;

    // read only !
    getSourceName(): LocalizedText;
    /**
     * @method getSourceNode
     * return {NodeId}
     */
    getSourceNode(): NodeId;

    /**
     * @method getEventType
     * return {NodeId}
     */
    getEventType(): NodeId;
    getMessage(): LocalizedText;
    isCurrentBranch(): boolean;
    // -- ACKNOWLEDGEABLE -------------------------------------------------------------------

    getAckedState(): boolean;
    setAckedState(ackedState: boolean): StatusCode;
    getConfirmedState(): boolean;

    setConfirmedStateIfExists(confirmedState: boolean): void;
    setConfirmedState(confirmedState: boolean): void;

    // ---- Shelving
    getSuppressedState(): boolean;
    setSuppressedState(suppressed: boolean): void;

    getActiveState(): boolean;

    setActiveState(newActiveState: boolean): StatusCode;

    setShelvingState(): void;
    toString(): string;

    /**
     * @private
     */
    _constructEventData(): IEventData 
}
