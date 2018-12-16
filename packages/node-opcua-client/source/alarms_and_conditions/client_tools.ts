/**
 * @module node-opcua-client
 */
// tslint:disable:no-empty
// tslint:disable: only-arrow-functions

import * as async from "async";
import * as _ from "underscore";

import { assert } from "node-opcua-assert";
import { LocalizedText, LocalizedTextLike } from "node-opcua-data-model";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { coerceNodeId, NodeId, NodeIdLike, resolveNodeId } from "node-opcua-nodeid";
import { ErrorCallback } from "node-opcua-secure-channel";
import { CallMethodRequest, CallMethodResult } from "node-opcua-service-call";
import { BrowsePathResult, makeBrowsePath } from "node-opcua-service-translate-browse-path";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant } from "node-opcua-variant";

import { CallMethodRequestLike, ResponseCallback } from "../client_session";
import { ClientSubscription } from "../client_subscription";
import { ClientSessionImpl } from "../private/client_session_impl";
import { ClientSubscriptionImpl } from "../private/client_subscription_impl";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);
const errorLog = debugLog;

export function callConditionRefresh(
    subscription: ClientSubscription,
    callback: ErrorCallback
) {

    const subscriptionI = subscription as ClientSubscriptionImpl;
    const theSession = subscriptionI.publishEngine.session!;

    const subscriptionId = subscription.subscriptionId;

    assert(_.isFinite(subscriptionId), "May be subscription is not yet initialized");
    assert(_.isFunction(callback));

    const conditionTypeNodeId = resolveNodeId("ConditionType");

    let conditionRefreshId = resolveNodeId("ConditionType_ConditionRefresh");

    async.series([
        // find conditionRefreshId
        (innerCallback: ErrorCallback ) => {

            const browsePath = makeBrowsePath(conditionTypeNodeId, ".ConditionRefresh");
            theSession.translateBrowsePath(browsePath, (err: Error | null, result?: BrowsePathResult) => {
                if (!err) {
                    result = result!;
                    // istanbul ignore else
                    if (result.targets && result.targets.length > 0) {
                        conditionRefreshId = result.targets[0].targetId;
                    } else {
                        // cannot find conditionRefreshId
                        debugLog("cannot find conditionRefreshId", result.toString());
                        err = new Error(" cannot find conditionRefreshId");
                    }
                }
                innerCallback(err ? err : undefined);
            });
        },

        (innerCallback: ErrorCallback) => {

            const methodToCall: CallMethodRequestLike = {
                inputArguments: [
                    new Variant({dataType: DataType.UInt32, value: subscriptionId})
                ],
                methodId: conditionRefreshId,
                objectId: conditionTypeNodeId,
            };

            theSession.call(methodToCall, (err: Error | null, result?: CallMethodResult) => {
                if (err) {
                    return innerCallback(err);
                }
                result = result!;

                // istanbul ignore next
                if (result.statusCode !== StatusCodes.Good) {
                    return innerCallback(new Error("Error " + result.statusCode.toString()));
                }
                innerCallback();
            });
        },

    ], (err) => {
        callback(err!);
    });
}

ClientSessionImpl.prototype.disableCondition = () => {

};

ClientSessionImpl.prototype.enableCondition = () => {

};

/**
 * @method addCommentCondition
 * The AddComment Method is used to apply a comment to a specific state of a Condition instance.
 * Normally, the NodeId of the object instance as the ObjectId is passed to the Call Service.
 * However, some Servers do not expose Condition instances in the AddressSpace. Therefore all Servers
 * shall also allow Clients to call the AddComment Method by specifying ConditionId as the ObjectId.
 * The Method cannot be called with an ObjectId of the ConditionType Node.
 *
 * Notes:
 * Comments are added to Event occurrences identified via an EventId. EventIds where the related EventType
 * is not a ConditionType (or subtype of it) and thus does not support Comments are rejected.
 * A ConditionEvent – where the Comment Variable contains this text – will be sent for the identified
 * state. If a comment is added to a previous state (i.e. a state for which the Server has created a
 * branch), the BranchId and all Condition values of this branch will be reported/.
 *
 * @param conditionId
 * @param eventId
 * @param comment
 */
ClientSessionImpl.prototype.addCommentCondition = function(
    conditionId: NodeIdLike,
    eventId: Buffer,
    comment: LocalizedTextLike,
    callback: ErrorCallback
) {
    this._callMethodCondition("AddComment", conditionId, eventId, comment, callback);
};

/**
 * @method findMethodId
 * @param nodeId
 * @param methodName
 * @param callback
 */
ClientSessionImpl.prototype.findMethodId = function(
    nodeId: NodeIdLike,
    methodName: string,
    callback: ResponseCallback<NodeId>,
) {

    const browsePath = makeBrowsePath(nodeId, "/" + methodName);
    let methodId: NodeId;
    this.translateBrowsePath(browsePath, (err: Error | null, result?: BrowsePathResult) => {

        if (err) {
            return callback(err);
        }
        if (!result) {
            return callback(new Error("Internal Error"));
        }
        result.targets = result.targets || [];

        // istanbul ignore else
        if (result.targets.length > 0) {
            methodId = result.targets[0].targetId;
            return callback(null, methodId);
        } else {
            // cannot find objectWithMethodNodeId
            debugLog("cannot find " + methodName + " Method", result.toString());
            err = new Error(" cannot find " + methodName + " Method");
        }
        callback(err);
    });

};

ClientSessionImpl.prototype._callMethodCondition = function(
    methodName: string,
    conditionId: NodeIdLike,
    eventId: Buffer,
    comment: LocalizedTextLike, callback: (err?: Error) => void
) {

    conditionId = coerceNodeId(conditionId);
    assert(conditionId instanceof NodeId);
    assert(eventId instanceof Buffer);
    assert(typeof(comment) === "string" || comment instanceof LocalizedText);

    comment = LocalizedText.coerce(comment) || new LocalizedText();

    let methodId: NodeId;

    async.series([

        (innerCallback: ErrorCallback) => {
            this.findMethodId(conditionId, methodName, (err: Error | null, _methodId?: NodeId) => {
                if (err) {
                    return innerCallback(err);
                }
                if (_methodId) {
                    methodId = _methodId;
                }
                innerCallback();
            });
        },

        (innerCallback: ErrorCallback) => {

            const methodToCalls = [];

            methodToCalls.push(new CallMethodRequest({
                inputArguments: [
                    /* eventId */ new Variant({dataType: "ByteString", value: eventId}),
                    /* comment */ new Variant({dataType: "LocalizedText", value: comment})
                ],
                methodId,
                objectId: conditionId,
            }));

            this.call(methodToCalls, (err: Error | null, results?: CallMethodResult[]) => {
                if (err) {
                    return innerCallback(err);
                }
                innerCallback();
            });
        }
    ], (err) => {
        if (err) {
            return callback(err);
        }
        callback();
    });
};

/**
 * @method confirmCondition
 * from Spec 1.03 Part 9 : page 27
 *    The Confirm Method is used to confirm an Event Notifications for a Condition instance state
 *    where ConfirmedState is FALSE.
 *    Normally, the NodeId of the object instance as the ObjectId is passed to the Call Service.
 *    However, some Servers do not expose Condition instances in the AddressSpace.
 *    Therefore all Servers shall also allow Clients to call the Confirm Method by specifying ConditionId
 *    as the ObjectId.
 *    The Method cannot be called with an ObjectId of the AcknowledgeableConditionType Node.
 * @param conditionId
 * @param eventId
 * @param comment
 * @param callback
 */
ClientSessionImpl.prototype.confirmCondition = function(
    conditionId: NodeId,
    eventId: Buffer,
    comment: LocalizedTextLike,
    callback: (err?: Error) => void
) {
    // ns=0;i=9113 AcknowledgeableConditionType#Confirm
    // note that confirm method is Optionals on condition
    this._callMethodCondition("Confirm", conditionId, eventId, comment, callback);
};

/**
 * @class ClientSessionImpl
 * @method acknowledgeCondition
 *
 * from Spec 1.03 Part 9 : page 27
 *   The Acknowledge Method is used to acknowledge an Event Notification for a Condition
 *   instance state where AckedState is false.
 *   Normally, the NodeId of the object instance as the ObjectId is passed to the Call Service.
 *   However, some Servers do not expose Condition instances in the AddressSpace.
 *   Therefore all Servers shall also allow Clients to call the Acknowledge Method by specifying ConditionId
 *   as the ObjectId.
 *   The Method cannot be called with an ObjectId of the AcknowledgeableConditionType Node.
 *
 *   A Condition instance may be an Object that appears in the Server Address Space. If this is
 *   the case the ConditionId is the NodeId for the Object.
 *
 *   The EventId identifies a specific Event Notification where a state to be acknowledged was
 *   reported. Acknowledgement and the optional comment will be applied to the state identified
 *   with the EventId. If the comment field is NULL (both locale and text are empty) it will be
 *   ignored and any existing comments will remain unchanged. If the comment is to be reset, an
 *   empty text with a locale shall be provided.
 *   A valid EventId will result in an Event Notification where AckedState/Id is set to TRUE and the
 *   Comment Property contains the text of the optional comment argument. If a previous state is
 *   acknowledged, the BranchId and all Condition values of this branch will be reported.
 *
 * @param conditionId
 * @param eventId
 * @param comment
 * @param callback
 */
ClientSessionImpl.prototype.acknowledgeCondition = function(
    conditionId: NodeId,
    eventId: Buffer,
    comment: LocalizedTextLike,
    callback: ErrorCallback) {
    // ns=0;i=9111 AcknowledgeableConditionType#Acknowledge
    this._callMethodCondition("Acknowledge", conditionId, eventId, comment, callback);
};
