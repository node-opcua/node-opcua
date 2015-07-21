"use strict";

/**
 * @module opcua.address_space
 */
require("requirish")._(module);
var assert = require("better-assert");

var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
var NodeId = require("lib/datamodel/nodeid").NodeId;
var makeNodeId = require("lib/datamodel/nodeid").makeNodeId;
var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;

var DataValue = require("lib/datamodel/datavalue").DataValue;
var DataType = require("lib/datamodel/variant").DataType;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

var util = require("util");
var _ = require("underscore");

var dumpIf = require("lib/misc/utils").dumpIf;

var translate_service = require("lib/services/translate_browse_paths_to_node_ids_service");
var BrowsePathResult = translate_service.BrowsePathResult;
var BrowsePath = translate_service.BrowsePath;

var stringToQualifiedName = require("lib/tools/tools_browse_path").stringToQualifiedName;

exports.install = function (AddressSpace) {

    /**
     * browse some path.
     *
     * @method browsePath
     * @param  {BrowsePath} browsePath
     * @return {BrowsePathResult}
     *
     * This service can be used translates one or more browse paths into NodeIds.
     * A browse path is constructed of a starting Node and a RelativePath. The specified starting Node
     * identifies the Node from which the RelativePath is based. The RelativePath contains a sequence of
     * ReferenceTypes and BrowseNames.
     *
     *   |StatusCode                    |                                                            |
     *   |------------------------------|:-----------------------------------------------------------|
     *   |BadNodeIdUnknown              |                                                            |
     *   |BadNodeIdInvalid              |                                                            |
     *   |BadNothingToDo                | - the relative path contains an empty list )               |
     *   |BadBrowseNameInvalid          | - target name is missing in relative path                  |
     *   |UncertainReferenceOutOfServer | - The path element has targets which are in another server.|
     *   |BadTooManyMatches             |                                                            |
     *   |BadQueryTooComplex            |                                                            |
     *   |BadNoMatch                    |                                                            |
     */
    AddressSpace.prototype.browsePath = function (browsePath) {

        var self = this;

        assert(browsePath instanceof translate_service.BrowsePath);

        var startingNode = self.findObject(browsePath.startingNode);
        if (!startingNode) {
            return new BrowsePathResult({statusCode: StatusCodes.BadNodeIdUnknown});
        }

        if (browsePath.relativePath.elements.length === 0) {
            return new BrowsePathResult({statusCode: StatusCodes.BadNothingToDo});
        }

        // The last element in the relativePath shall always have a targetName specified.
        var l = browsePath.relativePath.elements.length;
        var last_el = browsePath.relativePath.elements[l - 1];

        if (!last_el.targetName || !last_el.targetName.name || last_el.targetName.name.length === 0) {
            return new BrowsePathResult({statusCode: StatusCodes.BadBrowseNameInvalid});
        }

        var res = [];

        function explore_element(curNodeObject, elements, index) {

            var element = elements[index];
            assert(element instanceof translate_service.RelativePathElement);

            var nodeIds = curNodeObject.browseNodeByTargetName(element);

            var targets = nodeIds.map(function (nodeId) {
                return {
                    targetId: nodeId,
                    remainingPathIndex: elements.length - index
                };
            });

            var is_last = ( (index + 1) === elements.length);

            if (!is_last) {
                // explorer
                targets.forEach(function (target) {
                    var node = self.findObject(target.targetId);
                    explore_element(node, elements, index + 1);
                });
            } else {
                targets.forEach(function (target) {
                    res.push({
                        targetId: target.targetId,
                        remainingPathIndex: 0xFFFFFFFF
                    });
                });
            }
        }

        explore_element(startingNode, browsePath.relativePath.elements, 0);

        if (res.length === 0) {
            return new BrowsePathResult({statusCode: StatusCodes.BadNoMatch});
        }

        return new BrowsePathResult({
            statusCode: StatusCodes.Good,
            targets: res
        });
    };

    var rootFolderId = makeNodeId(84); // RootFolder


    /**
     * convert a path string to a BrowsePath
     *
     * @method constructBrowsePath
     * @param startingNode {NodeId|string}
     * @param path {string} path such as Objects.Server
     * @return {BrowsePath}
     *
     * @example:
     *
     *   ```javascript
     *   constructBrowsePath("/","Objects");
     *   constructBrowsePath("/","Objects.Server");
     *   constructBrowsePath("/","Objects.4:Boilers");
     *   ```
     *
     *  - '#' : HasSubtype
     *  - '.' : Organizes , HasProperty, HasComponent, HasNotifier
     *  - '&' : HasTypeDefinition
     *
     */
    function constructBrowsePath(startingNode, path) {

        if (startingNode === "/") {
            startingNode = rootFolderId;
        }

        var arr = path.split(".");
        var elements = arr.map(function (browsePathElement) {

            var targetName = stringToQualifiedName(browsePathElement);

            return {
                referenceTypeId: makeNodeId(0),
                isInverse: false,
                includeSubtypes: false,
                targetName: targetName
            };
        });

        var browsePath = new BrowsePath({
            startingNode: rootFolderId, // ROOT
            relativePath: {
                elements: elements
            }
        });
        return browsePath;
    }

    exports.constructBrowsePath = constructBrowsePath;

    /**
     * a simplified version of browsePath that takes a path as a string
     * and returns a single node or null if not found.
     * @method simpleBrowsePath
     * @param startingNode
     * @param pathname
     * @return {BrowsePathTarget}
     */
    AddressSpace.prototype.simpleBrowsePath = function (startingNode, pathname) {
        var browsePath = constructBrowsePath(startingNode, pathname);
        var browsePathResult = this.browsePath(browsePath);
        if (browsePathResult.statusCode !== StatusCodes.Good) {
            console.log("browsePathResult.statusCode = ",browsePathResult.statusCode.toString());
            return null; // not found
        } else {
            assert(browsePathResult.targets.length >= 1);
            browsePathResult.targets[browsePathResult.targets.length - 1].remainingPathIndex.should.equal(0xFFFFFFFF);
            return browsePathResult.targets[browsePathResult.targets.length - 1].targetId;
        }
    };

};