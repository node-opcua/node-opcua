import type { LocalizedTextLike, QualifiedNameLike } from "node-opcua-data-model";
import type { NodeIdLike } from "node-opcua-nodeid";
import type { AddReferenceOpts, BaseNode } from "./base_node.js";
import type { ModellingRuleType } from "./modelling_rule_type.js";
import type { INamespace } from "./namespace.js";

export interface InstantiateOptions {
    /**
     * the browse name of the new node to instantiate
     */
    browseName: QualifiedNameLike;

    /**
     * an optional description
     *
     * if not provided the default description of the corresponding Type
     * will be used.
     */
    description?: LocalizedTextLike;

    /**
     * an optional displayName
     *
     * if not provided the default description of the corresponding browseName
     * will be used.
     */
    displayName?: LocalizedTextLike | null;

    /**
     * the parent Folder holding this object
     *
     * note
     *  - when organizedBy is specified, componentOf nor addInOf must not be defined
     */
    organizedBy?: NodeIdLike | BaseNode;

    /**
     * the declared parent, as `ParentNodeId` in a NodeSet: the instance's parent
     * and what its symbolic name is built from, even when the only reference
     * between the two is `Organizes` (a folder a type organizes is
     * `<Type>_<Folder>` in the ModelCompiler's NodeIds.csv).
     * See {@link AddBaseNodeOptions.parentNodeId}.
     */
    parentNodeId?: NodeIdLike | BaseNode;

    /**
     *  the parent Object holding this object
     * note
     *  - when componentOf is specified, organizedBy nor addInOf must not be defined
     */
    componentOf?: NodeIdLike | BaseNode;

    /**
     *
     */
    notifierOf?: NodeIdLike | BaseNode;

    /**
     *
     */
    eventSourceOf?: NodeIdLike | BaseNode;

    /**
     * a list of components and properties names that have a HasModellingRule of Optional in the
     * type definition that we want to instantiate.
     * Note:
     *  - the name must follow the OPCUA naming convention and match the browse name of the property (same case)
     *  - the name can be composed to represent a path to a property or component
     *
     * @example
     *
     * ```javascript
     *   optionals: ["MyOptionalVariable", "MyOptionalMethod", "MyOptionalComponent.MyProperty"];
     * ```
     *
     * @default: []
     */
    optionals?: string[];
    /**
     * additional references to create on the new node at construction time.
     *
     * Use it to link the instance to a parent through an aggregate reference
     * that has no dedicated option (HasOrderedComponent, HasPhysicalComponent,
     * HasContainedComponent, HasAttachedComponent ...):
     *
     * ```javascript
     *   references: [{ referenceType: "HasOrderedComponent", isForward: false, nodeId: listNode }]
     * ```
     *
     * Because the reference exists when the node is created, the NodeIdManager
     * derives the symbolic name from that parent (`List_First`), exactly as it
     * does for `componentOf`; adding the reference afterwards would leave the
     * node named without its parent. Such a parent also counts when deciding
     * whether modelling rules are copied (an instance declared inside a type).
     */
    references?: AddReferenceOpts[];
    /**
     * modellingRule
     */
    modellingRule?: ModellingRuleType;
    /**
     * a (optional) predefined nodeId to assigned to the instance
     * If not specified, a default nodeid will be created.
     */
    nodeId?: NodeIdLike;

    /**
     * the namespace in which the node shall be instantiated
     * (if not specified, the default instance namespace (`own namespace`)  of the addressSpace will be used)
     */
    namespace?: INamespace;

    /**
     * shall we also replicate the HasModelling rule reference ?
     */
    copyAlsoModellingRules?: boolean;
    copyAlsoAllOptionals?: boolean;
}
