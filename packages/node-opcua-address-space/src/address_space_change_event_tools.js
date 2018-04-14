"use strict";
/**
 * @module opcua.address_space
 *
 */

const NodeClass = require("node-opcua-data-model").NodeClass;
const BrowseDirection = require("node-opcua-data-model").BrowseDirection;

const assert = require("node-opcua-assert").assert;
const _ = require("underscore");

const Enum = require("node-opcua-enum");
const verbFlags = new Enum({
    //                         NodeAdded        0         Indicates the affected Node has been added.
    NodeAdded: 0x01,
    //                         NodeDeleted      1         Indicates the affected Node has been deleted.
    NodeDeleted: 0x02,
    //                         ReferenceAdded   2         Indicates a Reference has been added. The affected Node may
    ReferenceAdded: 0x04,
    //                                                    be either a SourceNode or TargetNode. Note that an added
    //                                                    bidirectional Reference is reflected by two ChangeStructures.
    //                         ReferenceDeleted 3         Indicates a Reference has been deleted. The affected Node may
    //                                                    be either a SourceNode or TargetNode. Note that a deleted
    //                                                    bidirectional Reference is reflected by two ChangeStructures.
    ReferenceDeleted: 0x08,
    //                         DataTypeChanged  4         This verb may be used only for affected Nodes that are
    //                                                    Variables or VariableTypes. It indicates that the DataType Attribute has changed.
    DataTypeChanged: 0x10
});

function makeVerb(verbs) {
    const e = verbFlags.get(verbs);
    assert(e !== null);
    return e.value;
}

function _handle_add_reference_change_event(node1, node2id) {
    const addressSpace = node1.addressSpace;
    const node2 = addressSpace.findNode(node2id);

    if (node1.nodeVersion || (node2 && node2.nodeVersion)) {
        // a event has to be send
        addressSpace.modelChangeTransaction(function() {
            function _getTypeDef(node) {
                if (node.nodeClass === NodeClass.Object || node.nodeClass === NodeClass.Variable) {
                    return node.typeDefinition.nodeId;
                }
                return null;
            }

            let modelChangeTgt = new ModelChangeStructure({
                affected: node1.nodeId,
                affectedType: _getTypeDef(node1),
                verb: makeVerb("ReferenceAdded")
            });
            addressSpace._collectModelChange(null, modelChangeTgt);

            modelChangeTgt = new ModelChangeStructure({
                affected: node2.nodeId,
                affectedType: _getTypeDef(node2),
                verb: makeVerb("ReferenceAdded")
            });
            addressSpace._collectModelChange(null, modelChangeTgt);
        });
    }
}
exports._handle_add_reference_change_event = _handle_add_reference_change_event;

const ModelChangeStructure = require("node-opcua-common").ModelChangeStructure;

try {
    ModelChangeStructure.prototype.toString = function(options) {
        if (!options) {
            return "";
        }
        const addressSpace = options.addressSpace;
        function n(nodeId) {
            if (!nodeId || nodeId.isEmpty()) {
                return "";
            }
            const n = addressSpace.findNode(nodeId);
            return '"' + nodeId.toString() + '"' + (" /* " + (n ? n.browseName.toString() : "???") + " */").yellow;
        }
        let str = "{ verb:" + verbFlags.get(this.verb).key + ",";
        str += " affected: " + n(this.affected) + ",";
        str += " type: " + n(this.affectedType) + " }";
        return str;
    };
} catch (err) {}

function _handle_model_change_event(node) {
    const addressSpace = node.addressSpace;
    //
    const parent = node.parent;
    if (parent && parent.nodeVersion) {
        addressSpace.modelChangeTransaction(function() {
            let typeDefinitionNodeId = null;

            if (node.nodeClass === NodeClass.Object || node.nodeClass === NodeClass.Variable) {
                typeDefinitionNodeId = node.typeDefinition.nodeId;
            }

            const modelChange1 = new ModelChangeStructure({
                affected: node.nodeId,
                affectedType: typeDefinitionNodeId,
                verb: makeVerb("NodeAdded")
            });
            addressSpace._collectModelChange(null, modelChange1);

            const modelChangeSrc = new ModelChangeStructure({
                affected: parent.nodeId,
                affectedType: null,
                verb: makeVerb("ReferenceAdded")
            });
            addressSpace._collectModelChange(null, modelChangeSrc);

            // bidirectional
            if (node.nodeVersion) {
                const modelChangeTgt = new ModelChangeStructure({
                    affected: node.nodeId,
                    affectedType: typeDefinitionNodeId,
                    verb: makeVerb("ReferenceAdded")
                });
                addressSpace._collectModelChange(null, modelChangeTgt);
            }
        });
    }
}
exports._handle_model_change_event = _handle_model_change_event;

function _handle_delete_node_model_change_event(node) {
    const addressSpace = node.addressSpace;

    // get backward references
    const references = node.findReferencesEx("HierarchicalReferences", BrowseDirection.Inverse);

    const parentNodes = references.map(function(r) {
        return addressSpace.findNode(r.nodeId);
    });
    const versionableNodes = parentNodes.filter(function(node) {
        return node.nodeVersion !== null;
    });

    if (versionableNodes.length >= 1 || node.nodeVersion !== null) {
        addressSpace.modelChangeTransaction(function() {
            // ...
            references.forEach(function(r) {
                const target = addressSpace.findNode(r.nodeId);
                const modelChangeSrc = new ModelChangeStructure({
                    affected: target.nodeId,
                    affectedType: null,
                    verb: makeVerb("ReferenceDeleted")
                });
                addressSpace._collectModelChange(null, modelChangeSrc);
            });
            const modelChangeSrc = new ModelChangeStructure({
                affected: node.nodeId,
                affectedType: node.typeDefinition,
                verb: makeVerb("NodeDeleted")
            });
            addressSpace._collectModelChange(null, modelChangeSrc);
        });
    }
}
exports._handle_delete_node_model_change_event = _handle_delete_node_model_change_event;
