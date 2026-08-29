/**
 * @module node-opcua-client
 */

import { callbackify } from "node:util";
import { acknowledgeCondition, callMethodCondition, confirmCondition } from "node-opcua-alarm-condition";
import type { LocalizedTextLike } from "node-opcua-data-model";
import type { NodeId, NodeIdLike } from "node-opcua-nodeid";
import { findMethodId, type ResponseCallback } from "node-opcua-pseudo-session";
import type { Callback, StatusCode } from "node-opcua-status-code";

import { ClientSessionImpl } from "../private/client_session_impl.js";

ClientSessionImpl.prototype.disableCondition = () => {
    /** */
};

ClientSessionImpl.prototype.enableCondition = () => {
    /** */
};

function addCommentConditionImpl(
    conditionId: NodeIdLike,
    eventId: Buffer,
    comment: LocalizedTextLike,
    callback: Callback<StatusCode>
): void;
function addCommentConditionImpl(conditionId: NodeIdLike, eventId: Buffer, comment: LocalizedTextLike): Promise<StatusCode>;
function addCommentConditionImpl(
    this: ClientSessionImpl,
    conditionId: NodeIdLike,
    eventId: Buffer,
    comment: LocalizedTextLike,
    callback?: Callback<StatusCode>
): Promise<StatusCode> | undefined {
    if (!callback) {
        return callMethodCondition(this, "AddComment", conditionId, eventId, comment);
    }
    callbackify(callMethodCondition)(this, "AddComment", conditionId, eventId, comment, callback);
    return undefined;
}
ClientSessionImpl.prototype.addCommentCondition = addCommentConditionImpl;

/** @deprecated */
function findMethodIdImpl(nodeId: NodeIdLike, methodName: string, callback: ResponseCallback<NodeId>): void;
function findMethodIdImpl(nodeId: NodeIdLike, methodName: string): Promise<NodeId>;
function findMethodIdImpl(
    this: ClientSessionImpl,
    nodeId: NodeIdLike,
    methodName: string,
    callback?: ResponseCallback<NodeId>
): Promise<NodeId> | undefined {
    const promise = findMethodId(this, nodeId, methodName).then((data) => {
        if (data.methodId) {
            return data.methodId;
        }
        throw data.err || new Error("findMethodId: method not found");
    });
    if (!callback) {
        return promise;
    }
    promise
        .then((methodId) => callback(null, methodId))
        .catch((err) => {
            callback(err);
        });
    return undefined;
}
ClientSessionImpl.prototype.findMethodId = findMethodIdImpl;

function confirmConditionImpl(
    conditionId: NodeId,
    eventId: Buffer,
    comment: LocalizedTextLike,
    callback: Callback<StatusCode>
): void;
function confirmConditionImpl(conditionId: NodeId, eventId: Buffer, comment: LocalizedTextLike): Promise<StatusCode>;
function confirmConditionImpl(
    this: ClientSessionImpl,
    conditionId: NodeId,
    eventId: Buffer,
    comment: LocalizedTextLike,
    callback?: Callback<StatusCode>
): Promise<StatusCode> | undefined {
    // ns=0;i=9113 AcknowledgeableConditionType#Confirm
    // note that confirm method is Optionals on condition
    if (!callback) {
        return confirmCondition(this, conditionId, eventId, comment);
    }
    callbackify(confirmCondition)(this, conditionId, eventId, comment, callback);
    return undefined;
}
ClientSessionImpl.prototype.confirmCondition = confirmConditionImpl;

function acknowledgeConditionImpl(
    conditionId: NodeId,
    eventId: Buffer,
    comment: LocalizedTextLike,
    callback: Callback<StatusCode>
): void;
function acknowledgeConditionImpl(conditionId: NodeId, eventId: Buffer, comment: LocalizedTextLike): Promise<StatusCode>;
function acknowledgeConditionImpl(
    this: ClientSessionImpl,
    conditionId: NodeId,
    eventId: Buffer,
    comment: LocalizedTextLike,
    callback?: Callback<StatusCode>
): Promise<StatusCode> | undefined {
    // ns=0;i=9111 AcknowledgeableConditionType#Acknowledge
    if (!callback) {
        return acknowledgeCondition(this, conditionId, eventId, comment);
    }
    callbackify(acknowledgeCondition)(this, conditionId, eventId, comment, callback);
    return undefined;
}
ClientSessionImpl.prototype.acknowledgeCondition = acknowledgeConditionImpl;
