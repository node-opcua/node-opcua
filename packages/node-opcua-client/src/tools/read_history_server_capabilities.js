/**
 *
 */
var lowerFirstLetter = require("node-opcua-utils").lowerFirstLetter;
var makeBrowsePath = require("node-opcua-service-translate-browse-path").makeBrowsePath;
var ObjectIds = require("node-opcua-constants").ObjectIds;
var StatusCodes = require("node-opcua-status-code").StatusCodes;
var NodeId = require("node-opcua-nodeid").NodeId;
var AttributeIds = require("node-opcua-data-model").AttributeIds;


function readHistorySeverCapabilities(the_session,callback) {
    // display HistoryCapabilities of server
    var browsePath = makeBrowsePath(ObjectIds.ObjectsFolder,"/Server/ServerCapabilities.HistoryServerCapabilities");

    the_session.translateBrowsePath(browsePath,function(err,result) {
        if (err) { return callback(err); }
        if (result.statusCode !==  StatusCodes.Good) {
            return callback();
        }
        var historyServerCapabilitiesNodeId = result.targets[0].targetId;
        // (should be ns=0;i=11192)
        assert(historyServerCapabilitiesNodeId.toString() === "ns=0;i=11192");

        // -------------------------
        var properties = [
            "AccessHistoryDataCapability",
            "AccessHistoryEventsCapability",
            "DeleteAtTimeCapability",
            "DeleteRawCapability",
            "DeleteEventCapability",
            "InsertAnnotationCapability",
            "InsertDataCapability",
            "InsertEventCapability",
            "ReplaceDataCapability",
            "ReplaceEventCapability",
            "UpdateDataCapability",
            "UpdateEventCapability",
            "MaxReturnDataValues",
            "MaxReturnEventValues",
            "AggregateFunctions/AnnotationCount",
            "AggregateFunctions/Average",
            "AggregateFunctions/Count",
            "AggregateFunctions/Delta",
            "AggregateFunctions/DeltaBounds",
            "AggregateFunctions/DurationBad",
            "AggregateFunctions/DurationGood",
            "AggregateFunctions/DurationStateNonZero",
            // etc....
        ];
        var browsePaths = properties.map(function(prop) {
            return makeBrowsePath(historyServerCapabilitiesNodeId,"." + prop);
        });

        the_session.translateBrowsePath(browsePaths,function(err,results) {
            if (err) {
                return callback();
            }
            var nodeIds = results.map(function(result) {
                return (result.statusCode === StatusCodes.Good) ? result.targets[0].targetId : NodeId.NullId;
            });

            var nodesToRead = nodeIds.map(function(nodeId){
                return { nodeId: nodeId, attributeId: AttributeIds.Value };
            });

            var data = {};
            the_session.read(nodesToRead,function(err,dataValues){
                if (err) { return callback(err);}

                for(var i=0;i<dataValues.length; i++ ) {
                    //xx console.log(properties[i] , "=",
                    //xx     dataValues[i].value ? dataValues[i].value.toString() :"<null>" + dataValues[i].statusCode.toString());
                    var propName = lowerFirstLetter(properties[i]);
                    data[propName] = dataValues[i].value.value;
                }
                callback(null,data);
            })
        });
    });
};

module.exports.readHistorySeverCapabilities = readHistorySeverCapabilities;
