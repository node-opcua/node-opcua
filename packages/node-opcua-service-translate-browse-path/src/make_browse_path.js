"use strict";
const assert = require("node-opcua-assert").assert;


const BrowsePath = require("../_generated_/_auto_generated_BrowsePath").BrowsePath;
const makeRelativePath = require("./make_relative_path").makeRelativePath;

const resolveNodeId = require("node-opcua-nodeid").resolveNodeId;

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
