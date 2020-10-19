/**
 * @module node-opcua-address-space.Private
 */
import { assert } from "node-opcua-assert";
import { NodeId } from "node-opcua-nodeid";
import { AddReferenceOpts, ConstructNodeIdOptions, CreateNodeOptions, ModellingRuleType, Namespace } from "../source";
import { AddressSpacePrivate } from "./address_space_private";
import { BaseNode } from "./base_node";

export interface NamespacePrivate extends Namespace {
    addressSpace: AddressSpacePrivate;

    nodeIterator(): IterableIterator<BaseNode>;

    constructNodeId(options: ConstructNodeIdOptions): NodeId;

    resolveAlias(name: string): NodeId | null;

    dispose(): void;

    _register(node: BaseNode): void;

    _deleteNode(node: BaseNode): void;

    _createNode(options: CreateNodeOptions): BaseNode;
}

export declare const NamespacePrivate: new (options: any) => NamespacePrivate;

function isValidModellingRule(ruleName: string) {
    // let restrict to Mandatory or Optional for the time being
    return ruleName === null || ruleName === "Mandatory" || ruleName === "Optional";
}

/**
 * @param references
 * @param modellingRule
 * @private
 */
export function UANamespace_process_modelling_rule(references: AddReferenceOpts[], modellingRule: ModellingRuleType): void {
    if (modellingRule) {
        assert(isValidModellingRule(modellingRule), "expecting a valid modelling rule");
        const modellingRuleName = "ModellingRule_" + modellingRule;
        // assert(this.findNode(modellingRuleName),"Modelling rule must exist");
        references.push({
            nodeId: modellingRuleName,
            referenceType: "HasModellingRule"
        });
    }
}
