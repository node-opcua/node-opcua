/**
 * @module node-opcua-address-space.Private
 */
import { assert } from "node-opcua-assert";
import { NodeId } from "node-opcua-nodeid";
import {
    AddReferenceOpts,
    BaseNode,
    ConstructNodeIdOptions,
    CreateNodeOptions,
    ModellingRuleType,
    INamespace,
    UADataType
} from "node-opcua-address-space-base";

import { AddressSpacePrivate } from "./address_space_private";

export interface NamespacePrivate extends INamespace {
    addressSpace: AddressSpacePrivate;

    nodeIterator(): IterableIterator<BaseNode>;

    constructNodeId(options: ConstructNodeIdOptions): NodeId;

    resolveAlias(name: string): NodeId | null;

    dispose(): void;

    _register(node: BaseNode): void;

    _deleteNode(node: BaseNode): void;

    internalCreateNode(options: CreateNodeOptions): BaseNode;

    _dataTypeIterator(): IterableIterator<UADataType>;
}

export declare const NamespacePrivate: new (options: any) => NamespacePrivate;

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
