/**
 * @module node-opcua-address-space
 *
 * Extracted from namespace_impl.ts to break an import cycle.
 *
 * namespace_impl builds `_constructors_map` at module scope, which references
 * UAMethodImpl and seven sibling constructors. ua_method_impl imported
 * _handle_hierarchy_parent back from namespace_impl, closing the loop.
 *
 * Under CommonJS that is harmless: whichever module loads second sees a partially
 * populated exports object, and nothing touches the missing half until a function runs.
 * Under ESM the class declarations are in the temporal dead zone while the cycle is being
 * evaluated, so building a map of constructors at module scope throws a ReferenceError.
 *
 * This module depends only on base_node_impl and leaf packages, so nothing points back
 * into namespace_impl and the cycle is gone rather than moved.
 */

import type { AddReferenceOpts, BaseNode } from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import { NodeClass } from "node-opcua-data-model";
import { NodeId, type NodeIdLike } from "node-opcua-nodeid";
import type { AddressSpacePrivate } from "./address_space_private.js";
import { BaseNodeImpl } from "./base_node_impl.js";

/**
 * convert a 'string', NodeId or Object into a valid and existing object
 * @private
 */
export function _coerce_parent(
    addressSpace: AddressSpacePrivate,
    value: null | string | BaseNode | undefined | NodeIdLike,
    coerceFunc: (data: string | NodeId | BaseNode) => BaseNode | null
): BaseNode | null {
    assert(typeof coerceFunc === "function");
    if (value) {
        if (typeof value === "string") {
            value = coerceFunc.call(addressSpace, value);
        }
        if (value instanceof NodeId) {
            value = addressSpace.findNode(value) as BaseNode;
        }
    }
    assert(!value || value instanceof BaseNodeImpl);
    return value as BaseNode;
}

export interface HandleHierarchyParentOptions {
    addInOf?: NodeIdLike | BaseNode | null | undefined;
    componentOf?: NodeIdLike | BaseNode | null | undefined;
    propertyOf?: NodeIdLike | BaseNode | null | undefined;
    organizedBy?: NodeIdLike | BaseNode | null | undefined;
    encodingOf?: NodeIdLike | BaseNode | null | undefined;
}

export function _handle_hierarchy_parent(
    addressSpace: AddressSpacePrivate,
    references: AddReferenceOpts[],
    options: HandleHierarchyParentOptions
): void {
    options.addInOf = _coerce_parent(addressSpace, options.addInOf, addressSpace._coerceNode);
    options.componentOf = _coerce_parent(addressSpace, options.componentOf, addressSpace._coerceNode);
    options.propertyOf = _coerce_parent(addressSpace, options.propertyOf, addressSpace._coerceNode);
    options.organizedBy = _coerce_parent(addressSpace, options.organizedBy, addressSpace._coerceFolder);
    options.encodingOf = _coerce_parent(addressSpace, options.encodingOf, addressSpace._coerceNode);

    if (options.addInOf) {
        assert(!options.componentOf);
        assert(!options.propertyOf);
        assert(!options.organizedBy);
        assert(
            options.addInOf.nodeClass === NodeClass.Object || options.addInOf.nodeClass === NodeClass.ObjectType,
            "addInOf must be of nodeClass Object or ObjectType"
        );
        references.push({
            isForward: false,
            nodeId: options.addInOf.nodeId,
            referenceType: "HasAddIn"
        });
    }

    if (options.componentOf) {
        assert(!options.addInOf);
        assert(!options.propertyOf);
        assert(!options.organizedBy);
        assert(addressSpace.rootFolder.objects, "addressSpace must have a rootFolder.objects folder");
        assert(
            options.componentOf.nodeId !== addressSpace.rootFolder.objects.nodeId,
            "Only Organizes References are used to relate Objects to the 'Objects' standard Object."
        );
        references.push({
            isForward: false,
            nodeId: options.componentOf.nodeId,
            referenceType: "HasComponent"
        });
    }

    if (options.propertyOf) {
        assert(!options.addInOf);
        assert(!options.componentOf);
        assert(!options.organizedBy);
        assert(
            options.propertyOf.nodeId !== addressSpace.rootFolder.objects.nodeId,
            "Only Organizes References are used to relate Objects to the 'Objects' standard Object."
        );
        references.push({
            isForward: false,
            nodeId: options.propertyOf.nodeId,
            referenceType: "HasProperty"
        });
    }

    if (options.organizedBy) {
        assert(!options.addInOf);
        assert(!options.propertyOf);
        assert(!options.componentOf);
        references.push({
            isForward: false,
            nodeId: options.organizedBy.nodeId,
            referenceType: "Organizes"
        });
    }

    if (options.encodingOf) {
        // parent must be a DataType
        assert(options.encodingOf.nodeClass === NodeClass.DataType, "encodingOf must be toward a DataType");
        references.push({
            isForward: false,
            nodeId: options.encodingOf.nodeId,
            referenceType: "HasEncoding"
        });
    }
}
