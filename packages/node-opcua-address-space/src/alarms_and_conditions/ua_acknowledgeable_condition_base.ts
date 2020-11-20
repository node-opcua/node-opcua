/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import { assert } from "node-opcua-assert";
import { LocalizedText, LocalizedTextLike } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, VariantLike } from "node-opcua-variant";
import { Namespace, RaiseEventData, SessionContext, UAEventType } from "../../source";
import { AddressSpacePrivate } from "../address_space_private";
import { NamespacePrivate } from "../namespace_private";
import { UAMethod } from "../ua_method";
import { _install_TwoStateVariable_machinery, UATwoStateVariable } from "../state_machine/ua_two_state_variable";
import { UAVariable } from "../ua_variable";
import { _setAckedState } from "./condition";
import { ConditionSnapshot } from "./condition_snapshot";
import { UAConditionBase } from "./ua_condition_base";

export interface UAAcknowledgeableConditionBase extends UAConditionBase {
    ackedState: UATwoStateVariable;
    acknowledge: UAMethod;
    confirmedState?: UATwoStateVariable;
    confirm?: UAMethod;
}

export interface UAAcknowledgeableConditionBase extends UAConditionBase {
    on(eventName: string, eventHandler: (...args: any[]) => void): this;

    on(
        eventName: "acknowledged" | "confirmed",
        eventHandler: (eventId: Buffer | null, comment: LocalizedText, branch: ConditionSnapshot) => void
    ): this;
}

/**
 * @class UAAcknowledgeableConditionBase
 * @constructor
 * @extends UAConditionBase
 */
export class UAAcknowledgeableConditionBase extends UAConditionBase {
    /**
     */
    public static instantiate(
        namespace: Namespace,
        conditionTypeId: UAEventType | NodeId | string,
        options: any,
        data: any
    ): UAAcknowledgeableConditionBase {
        const conditionNode = UAConditionBase.instantiate(
            namespace,
            conditionTypeId,
            options,
            data
        ) as UAAcknowledgeableConditionBase;

        Object.setPrototypeOf(conditionNode, UAAcknowledgeableConditionBase.prototype);

        // ----------------------- Install Acknowledge-able Condition stuff
        // install ackedState - Mandatory
        /**
         * @property ackedState
         * @type TwoStateVariable
         */
        _install_TwoStateVariable_machinery(conditionNode.ackedState, {
            falseState: "Unacknowledged",
            trueState: "Acknowledged"
        });

        /**
         * @property acknowledge
         * @type UAMethod
         */
        conditionNode.acknowledge.bindMethod(_acknowledge_method);

        // install confirmedState - Optional
        /**
         * @property confirmedState
         * @type TwoStateVariable
         */
        if (conditionNode.confirmedState) {
            _install_TwoStateVariable_machinery(conditionNode.confirmedState, {
                falseState: "Unconfirmed",
                trueState: "Confirmed"
            });
        }

        // install confirm Method - Optional
        /**
         * @property confirm
         * @type UAMethod
         */
        if (conditionNode.confirm) {
            conditionNode.confirm.bindMethod(_confirm_method);
        }
        assert(conditionNode instanceof UAAcknowledgeableConditionBase);
        return conditionNode;
    }

    public static install_method_handle_on_type(addressSpace: AddressSpacePrivate) {
        const acknowledgeableConditionType = addressSpace.findEventType("AcknowledgeableConditionType");
        assert(acknowledgeableConditionType !== null);
        (acknowledgeableConditionType as any).acknowledge.bindMethod(_acknowledge_method);
        (acknowledgeableConditionType as any).confirm.bindMethod(_confirm_method);
    }

    public _raiseAuditConditionAcknowledgeEvent(branch: ConditionSnapshot): void {
        // raise the AuditConditionAcknowledgeEventType
        const eventData: RaiseEventData = {
            actionTimeStamp: { dataType: DataType.DateTime, value: new Date() },
            // xx branchId: branch.branchId.readValue().value,

            // AuditEventType
            clientAuditEntryId: {
                dataType: DataType.Null
            },

            clientUserId: {
                dataType: DataType.Null
            },

            // The ConditionEventId field shall contain the id of the event for which the comment was added
            conditionEventId: { dataType: DataType.ByteString, value: branch.getEventId() },

            // The Comment contains the actual comment that was added
            comment: { dataType: DataType.LocalizedText, value: branch.getComment() },

            inputArguments: {
                dataType: DataType.Null
            },
            methodId: {
                dataType: DataType.Null
            },
            serverId: {
                dataType: DataType.Null
            },
            status: {
                dataType: DataType.StatusCode,
                value: StatusCodes.Good
            }
        };
        this.raiseEvent("AuditConditionAcknowledgeEventType", eventData);
    }

    public _raiseAuditConditionConfirmEvent(branch: ConditionSnapshot) {
        // raise the AuditConditionConfirmEventType
        const eventData: RaiseEventData = {
            actionTimeStamp: { dataType: DataType.DateTime, value: new Date() },

            // ConditionEventId The ConditionEventId field shall contain the id of the Event that was confirmed
            conditionEventId: { dataType: DataType.ByteString, value: branch.getEventId() },
            // xx branchId: branch.branchId.readValue().value,

            // AuditEventType
            clientAuditEntryId: {
                dataType: DataType.Null
            },
            clientUserId: {
                dataType: DataType.Null
            },
            comment: { dataType: DataType.LocalizedText, value: branch.getComment() },
            inputArguments: {
                dataType: DataType.Null
            },
            methodId: {
                dataType: DataType.Null
            },
            serverId: {
                dataType: DataType.Null
            },
            status: {
                dataType: DataType.StatusCode,
                value: StatusCodes.Good
            }
        };
        this.raiseEvent("AuditConditionConfirmEventType", eventData);
    }

    public _acknowledge_branch(
        conditionEventId: Buffer,
        comment: string | LocalizedTextLike | LocalizedText,
        branch: ConditionSnapshot,
        message: string
    ) {
        assert(typeof message === "string");

        const conditionNode = this;

        const statusCode = _setAckedState(branch, true, conditionEventId, comment);
        if (statusCode !== StatusCodes.Good) {
            return statusCode;
        }

        if (conditionNode.confirmedState) {
            // alarm has a confirmed state !
            // we should be waiting for confirmation now
            branch.setConfirmedState(false);
            branch.setRetain(true);
        } else {
            branch.setRetain(false);
        }

        branch.setComment(comment);

        conditionNode.raiseNewBranchState(branch);

        conditionNode._raiseAuditConditionAcknowledgeEvent(branch);

        /**
         * @event acknowledged
         * @param  eventId   {Buffer|null}
         * @param  comment   {LocalizedText}
         * @param  branch    {ConditionSnapshot}
         * raised when the alarm branch has been acknowledged
         */
        conditionNode.emit("acknowledged", conditionEventId, comment, branch);

        return StatusCodes.Good;
    }

    /**
     * @method _confirm_branch
     * @param conditionEventId The ConditionEventId field shall contain the id of the Event that was conformed
     * @param comment
     * @param branch
     * @param message
     * @private
     */
    public _confirm_branch(
        conditionEventId: Buffer,
        comment: string | LocalizedTextLike,
        branch: ConditionSnapshot,
        message: string
    ): any {
        assert(typeof message === "string");
        assert(comment instanceof LocalizedText);

        const conditionNode = this;
        // xx var eventId = branch.getEventId();
        assert(branch.getEventId().toString("hex") === conditionEventId.toString("hex"));
        branch.setConfirmedState(true);

        // once confirmed a branch do not need to be retained
        branch.setRetain(false);
        branch.setComment(comment);

        conditionNode._raiseAuditConditionCommentEvent(message, conditionEventId, comment);
        conditionNode._raiseAuditConditionConfirmEvent(branch);

        conditionNode.raiseNewBranchState(branch);

        /**
         * @event confirmed
         * @param  eventId
         * @param  comment
         * @param  eventId
         * raised when the alarm branch has been confirmed
         */
        conditionNode.emit("confirmed", conditionEventId, comment, branch);
    }

    /**
     * @method autoConfirmBranch
     * @param branch
     * @param comment
     */
    public autoConfirmBranch(branch: ConditionSnapshot, comment: LocalizedTextLike) {
        assert(branch instanceof ConditionSnapshot);
        if (!this.confirmedState) {
            // no confirmedState => ignoring
            return;
        }
        assert(!branch.getConfirmedState(), "already confirmed ?");
        const conditionNode = this;
        const conditionEventId = branch.getEventId();
        // tslint:disable-next-line:no-console
        console.log("autoConfirmBranch getAckedState ", branch.getAckedState());
        conditionNode._confirm_branch(conditionEventId, comment, branch, "Server/Confirm");
    }

    /**
     * @method acknowledgeAndAutoConfirmBranch
     * @param branch {ConditionSnapshot}
     * @param comment {String|LocalizedText}
     */
    public acknowledgeAndAutoConfirmBranch(branch: ConditionSnapshot, comment: string | LocalizedTextLike | LocalizedText) {
        comment = LocalizedText.coerce(comment)!;
        const conditionEventId = branch.getEventId();
        branch.setRetain(false);
        this._acknowledge_branch(conditionEventId, comment, branch, "Server/Acknowledge");
        this.autoConfirmBranch(branch, comment);
    }
}

function _acknowledge_method(inputArguments: VariantLike[], context: SessionContext, callback: any) {
    UAConditionBase.with_condition_method(
        inputArguments,
        context,
        callback,
        (conditionEventId: Buffer, comment: LocalizedText, branch: ConditionSnapshot, conditionNode: UAConditionBase) => {
            const ackConditionNode = conditionNode as UAAcknowledgeableConditionBase;
            // precondition checking
            assert(!conditionEventId || conditionEventId instanceof Buffer, "must have a valid eventId or  null");
            assert(comment instanceof LocalizedText, "expecting a comment as LocalizedText");
            assert(conditionNode instanceof UAAcknowledgeableConditionBase);
            ackConditionNode._acknowledge_branch(conditionEventId, comment, branch, "Method/Acknowledged");
            return StatusCodes.Good;
        }
    );
}

/*
 *
 * param inputArguments {Variant[]}
 * param context        {Object}
 * param callback       {Function}
 *
 * @private
 */
function _confirm_method(inputArguments: VariantLike[], context: SessionContext, callback: any) {
    UAConditionBase.with_condition_method(
        inputArguments,
        context,
        callback,
        (eventId: Buffer, comment: LocalizedText, branch: ConditionSnapshot, conditionNode: UAConditionBase) => {
            assert(eventId instanceof Buffer);
            assert(branch.getEventId() instanceof Buffer);
            assert(branch.getEventId().toString("hex") === eventId.toString("hex"));

            const ackConditionNode = conditionNode as UAAcknowledgeableConditionBase;
            if (branch.getConfirmedState()) {
                return StatusCodes.BadConditionBranchAlreadyConfirmed;
            }
            ackConditionNode._confirm_branch(eventId, comment, branch, "Method/Confirm");
            return StatusCodes.Good;
        }
    );
}
