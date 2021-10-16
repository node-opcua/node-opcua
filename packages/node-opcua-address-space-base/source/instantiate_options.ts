import { QualifiedNameLike, LocalizedTextLike } from "node-opcua-data-model";
import { NodeIdLike } from "node-opcua-nodeid";

import { BaseNode } from "./base_node";
import { ModellingRuleType } from "./modelling_rule_type";
import { INamespace } from "./namespace";

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
     *  - when organizedBy is specified, componentOf must not be defined
     */
    organizedBy?: NodeIdLike | BaseNode;

    /**
     *  the parent Object holding this object
     * note
     *  - when componentOf is specified, organizedBy must not be defined
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
}
