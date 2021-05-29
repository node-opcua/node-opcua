/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import * as chalk from "chalk";

import { assert } from "node-opcua-assert";
import { ByteString, DateTime } from "node-opcua-basic-types";
import { randomGuid, UInt16 } from "node-opcua-basic-types";
import {
    AttributeIds,
    BrowseDirection,
    coerceLocalizedText,
    LocalizedText,
    LocalizedTextLike,
    makeAccessLevelFlag,
    NodeClass,
    QualifiedName
} from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import { minDate } from "node-opcua-factory";
import { coerceNodeId, makeNodeId, NodeId, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { TimeZoneDataType } from "node-opcua-types";
import { DataType, Variant, VariantLike } from "node-opcua-variant";

import { ConditionType, Namespace, SessionContext, UAEventType, UAMethod, UAVariableT } from "../../source";
import { ConditionInfoOptions } from "../../source/interfaces/alarms_and_conditions/condition_info_i";
import { AddressSpacePrivate } from "../address_space_private";
import { BaseNode } from "../base_node";
import { UAObject } from "../ua_object";
import { UAObjectType } from "../ua_object_type";
import { _install_TwoStateVariable_machinery, UATwoStateVariable } from "../state_machine/ua_two_state_variable";
import { UAVariable } from "../ua_variable";
import { BaseEventType } from "./base_event_type";
import { ConditionInfo } from "./condition_info";
import { ConditionSnapshot } from "./condition_snapshot";

const debugLog = make_debugLog(__filename);
const errorLog = make_errorLog(__filename);
const doDebug = checkDebugFlag(__filename);

export interface UAConditionBase extends BaseEventType {
    on(eventName: string, eventHandler: (...args: any[]) => void): this;

    // -- Events
    on(
        eventName: "addComment",
        eventHandler: (eventId: Buffer | null, comment: LocalizedText, branch: ConditionSnapshot) => void
    ): this;

    on(eventName: "branch_deleted", eventHandler: (branchId: string) => void): this;
}

export interface UAConditionBase {
    enabledState: UATwoStateVariable;
    receiveTime: UAVariableT<Date, DataType.DateTime>;
    localTime: UAVariableT<any, DataType.ExtensionObject>;
    message: UAVariableT<LocalizedText, DataType.LocalizedText>;
    severity: UAVariableT<UInt16, DataType.UInt16>;
    time: UAVariableT<DateTime, DataType.DateTime>;
    branchId: UAVariableT<NodeId, DataType.NodeId>;
    eventType: UAVariableT<NodeId, DataType.NodeId>;
    conditionClassId: UAVariableT<NodeId, DataType.NodeId>;
    conditionClassName: UAVariableT<LocalizedText, DataType.LocalizedText>;
    conditionName: UAVariableT<string, DataType.String>;
    quality: UAConditionVariable<StatusCode, DataType.StatusCode>;
    comment: UAConditionVariable<LocalizedText, DataType.LocalizedText>;
    lastSeverity: UAConditionVariable<StatusCode, DataType.StatusCode>;
    retain: UAVariableT<boolean, DataType.Boolean>;

    enable: UAMethod;
    disable: UAMethod;
    addComment: UAMethod;
}

/**
 * @class UAConditionBase
 * @constructor
 * @extends BaseEventType
 *
 *
 *   └─ ConditionType
 *    ├─ DialogConditionType
 *    └─ AcknowledgeableConditionType
 *       └─ AlarmConditionType
 *          ├─ LimitAlarmType
 *          │  ├─ ExclusiveLimitAlarmType
 *          │  │  ├─ ExclusiveLevelAlarmType
 *          │  │  ├─ ExclusiveDeviationAlarmType
 *          │  │  └─ ExclusiveRateOfChangeAlarmType
 *          │  └─ NonExclusiveLimitAlarmType
 *          │     ├─ NonExclusiveLevelAlarmType
 *          │     ├─ NonExclusiveDeviationAlarmType
 *          │     └─ NonExclusiveRateOfChangeAlarmType
 *          └─ DiscreteAlarmType
 *             ├─ OffNormalAlarmType
 *             │  ├─ SystemOffNormalAlarmType
 *             │  │  └─ CertificateExpirationAlarmType
 *             │  └─ TripAlarmType
 *
 */
export class UAConditionBase extends BaseEventType {
    public static defaultSeverity = 250;

    public static typeDefinition = resolveNodeId("ConditionType");

    public static instantiate(
        namespace: Namespace,
        conditionTypeId: NodeId | string | UAEventType,
        options: any,
        data: any
    ): UAConditionBase {
        return UAConditionBase_instantiate(namespace, conditionTypeId, options, data);
    }

    public static install_condition_refresh_handle(addressSpace: AddressSpacePrivate) {
        //
        // install ConditionRefresh
        //
        // NOTE:
        // OPCUA doesn't implement the condition refresh method ! yet
        // .5.7 ConditionRefresh Method
        // ConditionRefresh allows a Client to request a Refresh of all Condition instances that currently
        // are in an interesting state (they have the Retain flag set). This includes previous states of a
        // Condition instance for which the Server maintains Branches. A Client would typically invoke
        // this Method when it initially connects to a Server and following any situations, such as
        // communication disruptions, in which it would require resynchronization with the Server. This
        // Method is only available on the ConditionType or its subtypes. To invoke this Method, the call
        // shall pass the well known MethodId of the Method on the ConditionType and the ObjectId
        // shall be the well known ObjectId of the ConditionType Object.

        const conditionType = addressSpace.findEventType("ConditionType") as ConditionType;
        assert(conditionType !== null);

        conditionType.disable.bindMethod(_disable_method);
        conditionType.enable.bindMethod(_enable_method);

        conditionType.conditionRefresh.bindMethod(_condition_refresh_method);

        conditionType.conditionRefresh2.bindMethod(_condition_refresh2_method);

        // those methods can be call on the ConditionType or on the ConditionInstance itself...
        conditionType.addComment.bindMethod(_add_comment_method);
    }

    /**
     *
     * Helper method to handle condition methods that takes a branchId and a comment
     *
     */
    public static with_condition_method(
        inputArguments: VariantLike[],
        context: SessionContext,
        callback: (err: Error | null, result?: { statusCode: StatusCode }) => void,
        inner_func: (
            eventId: ByteString,
            comment: LocalizedText,
            branch: ConditionSnapshot,
            conditionNode: UAConditionBase
        ) => StatusCode
    ) {
        const conditionNode = context.object;

        // xx console.log(inputArguments.map(function(a){return a.toString()}));
        if (!(conditionNode instanceof UAConditionBase)) {
            callback(null, {
                statusCode: StatusCodes.BadNodeIdInvalid
            });
            return;
        }

        if (!conditionNode.getEnabledState()) {
            callback(null, {
                statusCode: StatusCodes.BadConditionDisabled
            });
            return;
        }

        // inputArguments has 2 arguments
        // EventId  => ByteString    The Identifier of the event to comment
        // Comment  => LocalizedText The Comment to add to the condition
        assert(inputArguments.length === 2);
        assert(inputArguments[0].dataType === DataType.ByteString);
        assert(inputArguments[1].dataType === DataType.LocalizedText);

        const eventId = inputArguments[0].value;
        assert(!eventId || eventId instanceof Buffer);

        const comment = inputArguments[1].value;
        assert(comment instanceof LocalizedText);

        const branch = conditionNode._findBranchForEventId(eventId);
        if (!branch) {
            callback(null, {
                statusCode: StatusCodes.BadEventIdUnknown
            });
            return;
        }
        assert(branch instanceof ConditionSnapshot);

        const statusCode = inner_func(eventId, comment, branch, conditionNode);

        // record also who did the call
        branch.setClientUserId(context.userIdentity || "<unknown client user id>");

        callback(null, {
            statusCode
        });
    }
    private _branch0: ConditionSnapshot = null as any;
    private _previousRetainFlag: boolean = false;
    private _branches: { [key: string]: ConditionSnapshot } = {};

    /**
     * @method initialize
     * @private
     */
    public initialize() {
        this._branches = {};
    }

    /**
     * @method post_initialize
     * @private
     */
    public post_initialize() {
        assert(!this._branch0);
        this._branch0 = new ConditionSnapshot(this, NodeId.nullNodeId);

        // the condition OPCUA object alway reflects the default branch states
        // so we set a mechanism that automatically keeps self in sync
        // with the default branch.

        // the implication of this convention is that interacting with the condition variable
        // shall be made by using branch0, any value change made
        // using the standard setValueFromSource mechanism will not be work properly.
        this._branch0.on("value_changed", (node: UAVariable, variant: Variant) => {
            assert(node.nodeClass === NodeClass.Variable);
            node.setValueFromSource(variant);
        });
    }

    public getBranchCount(): number {
        return Object.keys(this._branches).length;
    }

    public getBranches(): ConditionSnapshot[] {
        return Object.keys(this._branches).map((x: any) => {
            return this._branches[x];
        });
    }

    public getBranchIds(): NodeId[] {
        return this.getBranches().map((b: any) => b.getBranchId());
    }

    /**
     * @method createBranch
     * @return {ConditionSnapshot}
     */
    public createBranch(): ConditionSnapshot {
        const branchId = _create_new_branch_id();
        const snapshot = new ConditionSnapshot(this, branchId);
        this._branches[branchId.toString()] = snapshot;
        return snapshot;
    }

    /**
     *  @method deleteBranch
     *  @param branch {ConditionSnapshot}
     */
    public deleteBranch(branch: ConditionSnapshot): void {
        const key = branch.getBranchId().toString();
        assert(branch.getBranchId() !== NodeId.nullNodeId, "cannot delete branch zero");
        assert(this._branches.hasOwnProperty(key));
        delete this._branches[key];
        this.emit("branch_deleted", key);
    }

    /**
     * @method getEnabledState
     * @return {Boolean}
     */
    public getEnabledState(): boolean {
        return this.enabledState.getValue();
    }

    /**
     * @method getEnabledStateAsString
     * @return {String}
     */
    public getEnabledStateAsString(): string {
        return this.enabledState.getValueAsString();
    }

    /**
     * @method _setEnabledState
     * @param requestedEnabledState {Boolean}
     * @return {StatusCode} StatusCodes.Good if successful or BadConditionAlreadyEnabled/BadConditionAlreadyDisabled
     * @private
     */
    public _setEnabledState(requestedEnabledState: boolean): StatusCode {
        assert(typeof requestedEnabledState === "boolean");

        const enabledState = this.getEnabledState();
        if (enabledState && requestedEnabledState) {
            return StatusCodes.BadConditionAlreadyEnabled;
        }
        if (!enabledState && !requestedEnabledState) {
            return StatusCodes.BadConditionAlreadyDisabled;
        }

        this._branch0.setEnabledState(requestedEnabledState);
        // conditionNode.enabledState.setValue(requestedEnabledState);

        // xx assert(conditionNode.enabledState.id.readValue().value.value === requestedEnabledState,"sanity check 1");
        // xx assert(conditionNode.currentBranch().getEnabledState() === requestedEnabledState,"sanity check 2");

        if (!requestedEnabledState) {
            // as per Spec 1.0.3 part 9:
            // * When the Condition instance enters the Disabled state, the Retain Property of this
            // Condition shall be set to FALSE by the Server to indicate to the Client that the
            // Condition instance is currently not of interest to Clients.
            // TODO : shall we really set retain to false or artificially expose the retain false as false
            //        whist enabled state is false ?
            this._previousRetainFlag = this.currentBranch().getRetain();
            this.currentBranch().setRetain(false);

            // todo: install the mechanism by which all condition values will be return
            // as Null | BadConditionDisabled;
            const statusCode = StatusCodes.BadConditionDisabled;

            // a notification must be send
            this.raiseConditionEvent(this.currentBranch(), true);
        } else {
            // * When the Condition instance enters the enabled state, the Condition shall be
            //  evaluated and all of its Properties updated to reflect the current values. If this
            //  evaluation causes the Retain Property to transition to TRUE for any ConditionBranch,
            //  then an Event Notification shall be generated for that ConditionBranch.

            this.evaluateConditionsAfterEnabled();

            // todo evaluate branches
            // conditionNode.evaluateBranches();

            // restore retain flag
            if (this.hasOwnProperty("_previousRetainFlag")) {
                this.currentBranch().setRetain(this._previousRetainFlag);
            }

            // todo send notification for branches with retain = true
            let nb_condition_resent = 0;
            if (this.currentBranch().getRetain()) {
                nb_condition_resent += this._resend_conditionEvents();
            }

            if (nb_condition_resent === 0) {
                // a notification must be send
                this.raiseConditionEvent(this.currentBranch(), true);
            }
        }
        return StatusCodes.Good;
    }

    /**
     *
     * @method setEnabledState
     * @param requestedEnabledState {Boolean}
     * @private
     */
    public setEnabledState(requestedEnabledState: boolean): StatusCode {
        return this._setEnabledState(requestedEnabledState);
    }

    /**
     * @method setReceiveTime
     * @param time {Date}
     */
    public setReceiveTime(time: Date) {
        return this._branch0.setReceiveTime(time);
    }

    /**
     * @method setLocalTime (optional)
     * @param time
     */
    public setLocalTime(time: TimeZoneDataType) {
        return this._branch0.setLocalTime(time);
    }

    /**
     * @method setTime
     * @param time {Date}
     */
    public setTime(time: Date) {
        return this._branch0.setTime(time);
    }

    public _assert_valid() {
        assert(this.receiveTime.readValue().value.dataType === DataType.DateTime);
        assert(this.receiveTime.readValue().value.value instanceof Date);

        assert(this.message.readValue().value.dataType === DataType.LocalizedText);
        assert(this.severity.readValue().value.dataType === DataType.UInt16);

        assert(this.time.readValue().value.dataType === DataType.DateTime);
        assert(this.time.readValue().value.value instanceof Date);

        assert(this.quality.readValue().value.dataType === DataType.StatusCode);

        assert(this.enabledState.readValue().value.dataType === DataType.LocalizedText);
        assert(this.branchId.readValue().value.dataType === DataType.NodeId);

        // note localTime has been made optional in 1.04
        assert(!this.localTime || this.localTime.readValue().value.dataType === DataType.ExtensionObject);
    }

    /**
     * @method conditionOfNode
     * @return {UAObject}
     */
    public conditionOfNode(): UAObject | UAVariable | null {
        const refs = this.findReferencesExAsObject("HasCondition", BrowseDirection.Inverse);
        if (refs.length === 0) {
            return null;
        }
        assert(refs.length !== 0, "UAConditionBase must be the condition of some node");
        assert(refs.length === 1, "expecting only one ConditionOf");
        const node = refs[0];
        assert(
            node.nodeClass === NodeClass.Object || node.nodeClass === NodeClass.Variable,
            "node for which we are the condition shall be an UAObject or UAVariable"
        );
        return node as UAObject | UAVariable;
    }

    /**
     * @method raiseConditionEvent
     * Raise a Instance Event
     * (see also UAObject#raiseEvent to raise a transient event)
     * @param branch the condition branch to raise
     * @param renewEventId true if event Id of the condition branch should be renewed
     */
    public raiseConditionEvent(branch: ConditionSnapshot, renewEventId: boolean): void {
        assert(arguments.length === 2, "expecting 2 arguments");
        if (renewEventId) {
            branch.renewEventId();
        }

        // xx console.log("MMMMMMMM%%%%%%%%%%%%%%%%%%%%% branch  " +
        // branch.getBranchId().toString() + " eventId = " + branch.getEventId().toString("hex"));

        assert(branch instanceof ConditionSnapshot);

        this._assert_valid();

        // In fact the event is raised by the object of which we are the condition
        const conditionOfNode = this.conditionOfNode();

        if (conditionOfNode) {
            const eventData = branch._constructEventData();

            this.emit("event", eventData);

            if (conditionOfNode instanceof UAObject) {
                // xx assert(conditionOfNode.eventNotifier === 0x01);
                conditionOfNode._bubble_up_event(eventData);
            } else {
                assert(conditionOfNode.nodeClass === NodeClass.Variable);
                // in this case
                const eventOfs = conditionOfNode.getEventSourceOfs();
                assert(eventOfs.length === 1);
                const node = eventOfs[0] as UAObject;
                assert(node instanceof UAObject);
                node._bubble_up_event(eventData);
            }
        }
        // xx console.log("MMMMMMMM%%%%%%%%%%%%%%%%%%%%% branch  " +
        // branch.getBranchId().toString() + " eventId = " + branch.getEventId().toString("hex"));
    }

    /**
     *
     * @method raiseNewCondition
     * @param conditionInfo {ConditionInfo}
     *
     */
    public raiseNewCondition(conditionInfo: ConditionInfoOptions): void {
        if (!this.getEnabledState()) {
            throw new Error("UAConditionBase#raiseNewCondition Condition is not enabled");
        }

        conditionInfo = conditionInfo || {};

        conditionInfo.severity = conditionInfo.hasOwnProperty("severity")
            ? conditionInfo.severity
            : UAConditionBase.defaultSeverity;

        // only valid for ConditionObjects
        // todo check that object is of type ConditionType

        const addressSpace = this.addressSpace;

        const selfConditionType = this.typeDefinitionObj;
        const conditionType = addressSpace.findObjectType("ConditionType")!;
        assert(selfConditionType.isSupertypeOf(conditionType));

        const branch = this.currentBranch();

        const now = new Date();
        // install the eventTimestamp
        // set the received Time
        branch.setTime(now);
        branch.setReceiveTime(now);

        // note : in 1.04 LocalTime property is optional
        if (this.hasOwnProperty("localTime")) {
            branch.setLocalTime(
                new TimeZoneDataType({
                    daylightSavingInOffset: false,
                    offset: 0
                })
            );
        }

        if (conditionInfo.hasOwnProperty("message") && conditionInfo.message) {
            branch.setMessage(conditionInfo.message);
        }
        // todo receive time : when the server received the event from the underlying system.
        // self.receiveTime.setValueFromSource();

        if (conditionInfo.hasOwnProperty("severity") && conditionInfo.severity !== null) {
            assert(isFinite(conditionInfo.severity!));
            branch.setSeverity(conditionInfo.severity!);
        }
        if (conditionInfo.hasOwnProperty("quality") && conditionInfo.quality !== null) {
            assert(conditionInfo.quality instanceof StatusCode);
            branch.setQuality(conditionInfo.quality!);
        }
        if (conditionInfo.hasOwnProperty("retain") && conditionInfo.retain !== null) {
            assert(typeof conditionInfo.retain === "boolean");
            branch.setRetain(!!conditionInfo.retain!);
        }

        this.raiseConditionEvent(branch, true);
    }

    public raiseNewBranchState(branch: ConditionSnapshot): void {
        this.raiseConditionEvent(branch, true);

        if (branch.getBranchId() !== NodeId.nullNodeId && !branch.getRetain()) {
            // xx console.log(" Deleting not longer needed branch ", branch.getBranchId().toString());
            // branch can be deleted
            this.deleteBranch(branch);
        }
    }

    /**
     * @method currentBranch
     * @return {ConditionSnapshot}
     */
    public currentBranch(): ConditionSnapshot {
        return this._branch0;
    }

    public _resend_conditionEvents() {
        // for the time being , only current branch
        const currentBranch = this.currentBranch();
        if (currentBranch.getRetain()) {
            debugLog(" resending condition event for " + this.browseName.toString());
            this.raiseConditionEvent(currentBranch, false);
            return 1;
        }
        return 0;
    }

    // ------------------------------------------------------------------------------------
    // Acknowledgeable
    // ------------------------------------------------------------------------------------
    /**
     * @method _raiseAuditConditionCommentEvent
     * @param sourceName {string}
     * @param conditionEventId    {Buffer}
     * @param comment    {LocalizedText}
     * @private
     */
    public _raiseAuditConditionCommentEvent(sourceName: string, conditionEventId: Buffer, comment: LocalizedTextLike) {
        assert(conditionEventId === null || conditionEventId instanceof Buffer);
        assert(comment instanceof LocalizedText);
        const server = this.addressSpace.rootFolder.objects.server;

        const now = new Date();

        // xx if (true || server.isAuditing) {
        // ----------------------------------------------------------------------------------------------------
        server.raiseEvent("AuditConditionCommentEventType", {
            // AuditEventType
            /* part 5 -  6.4.3 AuditEventType */
            actionTimeStamp: {
                dataType: "DateTime",
                value: now
            },
            status: {
                dataType: "Boolean",
                value: true
            },

            serverId: {
                dataType: "String",
                value: ""
            },

            // ClientAuditEntryId contains the human-readable AuditEntryId defined in Part 3.
            clientAuditEntryId: {
                dataType: "String",
                value: ""
            },

            // The ClientUserId identifies the user of the client requesting an action. The ClientUserId can be
            // obtained from the UserIdentityToken passed in the ActivateSession call.
            clientUserId: {
                dataType: "String",
                value: ""
            },
            sourceName: {
                dataType: "String",
                value: sourceName
            },

            // AuditUpdateMethodEventType
            methodId: {
                dataType: "Null"
            },

            inputArguments: {
                dataType: "Null"
            },

            // AuditConditionCommentEventType
            conditionEventId: {
                dataType: "ByteString",
                value: conditionEventId
            },

            comment: {
                dataType: "LocalizedText",
                value: comment
            }
        });
        // xx }
    }

    protected _findBranchForEventId(eventId: Buffer): ConditionSnapshot | null {
        const conditionNode = this;
        if (sameBuffer(conditionNode.eventId!.readValue().value.value, eventId)) {
            return conditionNode.currentBranch();
        }
        const e = Object.values(conditionNode._branches).filter((branch: ConditionSnapshot) =>
            sameBuffer(branch.getEventId(), eventId)
        );
        if (e.length === 1) {
            return e[0];
        }
        assert(e.length === 0, "cannot have 2 branches with same eventId");
        return null; // not found
    }

    protected evaluateConditionsAfterEnabled() {
        assert(this.getEnabledState() === true);
        throw new Error("Unimplemented , please override");
    }
}
export interface UAConditionBase extends BaseEventType {
    eventId: UAVariable;
}

/**
 * instantiate a Condition.
 * this will create the unique EventId and will set eventType
 * @method instantiate
 * @param namespace {Namespace}
 * @param conditionTypeId          {String|NodeId}  the EventType to instantiate
 * @param options                  {object}
 * @param options.browseName       {String|QualifiedName}
 * @param options.componentOf      {NodeId|UAObject}
 * @param options.conditionOf      {NodeId|UAObject} Mandatory
 * @param options.organizedBy      {NodeId|UAObject} ( only provide componentOf or organizedBy but not both)
 * @param [options.conditionClass =BaseConditionClassType]  {NodeId|UAObject}
 *                                 The condition Class nodeId or object used to set the ConditionClassId and
 *                                 ConditionClassName properties of the condition.
 *
 * @param options.conditionSource  {NodeId|UAObject} the condition source node.
 *                                                   this node must be marked a EventSource.
 *                                                   the conditionSource is used to populate the sourceNode and
 *                                                   sourceName variables defined by BaseEventType
 * @param options.conditionName    {String} the condition Name
 * @param [options.optionals]      [Array<String>]   an Array of optionals fields
 *
 * @param data                 a object containing the value to set
 * @param data.eventId {String|NodeId}  the EventType Identifier to instantiate (type cannot be abstract)
 * @return  a instantiated UAConditionBase
 */
function UAConditionBase_instantiate(
    namespace: Namespace,
    conditionTypeId: UAEventType | NodeId | string,
    options: any,
    data: any
): UAConditionBase {
    /* eslint max-statements: ["error", 100] */
    const addressSpace = namespace.addressSpace as AddressSpacePrivate;

    const conditionType = addressSpace.findEventType(conditionTypeId);

    /* istanbul ignore next */
    if (!conditionType) {
        throw new Error(" cannot find Condition Type for " + conditionTypeId);
    }

    // reminder : abstract event type cannot be instantiated directly !
    assert(!conditionType.isAbstract, "Cannot instantiate abstract conditionType");

    const baseConditionEventType = addressSpace.findEventType("ConditionType");
    /* istanbul ignore next */
    if (!baseConditionEventType) {
        throw new Error("cannot find  ConditionType");
    }

    assert(conditionType.isSupertypeOf(baseConditionEventType));

    // assert((typeof options.browseName === "string"));
    options.browseName = options.browseName || "??? instantiateCondition - missing browseName";

    options.optionals = options.optionals || [];

    // now optionals in 1.04
    options.optionals.push("EventType");
    options.optionals.push("BranchId");

    //
    options.optionals.push("Comment");
    options.optionals.push("Comment.SourceTimestamp");
    options.optionals.push("EnabledState.TrueState");
    options.optionals.push("EnabledState.TrueState");
    options.optionals.push("EnabledState.FalseState");

    options.optionals.push("EnabledState.TransitionTime");
    options.optionals.push("EnabledState.EffectiveTransitionTime");
    options.optionals.push("EnabledState.EffectiveDisplayName");

    const conditionNode = (conditionType.instantiate(options) as any) as UAConditionBase;
    Object.setPrototypeOf(conditionNode, UAConditionBase.prototype);
    conditionNode.initialize();

    assert(options.hasOwnProperty("conditionSource"), "must specify a condition source either as null or as a UAObject");
    if (!options.conditionOf) {
        options.conditionOf = options.conditionSource;
    }
    if (options.conditionOf) {
        assert(options.hasOwnProperty("conditionOf")); // must provide a conditionOf
        options.conditionOf = addressSpace._coerceNode(options.conditionOf);

        // HasCondition References can be used in the Type definition of an Object or a Variable.
        assert(options.conditionOf.nodeClass === NodeClass.Object || options.conditionOf.nodeClass === NodeClass.Variable);

        conditionNode.addReference({
            isForward: false,
            nodeId: options.conditionOf,
            referenceType: "HasCondition"
        });
        assert(conditionNode.conditionOfNode()!.nodeId === options.conditionOf.nodeId);
    }

    // the constant property of this condition
    conditionNode.eventType.setValueFromSource({
        dataType: DataType.NodeId,
        value: conditionType.nodeId
    });

    data = data || {};
    // install initial branch ID (null NodeId);
    conditionNode.branchId.setValueFromSource({
        dataType: DataType.NodeId,
        value: NodeId.nullNodeId
    });

    // install 'Comment' condition variable
    _install_condition_variable_type(conditionNode.comment);

    // install 'Quality' condition variable
    _install_condition_variable_type(conditionNode.quality);
    // xx conditionNode.quality.setValueFromSource({dataType: DataType.StatusCode,value: StatusCodes.Good });

    // install 'LastSeverity' condition variable
    _install_condition_variable_type(conditionNode.lastSeverity);
    // xx conditionNode.severity.setValueFromSource({dataType: DataType.UInt16,value: 0 });
    // xx conditionNode.lastSeverity.setValueFromSource({dataType: DataType.UInt16,value: 0 });

    // install  'EnabledState' TwoStateVariable
    /**
     *  @property enabledState
     *  @type {UATwoStateVariable}
     */
    // -------------- fixing missing EnabledState.EffectiveDisplayName
    if (!conditionNode.enabledState.effectiveDisplayName) {
        namespace.addVariable({
            browseName: new QualifiedName({ namespaceIndex: 0, name: "EffectiveDisplayName" }),
            dataType: "LocalizedText",
            propertyOf: conditionNode.enabledState
        });
    }
    _install_TwoStateVariable_machinery(conditionNode.enabledState, {
        falseState: "Disabled",
        trueState: "Enabled"
    });

    // installing sourceName and sourceNode
    conditionNode.enabledState.setValue(true);

    // set properties to in initial values
    Object.keys(data).forEach((key: string) => {
        const varNode = _getCompositeKey(conditionNode, key);
        assert(varNode.nodeClass === NodeClass.Variable);

        const variant = new Variant(data[key]);

        // check that Variant DataType is compatible with the UAVariable dataType
        // xx var nodeDataType = addressSpace.findNode(varNode.dataType).browseName;

        /* istanbul ignore next */
        if (!varNode._validate_DataType(variant.dataType)) {
            throw new Error(" Invalid variant dataType " + variant + " " + varNode.browseName.toString());
        }

        const value = new Variant(data[key]);

        varNode.setValueFromSource(value);
    });

    // bind condition methods -
    /**
     *  @property enable
     *  @type {UAMethod}
     */
    conditionNode.enable.bindMethod(_enable_method);

    /**
     *  @property disable
     *  @type {UAMethod}
     */
    conditionNode.disable.bindMethod(_disable_method);

    // bind condition methods - AddComment
    /**
     *  @property addComment
     *  @type {UAMethod}
     */
    conditionNode.addComment.bindMethod(_add_comment_method);

    assert(conditionNode instanceof UAConditionBase);

    // ConditionSource => cf SourceNode
    //  As per spec OPCUA 1.03 part 9 page 54:
    //    The ConditionType inherits all Properties of the BaseEventType. Their semantic is defined in
    //    Part 5. SourceNode identifies the ConditionSource.
    //    The SourceNode is the Node which the condition is associated with, it may be the same as the
    //    InputNode for an alarm, but it may be a separate node. For example a motor, which is a
    //    variable with a value that is an RPM, may be the ConditionSource for Conditions that are
    //    related to the motor as well as a temperature sensor associated with the motor. In the former
    //    the InputNode for the High RPM alarm is the value of the Motor RPM, while in the later the
    //    InputNode of the High Alarm would be the value of the temperature sensor that is associated
    //    with the motor.

    if (options.conditionSource) {
        options.conditionSource = addressSpace._coerceNode(options.conditionSource);
        if (options.conditionSource.nodeClass !== NodeClass.Object && options.conditionSource.nodeClass !== NodeClass.Variable) {
            // tslint:disable:no-console
            console.log(options.conditionSource);
            throw new Error("Expecting condition source to be NodeClass.Object or Variable");
        }

        const conditionSourceNode = addressSpace.findNode(options.conditionSource.nodeId) as BaseNode;
        if (conditionSourceNode) {
            conditionNode.sourceNode.setValueFromSource({
                dataType: DataType.NodeId,
                value: conditionSourceNode.nodeId
            });

            // conditionSourceNode node must be registered as a EventSource of an other node.
            // As per spec OPCUA 1.03 part 9 page 54:
            //   HasNotifier and HasEventSource References are used to expose the hierarchical organization
            //   of Event notifying Objects and ConditionSources. An Event notifying Object represents
            //   typically an area of Operator responsibility.  The definition of such an area configuration is
            //   outside the scope of this standard. If areas are available they shall be linked together and
            //   with the included ConditionSources using the HasNotifier and the HasEventSource Reference
            //   Types. The Server Object shall be the root of this hierarchy.
            if (!sameNodeId(conditionSourceNode.nodeId, coerceNodeId("ns=0;i=2253"))) {
                // server object
                /* istanbul ignore next */
                if (conditionSourceNode.getEventSourceOfs().length === 0) {
                    errorLog("conditionSourceNode = ", conditionSourceNode.browseName.toString());
                    errorLog("conditionSourceNode = ", conditionSourceNode.nodeId.toString());
                    throw new Error(
                        "conditionSourceNode must be an event source " +
                            conditionSourceNode.browseName.toString() +
                            conditionSourceNode.nodeId.toString()
                    );
                }
            }

            // set source Node (defined in UABaseEventType)
            conditionNode.sourceNode.setValueFromSource(conditionSourceNode.readAttribute(null, AttributeIds.NodeId).value);

            // set source Name (defined in UABaseEventType)
            conditionNode.sourceName.setValueFromSource(conditionSourceNode.readAttribute(null, AttributeIds.DisplayName).value);
        }
    }

    conditionNode.eventType.setValueFromSource({
        dataType: DataType.NodeId,
        value: conditionType.nodeId
    });
    // as per spec:

    /**
     *
     *  dataType: DataType.NodeId
     *
     *  As per spec OPCUA 1.03 part 9:
     *    ConditionClassId specifies in which domain this Condition is used. It is the NodeId of the
     *    corresponding ConditionClassType. See 5.9 for the definition of ConditionClass and a set of
     *    ConditionClasses defined in this standard. When using this Property for filtering, Clients have
     *    to specify all individual ConditionClassType NodeIds. The OfType operator cannot be applied.
     *    BaseConditionClassType is used as class whenever a Condition cannot be assigned to a
     *    more concrete class.
     *
     *                         BaseConditionClassType
     *                                   |
     *                      +---------------------------+----------------------------+
     *                     |                           |                             |
     *            ProcessConditionClassType  MaintenanceConditionClassType  SystemConditionClassType
     *
     *  @property conditionName
     *  @type {UAVariable}
     */
    const baseConditionClassType = addressSpace.findObjectType("ProcessConditionClassType");
    // assert(baseConditionClassType,"Expecting BaseConditionClassType to be in addressSpace");
    let conditionClassId = baseConditionClassType ? baseConditionClassType.nodeId : NodeId.nullNodeId;
    let conditionClassName = baseConditionClassType ? baseConditionClassType.displayName[0] : "";
    if (options.conditionClass) {
        if (typeof options.conditionClass === "string") {
            options.conditionClass = addressSpace.findObjectType(options.conditionClass);
        }
        const conditionClassNode = addressSpace._coerceNode(options.conditionClass);
        if (!conditionClassNode) {
            throw new Error("cannot find condition class " + options.conditionClass.toString());
        }
        conditionClassId = conditionClassNode.nodeId;
        conditionClassName = conditionClassNode.displayName[0];
    }

    conditionNode.conditionClassId.setValueFromSource({
        dataType: DataType.NodeId,
        value: conditionClassId
    });

    // as per spec:
    //  ConditionClassName provides the display name of the ConditionClassType.
    conditionNode.conditionClassName.setValueFromSource({
        dataType: DataType.LocalizedText,
        value: coerceLocalizedText(conditionClassName)
    });

    // as per spec:
    /**
     *
     * dataType: DataType.String
     *
     * As per spec OPCUA 1.03 part 9:
     *   ConditionName identifies the Condition instance that the Event originated from. It can be used
     *   together with the SourceName in a user display to distinguish between different Condition
     *   instances. If a ConditionSource has only one instance of a ConditionType, and the Server has
     *   no instance name, the Server shall supply the ConditionType browse name.
     * @property conditionName
     * @type {UAVariable}
     */
    const conditionName = options.conditionName || "Unset Condition Name";
    assert(typeof conditionName === "string");
    conditionNode.conditionName.setValueFromSource({
        dataType: DataType.String,
        value: conditionName
    });

    // set SourceNode and SourceName based on HasCondition node
    const sourceNodes = conditionNode.findReferencesAsObject("HasCondition", false);
    if (sourceNodes.length) {
        assert(sourceNodes.length === 1);
        conditionNode.setSourceNode(sourceNodes[0].nodeId);
        conditionNode.setSourceName(sourceNodes[0].browseName.toString());
    }

    conditionNode.post_initialize();

    const branch0 = conditionNode.currentBranch();
    branch0.setRetain(false);
    branch0.setComment("");
    branch0.setQuality(StatusCodes.Good);
    branch0.setSeverity(0);
    branch0.setLocalTime(
        new TimeZoneDataType({
            daylightSavingInOffset: false,
            offset: 0
        })
    );
    branch0.setMessage("");

    branch0.setReceiveTime(minDate);
    branch0.setTime(minDate);

    // UAConditionBase
    return conditionNode;
}

function _disable_method(inputArguments: VariantLike[], context: SessionContext, callback: any) {
    assert(inputArguments.length === 0);

    const conditionNode = context.object;
    assert(conditionNode);

    // istanbul ignore next
    if (!(conditionNode instanceof UAConditionBase)) {
        console.log("conditionNode is not a UAConditionBase ", conditionNode.toString())
        return callback(null, {
            statusCode: StatusCodes.BadNodeIdInvalid
        });
    }
    const statusCode = conditionNode._setEnabledState(false);
    return callback(null, {
        statusCode
    });
}

function _enable_method(inputArguments: VariantLike[], context: SessionContext, callback: any) {
    assert(inputArguments.length === 0);
    const conditionNode = context.object;
    assert(conditionNode);

    if (!(conditionNode instanceof UAConditionBase)) {
        return callback(null, {
            statusCode: StatusCodes.BadNodeIdInvalid
        });
    }
    const statusCode = conditionNode._setEnabledState(true);
    return callback(null, {
        statusCode
    });
}

function _condition_refresh_method(inputArguments: VariantLike[], context: SessionContext, callback: any) {
    // arguments : IntegerId SubscriptionId
    assert(inputArguments.length === 1);

    const addressSpace = context.object.addressSpace;
    if (doDebug) {
        debugLog(chalk.red(" ConditionType.ConditionRefresh ! subscriptionId ="), inputArguments[0].toString());
    }
    const subscriptionId = inputArguments[0].value;

    let statusCode = _check_subscription_id_is_valid(subscriptionId, context);
    if (statusCode !== StatusCodes.Good) {
        return statusCode;
    }

    statusCode = _perform_condition_refresh(addressSpace, inputArguments, context);
    return callback(null, {
        statusCode
    });
}

function _perform_condition_refresh(addressSpace: AddressSpacePrivate, inputArguments: VariantLike[], context: SessionContext) {
    // --- possible StatusCodes:
    //
    // Bad_SubscriptionIdInvalid  See Part 4 for the description of this result code
    // Bad_RefreshInProgress      See Table 74 for the description of this result code
    // Bad_UserAccessDenied       The Method was not called in the context of the Session
    //                            that owns the Subscription
    //

    // istanbul ignore next
    if (addressSpace._condition_refresh_in_progress) {
        // a refresh operation is already in progress....
        return StatusCodes.BadRefreshInProgress;
    }

    addressSpace._condition_refresh_in_progress = true;

    const server = context.object.addressSpace.rootFolder.objects.server;
    assert(server instanceof UAObject);

    const refreshStartEventType = addressSpace.findEventType("RefreshStartEventType");
    const refreshEndEventType = addressSpace.findEventType("RefreshEndEventType");

    assert(refreshStartEventType instanceof UAObjectType);
    assert(refreshEndEventType instanceof UAObjectType);

    server.raiseEvent(refreshStartEventType, {});
    // todo : resend retained conditions

    // starting from server object ..
    // evaluated all --> hasNotifier/hasEventSource -> node
    server._conditionRefresh();

    server.raiseEvent(refreshEndEventType, {});

    addressSpace._condition_refresh_in_progress = false;

    return StatusCodes.Good;
}

function _condition_refresh2_method(inputArguments: VariantLike[], context: SessionContext, callback: any) {
    // arguments : IntegerId SubscriptionId
    // arguments : IntegerId MonitoredItemId
    assert(inputArguments.length === 2);

    const addressSpace = context.object.addressSpace;

    // istanbul ignore next
    if (doDebug) {
        debugLog(chalk.cyan.bgWhite(" ConditionType.conditionRefresh2 !"));
    }

    // xx var subscriptionId = inputArguments[0].value;
    // xx var monitoredItemId = inputArguments[1].value;

    const statusCode = _perform_condition_refresh(addressSpace, inputArguments, context);
    return callback(null, {
        statusCode
    });
}

function _add_comment_method(inputArguments: VariantLike[], context: SessionContext, callback: any) {
    //
    // The AddComment Method is used to apply a comment to a specific state of a Condition
    // instance. Normally, the NodeId of the object instance as the ObjectId is passed to the Call
    // Service. However, some Servers do not expose Condition instances in the AddressSpace.
    // Therefore all Servers shall also allow Clients to call the AddComment Method by specifying
    // ConditionId as the ObjectId. The Method cannot be called with an ObjectId of the
    // ConditionType Node.
    // Signature
    //   - EventId EventId identifying a particular Event Notification where a state was reported for a
    //             Condition.
    //   - Comment A localized text to be applied to the Condition.
    //
    // AlwaysGeneratesEvent  AuditConditionCommentEventType
    //
    UAConditionBase.with_condition_method(
        inputArguments,
        context,
        callback,
        (conditionEventId: ByteString, comment: LocalizedText, branch: ConditionSnapshot, conditionNode: UAConditionBase) => {
            assert(inputArguments instanceof Array);
            assert(conditionEventId instanceof Buffer || conditionEventId === null);
            assert(branch instanceof ConditionSnapshot);
            branch.setComment(comment);

            const sourceName = "Method/AddComment";

            conditionNode._raiseAuditConditionCommentEvent(sourceName, conditionEventId, comment);

            // raise new event
            conditionNode.raiseConditionEvent(branch, true);

            /**
             * raised when the  branch has been added a comment
             * @event addComment
             * @param  conditionEventId   NodeId|null
             * @param  comment   {LocalizedText}
             * @param  branch    {ConditionSnapshot}
             */
            conditionNode.emit("addComment", conditionEventId, comment, branch);

            return StatusCodes.Good;
        }
    );
}

function sameBuffer(b1: Buffer | null, b2: Buffer | null) {
    if (!b1 && !b2) {
        return true;
    }
    if (b1 && !b2) {
        return false;
    }
    if (!b1 && b2) {
        return false;
    }
    assert(b1 instanceof Buffer);
    assert(b2 instanceof Buffer);
    if (b1!.length !== b2!.length) {
        return false;
    }
    /*
        var bb1 = (Buffer.from(b1)).toString("hex");
        var bb2 = (Buffer.from(b2)).toString("hex");
        return bb1 === bb2;
    */
    const n = b1!.length;
    for (let i = 0; i < n; i++) {
        if (b1![i] !== b2![i]) {
            return false;
        }
    }
    return true;
}

function _create_new_branch_id() {
    return makeNodeId(randomGuid(), 1);
}

interface UAConditionVariable<T, DT extends DataType> extends UAVariableT<T, DT> {
    sourceTimestamp: UAVariableT<DateTime, DataType.DateTime>;
}

function _update_sourceTimestamp<T, DT extends DataType>(this: UAConditionVariable<T, DT>, dataValue: DataValue /*, indexRange*/) {
    this.sourceTimestamp.setValueFromSource({
        dataType: DataType.DateTime,
        value: dataValue.sourceTimestamp
    });
}

// tslint:disable:no-console
function _install_condition_variable_type<T, DT extends DataType>(node: UAConditionVariable<T, DT>) {
    assert(node instanceof BaseNode);
    // from spec 1.03 : 5.3 condition variables
    // However,  a change in their value is considered important and supposed to trigger
    // an Event Notification. These information elements are called ConditionVariables.
    if (node.sourceTimestamp) {
        node.sourceTimestamp.accessLevel = makeAccessLevelFlag("CurrentRead");
    } else {
        console.warn("cannot find node.sourceTimestamp", node.browseName.toString());
    }
    node.accessLevel = makeAccessLevelFlag("CurrentRead");

    // from spec 1.03 : 5.3 condition variables
    // a condition VariableType has a sourceTimeStamp exposed property
    // SourceTimestamp indicates the time of the last change of the Value of this ConditionVariable.
    // It shall be the same time that would be returned from the Read Service inside the DataValue
    // structure for the ConditionVariable Value Attribute.

    assert(node.typeDefinitionObj.browseName.toString() === "ConditionVariableType");
    assert(node.sourceTimestamp.browseName.toString() === "SourceTimestamp");
    node.on("value_changed", _update_sourceTimestamp);
}

/**
 * @method _getCompositeKey
 * @param node {BaseNode}
 * @param key {String}
 * @return {BaseNode}
 * @private
 *
 * @example
 *
 *     var node  = _getComposite(node,"enabledState.id");
 *
 */
function _getCompositeKey(node: BaseNode, key: string): UAVariable {
    let cur = node as any;
    const elements = key.split(".");
    for (const e of elements) {
        // istanbul ignore next
        if (!cur.hasOwnProperty(e)) {
            throw new Error(" cannot extract '" + key + "' from " + node.browseName.toString());
        }
        cur = (cur as any)[e];
    }
    return cur as UAVariable;
}

/**
 * verify that the subscription id belongs to the session that make the call.
 * @method _check_subscription_id_is_valid
 * @param subscriptionId {Number}
 * @param context {Object}
 * @private
 */
function _check_subscription_id_is_valid(subscriptionId: number, context: SessionContext) {
    /// todo: return StatusCodes.BadSubscriptionIdInvalid; if subscriptionId doesn't belong to session...
    return StatusCodes.Good;
}
