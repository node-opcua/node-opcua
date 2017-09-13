"use strict";
var assert = require("node-opcua-assert");


var BrowsePath = require("../_generated_/_auto_generated_BrowsePath").BrowsePath;
var makeRelativePath = require("./make_relative_path").makeRelativePath;

var resolveNodeId = require("node-opcua-nodeid").resolveNodeId;

function _get_nodeId(node) {
    if (node.nodeId) {
        return node.nodeId;
    }
    return resolveNodeId(node);
}

function makeBrowsePath(rootNode,relativePathBNF) {
    return new BrowsePath({
        startingNode: _get_nodeId(rootNode),
        relativePath: makeRelativePath(relativePathBNF)
    });
}

exports.makeBrowsePath = makeBrowsePath;
