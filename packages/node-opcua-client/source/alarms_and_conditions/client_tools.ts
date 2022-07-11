/**
 * @module node-opcua-client
 */
// tslint:disable:no-empty
// tslint:disable: only-arrow-functions

import * as async from "async";
import { assert } from "node-opcua-assert";
import { LocalizedText, LocalizedTextLike } from "node-opcua-data-model";
import { checkDebugFlag, make_debugLog, make_warningLog } from "node-opcua-debug";
import { coerceNodeId, NodeId, NodeIdLike, resolveNodeId } from "node-opcua-nodeid";
import { CallMethodRequest, CallMethodResult } from "node-opcua-service-call";
import { BrowsePathResult, makeBrowsePath } from "node-opcua-service-translate-browse-path";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { DataType, Variant } from "node-opcua-variant";
import { Callback, ErrorCallback } from "node-opcua-status-code";

import { CallMethodRequestLike, ResponseCallback } from "../client_session";
import { ClientSubscription } from "../client_subscription";
import { ClientSessionImpl } from "../private/client_session_impl";
import { ClientSubscriptionImpl } from "../private/client_subscription_impl";

const debugLog = make_debugLog("A&E");
const doDebug = checkDebugFlag("A&E");
const warningLog = make_warningLog("A&E");


export async function callConditionRefresh(subscription: ClientSubscription): Promise<void>;
export function callConditionRefresh(subscription: ClientSubscription, callback: ErrorCallback): void;
export function callConditionRefresh(subscription: ClientSubscription, callback?: ErrorCallback): any {
    const subscriptionI = subscription as ClientSubscriptionImpl;
    const theSession = subscriptionI.publishEngine.session!;

    const subscriptionId = subscription.subscriptionId;

    assert(isFinite(subscriptionId), "May be subscription is not yet initialized");
    assert(typeof callback === "function");

    const conditionTypeNodeId = resolveNodeId("ConditionType");

    let conditionRefreshId = resolveNodeId("ConditionType_ConditionRefresh");

    async.series(
        [
            // find conditionRefreshId
            (innerCallback: ErrorCallback) => {
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
                    inputArguments: [new Variant({ dataType: DataType.UInt32, value: subscriptionId })],
                    methodId: conditionRefreshId,
                    objectId: conditionTypeNodeId
                };

                doDebug && debugLog("Calling method ", new CallMethodRequest(methodToCall).toString());
                theSession.call(methodToCall, (err: Error | null, result?: CallMethodResult) => {
                    if (err) {
                        return innerCallback(err);
                    }
                    result = result!;

                    // istanbul ignore next
                    if (result.statusCode !== StatusCodes.Good) {
                        warningLog(new CallMethodRequest(methodToCall).toString());
                        return innerCallback(new Error("Error " + result.statusCode.toString()));
                    }
                    innerCallback();
                });
            }
        ],
        (err) => {
            callback!(err || undefined);
        }
    );
}

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
    this._callMethodCondition("AddComment", conditionId, eventId, comment, callback);
};

ClientSessionImpl.prototype.findMethodId = function (nodeId: NodeIdLike, methodName: string, callback: ResponseCallback<NodeId>) {
    const browsePath = makeBrowsePath(nodeId, "/" + methodName);
    let methodId: NodeId;
    this.translateBrowsePath(browsePath, (err: Error | null, result?: BrowsePathResult) => {
        if (err) {
            return callback(err);
        }
        /* istanbul ignore next */
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

/**
 *
 * @param methodName
 * @param conditionId
 * @param eventId
 * @param comment
 * @param callback
 * @private
 */
ClientSessionImpl.prototype._callMethodCondition = function (
    methodName: string,
    conditionId: NodeIdLike,
    eventId: Buffer,
    comment: LocalizedTextLike,
    callback: Callback<StatusCode>
) {
    conditionId = coerceNodeId(conditionId);
    assert(conditionId instanceof NodeId);
    assert(eventId instanceof Buffer);
    assert(typeof comment === "string" || comment instanceof LocalizedText);

    comment = LocalizedText.coerce(comment) || new LocalizedText();

    let methodId: NodeId;

    let statusCode: StatusCode;
    async.series(
        [
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

                methodToCalls.push(
                    new CallMethodRequest({
                        inputArguments: [
                            /* eventId */ new Variant({ dataType: "ByteString", value: eventId }),
                            /* comment */ new Variant({ dataType: "LocalizedText", value: comment })
                        ],
                        methodId,
                        objectId: conditionId
                    })
                );

                this.call(methodToCalls, (err: Error | null, results?: CallMethodResult[]) => {
                    if (err) {
                        return innerCallback(err);
                    }
                    statusCode = results![0].statusCode;
                    innerCallback();
                });
            }
        ],
        (err) => {
            if (err) {
                return callback(err);
            }
            callback(null, statusCode);
        }
    );
};

ClientSessionImpl.prototype.confirmCondition = function (
    conditionId: NodeId,
    eventId: Buffer,
    comment: LocalizedTextLike,
    callback: Callback<StatusCode>
) {
    // ns=0;i=9113 AcknowledgeableConditionType#Confirm
    // note that confirm method is Optionals on condition
    this._callMethodCondition("Confirm", conditionId, eventId, comment, callback);
};

ClientSessionImpl.prototype.acknowledgeCondition = function (
    conditionId: NodeId,
    eventId: Buffer,
    comment: LocalizedTextLike,
    callback: Callback<StatusCode>
) {
    // ns=0;i=9111 AcknowledgeableConditionType#Acknowledge
    this._callMethodCondition("Acknowledge", conditionId, eventId, comment, callback);
};

// tslint:disable:no-var-requires
// tslint:disable:max-line-length
const thenify = require("thenify");
const opts = { multiArgs: false };
ClientSessionImpl.prototype.addCommentCondition = thenify.withCallback(ClientSessionImpl.prototype.addCommentCondition, opts);
ClientSessionImpl.prototype.findMethodId = thenify.withCallback(ClientSessionImpl.prototype.findMethodId, opts);
ClientSessionImpl.prototype.confirmCondition = thenify.withCallback(ClientSessionImpl.prototype.confirmCondition, opts);
ClientSessionImpl.prototype.acknowledgeCondition = thenify.withCallback(ClientSessionImpl.prototype.acknowledgeCondition, opts);
(module as any).exports.callConditionRefresh = thenify.withCallback((module as any).exports.callConditionRefresh, opts);
