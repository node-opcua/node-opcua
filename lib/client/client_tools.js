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
                if (results[0].statusCode !== StatusCodes.Good) {
                    return callback(new Error("Error " + results[0].statusCode.toString()));
                }
                callback();
            });
        }
    ],callback);
}
exports.callConditionRefresh = callConditionRefresh;
