/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import { UAAcknowledgeableCondition_Base, UAAcknowledgeableCondition, UACondition } from "node-opcua-nodeset-ua";
import { assert } from "node-opcua-assert";
import { LocalizedText, LocalizedTextLike } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";
import { CallbackT, StatusCode, StatusCodes } from "node-opcua-status-code";
import { DataType, VariantLike, VariantOptions } from "node-opcua-variant";
import { INamespace, RaiseEventData, ISessionContext, UAEventType, UAMethod } from "node-opcua-address-space-base";
import { CallMethodResultOptions } from "node-opcua-service-call";

import { AddressSpacePrivate } from "../address_space_private";
import { _install_TwoStateVariable_machinery } from "../state_machine/ua_two_state_variable";
import { UAAcknowledgeableConditionEx } from "../../source/interfaces/alarms_and_conditions/ua_acknowledgeable_condition_ex";
import { ConditionSnapshot } from "../../source/interfaces/alarms_and_conditions/condition_snapshot";
import { InstantiateAlarmConditionOptions } from "../../source/interfaces/alarms_and_conditions/instantiate_alarm_condition_options";

import { _setAckedState } from "./condition";
import { ConditionSnapshotImpl } from "./condition_snapshot_impl";
import {  UAConditionImpl } from "./ua_condition_impl";


export declare interface UAAcknowledgeableConditionImpl extends UAAcknowledgeableConditionEx, UAConditionImpl {
    on(eventName: string, eventHandler: any): this;
}

export class UAAcknowledgeableConditionImpl extends UAConditionImpl implements UAAcknowledgeableConditionEx {
    /**
     */
    public static instantiate(
        namespace: INamespace,
        conditionTypeId: UAEventType | NodeId | string,
        options: InstantiateAlarmConditionOptions,
        data?: Record<string, VariantOptions>
    ): UAAcknowledgeableConditionImpl {
        const conditionNode = UAConditionImpl.instantiate(
            namespace,
            conditionTypeId,
            options,
            data
        ) as UAAcknowledgeableConditionImpl;

        Object.setPrototypeOf(conditionNode, UAAcknowledgeableConditionImpl.prototype);

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
        assert(conditionNode instanceof UAAcknowledgeableConditionImpl);
        return conditionNode;
    }

    public static install_method_handle_on_type(addressSpace: AddressSpacePrivate): void {
        const acknowledgeableConditionType = addressSpace.findEventType(
            "AcknowledgeableConditionType"
        ) as unknown as UAAcknowledgeableCondition_Base;
        assert(acknowledgeableConditionType !== null);
        acknowledgeableConditionType.acknowledge.bindMethod(_acknowledge_method);
        acknowledgeableConditionType.confirm?.bindMethod(_confirm_method);
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

    public _raiseAuditConditionConfirmEvent(branch: ConditionSnapshot): void {
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
    ): StatusCode {
        assert(typeof message === "string");

        const statusCode = _setAckedState(branch as ConditionSnapshotImpl, true, conditionEventId, comment);
        if (statusCode !== StatusCodes.Good) {
            return statusCode;
        }

        if (this.confirmedState) {
            // alarm has a confirmed state !
            // we should be waiting for confirmation now
            branch.setConfirmedState(false);
            branch.setRetain(true);
        } else {
            branch.setRetain(false);
        }

        branch.setComment(comment);

        this.raiseNewBranchState(branch);

        this._raiseAuditConditionAcknowledgeEvent(branch);

        /**
         * @event acknowledged
         * @param  eventId   {Buffer|null}
         * @param  comment   {LocalizedText}
         * @param  branch    {ConditionSnapshot}
         * raised when the alarm branch has been acknowledged
         */
        this.emit("acknowledged", conditionEventId, comment, branch);

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
    ): void {
        assert(typeof message === "string");
        assert(comment instanceof LocalizedText);

        // xx var eventId = branch.getEventId();
        assert(branch.getEventId().toString("hex") === conditionEventId.toString("hex"));
        branch.setConfirmedState(true);

        // once confirmed a branch do not need to be retained
        branch.setRetain(false);
        branch.setComment(comment);

        this._raiseAuditConditionCommentEvent(message, conditionEventId, comment);
        this._raiseAuditConditionConfirmEvent(branch);

        this.raiseNewBranchState(branch);

        /**
         * @event confirmed
         * @param  eventId
         * @param  comment
         * @param  eventId
         * raised when the alarm branch has been confirmed
         */
        this.emit("confirmed", conditionEventId, comment, branch);
    }

    /**
     * @method autoConfirmBranch
     * @param branch
     * @param comment
     */
    public autoConfirmBranch(branch: ConditionSnapshot, comment: LocalizedTextLike): void {
        assert(branch instanceof ConditionSnapshotImpl);
        if (!this.confirmedState) {
            // no confirmedState => ignoring
            return;
        }
        assert(!branch.getConfirmedState(), "already confirmed ?");
        const conditionEventId = branch.getEventId();
        // tslint:disable-next-line:no-console
        console.log("autoConfirmBranch getAckedState ", branch.getAckedState());
        this._confirm_branch(conditionEventId, comment, branch, "Server/Confirm");
    }

    /**
     * @method acknowledgeAndAutoConfirmBranch
     * @param branch {ConditionSnapshot}
     * @param comment {String|LocalizedText}
     */
    public acknowledgeAndAutoConfirmBranch(branch: ConditionSnapshot, comment: string | LocalizedTextLike | LocalizedText): void {
        comment = LocalizedText.coerce(comment)!;
        const conditionEventId = branch.getEventId();
        branch.setRetain(false);
        this._acknowledge_branch(conditionEventId, comment, branch, "Server/Acknowledge");
        this.autoConfirmBranch(branch, comment);
    }
}

function _acknowledge_method(
    inputArguments: VariantLike[],
    context: ISessionContext,
    callback: CallbackT<CallMethodResultOptions>
) {
    UAConditionImpl.with_condition_method(
        inputArguments,
        context,
        callback,
        (conditionEventId: Buffer, comment: LocalizedText, branch: ConditionSnapshot, conditionNode: UAConditionImpl) => {
            const ackConditionNode = conditionNode as UAAcknowledgeableConditionImpl;
            // precondition checking
            assert(!conditionEventId || conditionEventId instanceof Buffer, "must have a valid eventId or  null");
            assert(comment instanceof LocalizedText, "expecting a comment as LocalizedText");
            assert(conditionNode instanceof UAAcknowledgeableConditionImpl);
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
function _confirm_method(inputArguments: VariantLike[], context: ISessionContext, callback: CallbackT<CallMethodResultOptions>) {
    UAConditionImpl.with_condition_method(
        inputArguments,
        context,
        callback,
        (eventId: Buffer, comment: LocalizedText, branch: ConditionSnapshot, conditionNode: UAConditionImpl) => {
            assert(eventId instanceof Buffer);
            assert(branch.getEventId() instanceof Buffer);
            assert(branch.getEventId().toString("hex") === eventId.toString("hex"));

            const ackConditionNode = conditionNode as UAAcknowledgeableConditionImpl;
            if (branch.getConfirmedState()) {
                return StatusCodes.BadConditionBranchAlreadyConfirmed;
            }
            ackConditionNode._confirm_branch(eventId, comment, branch, "Method/Confirm");
            return StatusCodes.Good;
        }
    );
}
