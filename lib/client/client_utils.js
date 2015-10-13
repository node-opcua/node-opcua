"use strict";
require("requirish")._(module);

var assert = require("better-assert");
var _ = require("underscore");

var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;

var translate_browse_paths_to_node_ids_service = require("lib/services/translate_browse_paths_to_node_ids_service");
var BrowsePath = translate_browse_paths_to_node_ids_service.BrowsePath;

var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var AttributeIds = require("lib/datamodel/attributeIds").AttributeIds;

var hasPropertyRefId = resolveNodeId("HasProperty");
/* NodeId  ns=0;i=46*/

function browsePathPropertyRequest(nodeId, propertyName) {

    return new BrowsePath({
        startingNode: /* NodeId  */ nodeId,
        relativePath: /* RelativePath   */  {
            elements: /* RelativePathElement */ [
                {
                    referenceTypeId: hasPropertyRefId,
                    isInverse: false,
                    includeSubtypes: false,
                    targetName: {namespaceIndex: 0, name: propertyName}
                }
            ]
        }
    });

}

/**
 * @method readUAAnalogItem
 * @param session
 * @param nodeId
 * @param callback
 */
function readUAAnalogItem(session, nodeId, callback) {

    assert(_.isFunction(callback));

    var browsePath = [
        browsePathPropertyRequest(nodeId, "EngineeringUnits"),
        browsePathPropertyRequest(nodeId, "EURange"),
        browsePathPropertyRequest(nodeId, "InstrumentRange"),
        browsePathPropertyRequest(nodeId, "ValuePrecision"),
        browsePathPropertyRequest(nodeId, "Definition")
    ];

    var analogItemData = {
        engineeringUnits: null,
        engineeringUnitsRange: null,
        instrumentRange: null,
        valuePrecision: null,
        definition: null
    };


    session.translateBrowsePath(browsePath, function (err, browsePathResults) {

        if (err) {
            return callback(err);
        }
        //xx console.log("xxxx ",browsePathResults.toString());

        var actions = [];
        var nodesToRead = [];

        function processProperty(browsePathIndex, propertyName) {
            if (browsePathResults[browsePathIndex].statusCode === StatusCodes.Good) {

                nodesToRead.push({
                    nodeId: browsePathResults[browsePathIndex].targets[0].targetId,
                    attributeId: AttributeIds.Value
                });
                actions.push(function (readResult) {
                    // to do assert is
                    analogItemData[propertyName] = readResult.value.value;
                });
            }
        }

        processProperty(0, "engineeringUnits");
        processProperty(1, "engineeringUnitsRange");
        processProperty(2, "instrumentRange");
        processProperty(3, "valuePrecision");
        processProperty(4, "definition");

        session.read(nodesToRead, function (err, nodesToRead, results) {
            if (err) {
                return callback(err);
            }
            results.forEach(function (result, index) {
                actions[index].call(null, result);
            });
            callback(err, analogItemData);

            // console.log("analogItemData = ",analogItemData);

        });
    });
}
exports.readUAAnalogItem = readUAAnalogItem;

