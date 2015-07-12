"use strict";

require("requirish")._(module);
var assert = require("better-assert");
var translate_service = require("lib/services/translate_browse_paths_to_node_ids_service");
var BrowsePathResult = translate_service.BrowsePathResult;
var BrowsePath = translate_service.BrowsePath;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var makeNodeId = require("lib/datamodel/nodeid").makeNodeId;
var ReferenceTypeIds = require("lib/opcua_node_ids").ReferenceTypeIds;
var hierarchicalReferencesId =makeNodeId(ReferenceTypeIds.HierarchicalReferences);



/**
 *
 * @param browsePathElemen {String}
 * @returns {{namespaceIndex: Number, name: String}}
 *
 * @example
 *
 *  stringToQualifiedName("Hello")   => {namespaceIndex: 0, name: "Hello"}
 *  stringToQualifiedName("3:Hello") => {namespaceIndex: 3, name: "Hello"}
 */
function stringToQualifiedName(browsePathElement) {

    var split_array = browsePathElement.split(":");
    var namespaceIndex = 0;
    if (split_array.length === 2) {
        namespaceIndex = parseInt(split_array[0]);
        browsePathElement = split_array[1];
    }
    return  {namespaceIndex: namespaceIndex, name: browsePathElement};
}
exports.stringToQualifiedName = stringToQualifiedName;

function constructBrowsePathFromQualifiedName(startingNode,browsePath) {

    var elements =  browsePath.map(function(targetName) {
        return {
            referenceTypeId: hierarchicalReferencesId,
            isInverse: false,
            includeSubtypes: true,
            targetName: targetName
        };
    });

    var browsePath = new BrowsePath({
        startingNode: startingNode.nodeId, // ROOT
        relativePath: {
            elements: elements
        }
    });
    return browsePath;
}
exports.constructBrowsePathFromQualifiedName = constructBrowsePathFromQualifiedName;

