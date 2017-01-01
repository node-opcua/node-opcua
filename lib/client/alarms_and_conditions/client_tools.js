"use strict";
/**
 * @module opcua.client
 */
require("requirish")._(module);
var assert = require("better-assert");
var _ = require("underscore");
var async = require("async");
//
var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;
var browse_service = require("lib/services/browse_service");
var Variant = require("lib/datamodel/variant").Variant;
var DataType = require("lib/datamodel/variant").DataType;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

var LocalizedText = require("lib/datamodel/localized_text").LocalizedText;
var NodeId = require("lib/datamodel/nodeid").NodeId;
var coerceNodeId = require("lib/datamodel/nodeid").coerceNodeId;
assert(_.isFunction(coerceNodeId));

var browse_service = require("lib/services/browse_service");
var ClientSession = require("lib/client/client_session").ClientSession;

var call_service = require("lib/services/call_service");
var CallMethodRequest = call_service.CallMethodRequest;



function callConditionRefresh(subscription,callback) {

    var the_session    = subscription.publish_engine.session;
    var subscriptionId = subscription.subscriptionId;

    assert(_.isFinite(subscriptionId),"May be subscription is not yet initialized");
    assert(_.isFunction(callback));

    var conditionTypeNodeId = resolveNodeId("ConditionType");

    var browsePath = [
        browse_service.makeBrowsePath(conditionTypeNodeId,".ConditionRefresh")
    ];
    var conditionRefreshId  = resolveNodeId("ConditionType_ConditionRefresh");

    //xx console.log("browsePath ", browsePath[0].toString({addressSpace: server.engine.addressSpace}));

    async.series([

        // find conditionRefreshId
        function (callback) {

            the_session.translateBrowsePath(browsePath, function (err, results) {
                if(!err ) {
                    // istanbul ignore else
                    if (results[0].targets.length > 0){
                        conditionRefreshId = results[0].targets[0].targetId;
                    } else {
                        // cannot find conditionRefreshId
                        console.log("cannot find conditionRefreshId",results[0].toString());
                        err = new Error(" cannot find conditionRefreshId");
                    }
                }
                callback(err);
            });
        },
        function (callback) {

            var methodsToCall = [{
                objectId: conditionTypeNodeId,
                methodId: conditionRefreshId,
                inputArguments: [
                    new Variant({ dataType: DataType.UInt32, value: subscriptionId })
                ]
            }];

            the_session.call(methodsToCall,function(err,results) {
                if (err) {
                    return callback(err);
                }
                // istanbul ignore next
                if (results[0].statusCode !== StatusCodes.Good) {
                    return callback(new Error("Error " + results[0].statusCode.toString()));
                }
                callback();
            });
        }
    ],callback);
}
exports.callConditionRefresh = callConditionRefresh;

ClientSession.prototype.disableCondition = function(){

};

ClientSession.prototype.enableCondition = function(){

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
 * @param conditionId {NodeId}
 * @param eventId     {Buffer}
 * @param comment     {String|LocalizedText}
 * @param callback    {Function}
 * @param callback.err {Error|null}
 */
ClientSession.prototype.addCommentCondition = function(conditionId,eventId,comment,callback){
    this._callMethodCondition("AddComment",conditionId,eventId,comment,callback);
};



/**
 *
 * @param nodeId
 * @param methodName
 * @param callback
 */
ClientSession.prototype.findMethodId = function(nodeId,methodName,callback) {

    var session =this;
    var browsePath = browse_service.makeBrowsePath(nodeId, "/"+methodName);
    var methodId;
    session.translateBrowsePath(browsePath, function (err, results) {

        // istanbul ignore else
        if (results.targets.length > 0){
            methodId = results.targets[0].targetId;
            return callback(null,methodId);
        } else {
            // cannot find objectWithMethodNodeId
            console.log("cannot find "  + methodName + " Method",results.toString());
            err = new Error(" cannot find " + methodName + " Method");
        }
        callback(err);
    });

};



ClientSession.prototype._callMethodCondition = function(methodName,conditionId,eventId,comment,callback) {
    var session = this;
    conditionId = coerceNodeId(conditionId);
    assert(conditionId instanceof NodeId);
    assert(eventId instanceof Buffer);
    assert(typeof(comment) == "string" || comment instanceof LocalizedText);

    comment = LocalizedText.coerce(comment);

    var methodId;

    async.series([
        function (callback) {
            session.findMethodId(conditionId, methodName, function (err, _methodId) {
                if (!err) {
                    methodId = _methodId;
                }
                callback(err);
            });
        },
        function (callback) {
            var methodToCalls = [];
            methodToCalls.push(new CallMethodRequest({
                objectId: conditionId,
                methodId: methodId,
                inputArguments: [
                    /* eventId */ new Variant({dataType: "ByteString", value: eventId}),
                    /* comment */ new Variant({dataType: "LocalizedText", value: comment})
                ]
            }));

            session.call(methodToCalls, function (err, results) {
                callback(err, results[0]);
            });
        }
    ], function (err, results) {
        if (err) {
            return callback(err);
        }
        var call_results = results[1];
        callback(err, call_results.statusCode);
    });
};

/**
 * @method confirmCondition
 * from Spec 1.03 Part 9 : page 27
 *    The Confirm Method is used to confirm an Event Notifications for a Condition instance state
 *    where ConfirmedState is FALSE.
 *    Normally, the NodeId of the object instance as the ObjectId is passed to the Call Service.
 *    However, some Servers do not expose Condition instances in the AddressSpace.
 *    Therefore all Servers shall also allow Clients to call the Confirm Method by specifying ConditionId as the ObjectId.
 *    The Method cannot be called with an ObjectId of the AcknowledgeableConditionType Node.
 * @param conditionId
 * @param eventId
 * @param comment
 * @param callback
 */
ClientSession.prototype.confirmCondition = function(conditionId,eventId,comment,callback){
    // ns=0;i=9113 AcknowledgeableConditionType#Confirm
    // note that confirm method is Optionals on condition
    this._callMethodCondition("Confirm",conditionId,eventId,comment,callback);
};

/**
 * @method acknowledgeCondition
 *
 * from Spec 1.03 Part 9 : page 27
 *   The Acknowledge Method is used to acknowledge an Event Notification for a Condition
 *   instance state where AckedState is false.
 *   Normally, the NodeId of the object instance as the ObjectId is passed to the Call Service.
 *   However, some Servers do not expose Condition instances in the AddressSpace.
 *   Therefore all Servers shall also allow Clients to call the Acknowledge Method by specifying ConditionId as the ObjectId.
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
 * @param conditionId {NodeId}
 * @param eventId     {Buffer}
 * @param comment     {String|LocalizedText}
 * @param callback    {Function}
 * @param callback.err {Error|null}
 */
ClientSession.prototype.acknowledgeCondition = function(conditionId,eventId,comment,callback){
    // ns=0;i=9111 AcknowledgeableConditionType#Acknowledge
    this._callMethodCondition("Acknowledge",conditionId,eventId,comment,callback);
};