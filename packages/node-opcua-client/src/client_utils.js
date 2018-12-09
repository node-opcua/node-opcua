"use strict";


const assert = require("node-opcua-assert").assert;
const _ = require("underscore");

const resolveNodeId = require("node-opcua-nodeid").resolveNodeId;

const translate_browse_paths_to_node_ids_service = require("node-opcua-service-translate-browse-path");
const BrowsePath = translate_browse_paths_to_node_ids_service.BrowsePath;

const StatusCodes = require("node-opcua-status-code").StatusCodes;
const AttributeIds = require("node-opcua-data-model").AttributeIds;

const hasPropertyRefId = resolveNodeId("HasProperty");
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

    const browsePath = [
        browsePathPropertyRequest(nodeId, "EngineeringUnits"),
        browsePathPropertyRequest(nodeId, "EURange"),
        browsePathPropertyRequest(nodeId, "InstrumentRange"),
        browsePathPropertyRequest(nodeId, "ValuePrecision"),
        browsePathPropertyRequest(nodeId, "Definition")
    ];

    const analogItemData = {
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

        const actions = [];
        const nodesToRead = [];

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

        session.read(nodesToRead, function (err,dataValues) {
            if (err) {
                return callback(err);
            }
            dataValues.forEach(function (result, index) {
                actions[index].call(null, result);
            });
            callback(err, analogItemData);

            // console.log("analogItemData = ",analogItemData);

        });
    });
}
exports.readUAAnalogItem = readUAAnalogItem;

