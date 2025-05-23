/**
 * @module node-opcua-address-space
 */
import chalk from "chalk";

import { UAReference, BaseNode, UAObject, UAVariable, UAObjectType, UAVariableType } from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import { BrowseDirection, NodeClass } from "node-opcua-data-model";
import { Enum, EnumItem } from "node-opcua-enum";
import { NodeId } from "node-opcua-nodeid";
import { ModelChangeStructureDataType } from "node-opcua-types";

import { AddressSpacePrivate } from "./address_space_private";
import { BaseNodeImpl } from "./base_node_impl";

const verbFlags = new Enum({
    //                         NodeAdded        0         Indicates the affected Node has been added.
    NodeAdded: 0x01,

    //                         NodeDeleted      1         Indicates the affected Node has been deleted.
    NodeDeleted: 0x02,

    //                         ReferenceAdded   2         Indicates a Reference has been added. The affected Node may
    //                                                    be either a SourceNode or TargetNode. Note that an added
    //                                                    bidirectional Reference is reflected by two ChangeStructures.
    ReferenceAdded: 0x04,
    //                         ReferenceDeleted 3         Indicates a Reference has been deleted. The affected Node may
    //                                                    be either a SourceNode or TargetNode. Note that a deleted
    //                                                    bidirectional Reference is reflected by two ChangeStructures.
    ReferenceDeleted: 0x08,

    //                         DataTypeChanged  4         This verb may be used only for affected Nodes that are
    //                                                    Variables or VariableTypes. It indicates that the DataType
    //                                                    Attribute has changed.
    DataTypeChanged: 0x10
});

function makeVerb(verbs: any): number {
    const e: EnumItem = verbFlags.get(verbs)!;
    assert(e !== null);
    return e.value;
}

function _getTypeDef(node: BaseNode) {
    if (node.nodeClass === NodeClass.Object || node.nodeClass === NodeClass.Variable) {
        return (<UAVariable | UAObject>node).typeDefinitionObj.nodeId;
    }
    return null;
}
export function _handle_add_reference_change_event(node1: BaseNode, node2id: NodeId): void {
    
    const addressSpace = node1.addressSpace as AddressSpacePrivate;
    const node2 = addressSpace.findNode(node2id);
    if (!node2) return;

    if (node1.getNodeVersion() ||node2.getNodeVersion()) {

        // a event has to be send
        addressSpace.modelChangeTransaction(() => {

            let modelChangeTgt = new ModelChangeStructureDataType({
                affected: node1.nodeId,
                affectedType: _getTypeDef(node1),
                verb: makeVerb("ReferenceAdded")
            });

            addressSpace._collectModelChange(null, modelChangeTgt);

            modelChangeTgt = new ModelChangeStructureDataType({
                affected: node2.nodeId,
                affectedType: _getTypeDef(node2),
                verb: makeVerb("ReferenceAdded")
            });

            addressSpace._collectModelChange(null, modelChangeTgt);
        });
    }
}

try {
    (ModelChangeStructureDataType as any).prototype.toString = function (options: any): string {
        if (!options) {
            return "";
        }
        const addressSpace = options.addressSpace;

        function n(nodeId: NodeId | null) {
            if (!nodeId || nodeId.isEmpty()) {
                return "";
            }
            const node = addressSpace.findNode(nodeId)!;
            return '"' + nodeId.toString() + '"' + chalk.yellow(" /* " + (node ? node.browseName.toString() : "???") + " */");
        }

        let str = "{ verb:" + verbFlags.get(this.verb)!.key + ",";
        str += " affected: " + n(this.affected) + ",";
        str += " type: " + n(this.affectedType) + " }";
        return str;
    };
} catch (err) {
    //
}

export function _handle_model_change_event(node: BaseNodeImpl): void {
    const addressSpace = node.addressSpace as AddressSpacePrivate;
    //
    const parents = node.parent ? [node.parent] : [];

    const containingFolders = node.findReferencesExAsObject("Organizes", BrowseDirection.Inverse);

    let typeDefinitionNodeId: NodeId | null = null;
    if (node.nodeClass === NodeClass.Object || node.nodeClass === NodeClass.Variable) {
        typeDefinitionNodeId = node.typeDefinitionObj.nodeId;
    }
    for (const parent of [...parents, ...containingFolders]) {
        if (parent && parent.getNodeVersion()) {
            addressSpace.modelChangeTransaction(() => {
                const modelChange1 = new ModelChangeStructureDataType({
                    affected: node.nodeId,
                    affectedType: typeDefinitionNodeId,
                    verb: makeVerb("NodeAdded")
                });
                addressSpace._collectModelChange(null, modelChange1);

                const modelChangeSrc = new ModelChangeStructureDataType({
                    affected: parent.nodeId,
                    affectedType: null,
                    verb: makeVerb("ReferenceAdded")
                });
                addressSpace._collectModelChange(null, modelChangeSrc);

                // bidirectional
                if (node.getNodeVersion()) {
                    const modelChangeTgt = new ModelChangeStructureDataType({
                        affected: node.nodeId,
                        affectedType: typeDefinitionNodeId,
                        verb: makeVerb("ReferenceAdded")
                    });
                    addressSpace._collectModelChange(null, modelChangeTgt);
                }
            });
        }
    }
}

export function _handle_delete_node_model_change_event(node: BaseNode): void {
    const addressSpace = node.addressSpace as AddressSpacePrivate;

    // get backward references
    const references = node.findReferencesEx("HierarchicalReferences", BrowseDirection.Inverse)!;

    const parentNodes = references.map((r: UAReference) => {
        return addressSpace.findNode(r.nodeId)! as BaseNode;
    });

    const versionableNodes = parentNodes.filter((n) => null!=n.getNodeVersion());

    if (versionableNodes.length >= 1 || node.getNodeVersion()) {
        addressSpace.modelChangeTransaction(() => {
            // ...
            for (const r of references) {
                const target = addressSpace.findNode(r.nodeId)!;

                const modelChangeSrc_l = new ModelChangeStructureDataType({
                    affected: target.nodeId,
                    affectedType: null,
                    verb: makeVerb("ReferenceDeleted")
                });

                addressSpace._collectModelChange(null, modelChangeSrc_l);
            }

            const modelChangeSrc = new ModelChangeStructureDataType({
                affected: node.nodeId,
                affectedType: (<UAVariable | UAObject>node).typeDefinition,
                verb: makeVerb("NodeDeleted")
            });

            addressSpace._collectModelChange(null, modelChangeSrc);
        });
    }
}
