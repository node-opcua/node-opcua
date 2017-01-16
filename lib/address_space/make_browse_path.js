require("requirish")._(module);
const assert = require("better-assert");


const BrowsePath = require("lib/services/translate_browse_paths_to_node_ids_service").BrowsePath;
const resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;
const makeRelativePath = require("lib/address_space/make_relative_path").makeRelativePath;

function makeBrowsePath(rootNode,relativePathBNF) {

    function _get_nodeId(node) {
        if (node.nodeId) {
            return node.nodeId;
        }
        return resolveNodeId(node)
    }
    return new BrowsePath({
        startingNode: _get_nodeId(rootNode),
        relativePath: makeRelativePath(relativePathBNF)
    });
}

exports.makeBrowsePath = makeBrowsePath;
