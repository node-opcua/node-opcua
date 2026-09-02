/**
 * @module node-opcua-address-space.Private
 */
import type {
    AddReferenceOpts,
    BaseNode,
    ConstructNodeIdOptions,
    CreateNodeOptions,
    ModellingRuleType,
    RequiredModel
} from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import type { NodeId } from "node-opcua-nodeid";

import type { Namespace } from "../api/namespace.js";
import type { AddressSpacePrivate } from "./address_space_private.js";

export interface NamespacePrivate extends Namespace {
    addressSpace: AddressSpacePrivate;

    setRequiredModels(requiredModels: RequiredModel[]): void;

    constructNodeId(options: ConstructNodeIdOptions): NodeId;

    resolveAlias(name: string): NodeId | null;

    dispose(): void;

    _register(node: BaseNode): void;

    _deleteNode(node: BaseNode): void;

    internalCreateNode(options: CreateNodeOptions): BaseNode;

    registerSymbolicNames: boolean;

    // the iteration members used to be redeclared here; INamespace publishes them now
}

export declare const NamespacePrivate: new (options: unknown) => NamespacePrivate;

function isValidModellingRule(ruleName: string) {
    return (
        ruleName === null ||
        ruleName === "Mandatory" ||
        ruleName === "Optional" ||
        ruleName === "OptionalPlaceholder" ||
        ruleName === "MandatoryPlaceholder" ||
        ruleName === "ExposesItsArray"
    );
}

/**
 * @param references
 * @param modellingRule
 * @private
 */
export function UANamespace_process_modelling_rule(references: AddReferenceOpts[], modellingRule?: ModellingRuleType): void {
    if (modellingRule) {
        assert(isValidModellingRule(modellingRule), "expecting a valid modelling rule");
        const modellingRuleName = `ModellingRule_${modellingRule}`;
        // assert(this.findNode(modellingRuleName),"Modelling rule must exist");
        references.push({
            nodeId: modellingRuleName,
            referenceType: "HasModellingRule"
        });
    }
}
