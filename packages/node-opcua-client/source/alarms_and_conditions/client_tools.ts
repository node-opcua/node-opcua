/**
 * @module node-opcua-client
 */
import { callbackify } from "util";
import { LocalizedTextLike } from "node-opcua-data-model";
import { NodeId, NodeIdLike } from "node-opcua-nodeid";
import { StatusCode } from "node-opcua-status-code";
import { Callback } from "node-opcua-status-code";
import { acknowledgeCondition, callMethodCondition, confirmCondition } from "node-opcua-alarm-condition";
import { ResponseCallback, findMethodId } from "node-opcua-pseudo-session";

import { ClientSessionImpl } from "../private/client_session_impl";

ClientSessionImpl.prototype.disableCondition = () => {
    /** */
};

ClientSessionImpl.prototype.enableCondition = () => {
    /** */
};

ClientSessionImpl.prototype.addCommentCondition = function (
    conditionId: NodeIdLike,
    eventId: Buffer,
    comment: LocalizedTextLike,
    callback: Callback<StatusCode>
) {
    callbackify(callMethodCondition)(this, "AddComment", conditionId, eventId, comment, callback);
};

/** @deprecated */
ClientSessionImpl.prototype.findMethodId = function (nodeId: NodeIdLike, methodName: string, callback: ResponseCallback<NodeId>) {
    findMethodId(this, nodeId, methodName)
        .then((data) => {
            if (data.methodId) {
                callback(null, data.methodId);
            } else {
                callback(data.err);
            }
        })
        .catch((err) => {
            callback(err);
        });
};

ClientSessionImpl.prototype.confirmCondition = function (
    conditionId: NodeId,
    eventId: Buffer,
    comment: LocalizedTextLike,
    callback: Callback<StatusCode>
) {
    // ns=0;i=9113 AcknowledgeableConditionType#Confirm
    // note that confirm method is Optionals on condition
    callbackify(confirmCondition)(this, conditionId, eventId, comment, callback);
};

ClientSessionImpl.prototype.acknowledgeCondition = function (
    conditionId: NodeId,
    eventId: Buffer,
    comment: LocalizedTextLike,
    callback: Callback<StatusCode>
) {
    // ns=0;i=9111 AcknowledgeableConditionType#Acknowledge
    callbackify(acknowledgeCondition)(this, conditionId, eventId, comment, callback);
};

// tslint:disable:no-var-requires
// tslint:disable:max-line-length
const thenify = require("thenify");
const opts = { multiArgs: false };
ClientSessionImpl.prototype.addCommentCondition = thenify.withCallback(ClientSessionImpl.prototype.addCommentCondition, opts);
ClientSessionImpl.prototype.findMethodId = thenify.withCallback(ClientSessionImpl.prototype.findMethodId, opts);
ClientSessionImpl.prototype.confirmCondition = thenify.withCallback(ClientSessionImpl.prototype.confirmCondition, opts);
ClientSessionImpl.prototype.acknowledgeCondition = thenify.withCallback(ClientSessionImpl.prototype.acknowledgeCondition, opts);
