/**
 * @module node-opcua-address-space-store
 *
 * Nodes and references added to the store while it runs, with the options the object
 * namespace takes (browseName, componentOf/organizedBy/propertyOf, typeDefinition, dataType,
 * value): the records go into the columns and the view comes back.
 */

import { AccessLevelFlag, type LocalizedTextLike, NodeClass, QualifiedName, type QualifiedNameLike } from "node-opcua-data-model";
import { NodeId, type NodeIdLike, NodeIdType, resolveNodeId } from "node-opcua-nodeid";
import { Argument, type ArgumentOptions } from "node-opcua-types";
import { DataType, VariantArrayType, type VariantLike } from "node-opcua-variant";
import type { NodeRecord, RolePermissionEntry } from "../node_store.js";
import type { StoreAddressSpace } from "./store_address_space.js";
import type { StoreMethodView } from "./store_method_view.js";
import type { StoreNodeView, VariableBinding } from "./store_node_view.js";
import type { StoreVariableView } from "./store_variable_view.js";

type NodeRef = StoreNodeView | NodeIdLike;

export interface StoreAddNodeOptions {
    browseName: QualifiedNameLike;
    /** allocated in the namespace when omitted: numeric, from 1000 up */
    nodeId?: NodeIdLike;
    /** the namespace of an allocated nodeId and of a string browse name; the last registered one when omitted */
    namespaceIndex?: number;
    displayName?: LocalizedTextLike;
    description?: LocalizedTextLike;
    componentOf?: NodeRef;
    organizedBy?: NodeRef;
    propertyOf?: NodeRef;
    typeDefinition?: NodeRef;
    /** more references, both ends written */
    references?: { referenceType: NodeIdLike; isForward?: boolean; nodeId: NodeRef }[];
    accessRestrictions?: number;
    rolePermissions?: readonly RolePermissionEntry[];
}

export interface StoreAddVariableOptions extends StoreAddNodeOptions {
    /** a DataType node, or the name of a built-in type ("Double") */
    dataType: NodeRef;
    valueRank?: number;
    accessLevel?: number;
    userAccessLevel?: number;
    minimumSamplingInterval?: number;
    historizing?: boolean;
    /** an initial value, or the getter and setter the variable is bound to */
    value?: VariantLike | VariableBinding;
}

export interface StoreAddObjectOptions extends StoreAddNodeOptions {
    eventNotifier?: number;
}

export interface StoreAddMethodOptions extends StoreAddNodeOptions {
    /** what the Method takes: its InputArguments property */
    inputArguments?: ArgumentOptions[];
    /** what it returns: its OutputArguments property */
    outputArguments?: ArgumentOptions[];
}

const HAS_COMPONENT = resolveNodeId("ns=0;i=47");
const HAS_PROPERTY = resolveNodeId("ns=0;i=46");
const ORGANIZES = resolveNodeId("ns=0;i=35");
const HAS_TYPE_DEFINITION = resolveNodeId("ns=0;i=40");
const BASE_OBJECT_TYPE = resolveNodeId("ns=0;i=58");
const FOLDER_TYPE = resolveNodeId("ns=0;i=61");
const BASE_DATA_VARIABLE_TYPE = resolveNodeId("ns=0;i=63");
const PROPERTY_TYPE = resolveNodeId("ns=0;i=68");
const ARGUMENT = resolveNodeId("ns=0;i=296");

export class StoreNodeBuilder {
    readonly #space: StoreAddressSpace;
    // the next numeric identifier to try, by namespace
    readonly #nextId = new Map<number, number>();

    constructor(space: StoreAddressSpace) {
        this.#space = space;
    }

    public addVariable(options: StoreAddVariableOptions): StoreVariableView {
        const typeDefinition = options.typeDefinition ?? (options.propertyOf ? PROPERTY_TYPE : BASE_DATA_VARIABLE_TYPE);
        const accessLevel = options.accessLevel ?? AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite;
        const index = this.#addNode(
            NodeClass.Variable,
            { ...options, typeDefinition },
            {
                dataType: this.#dataType(options.dataType),
                valueRank: options.valueRank ?? -1,
                accessLevel,
                userAccessLevel: options.userAccessLevel ?? accessLevel,
                minimumSamplingInterval: options.minimumSamplingInterval,
                historizing: options.historizing
            }
        );
        const view = this.#space.viewOf(index) as StoreVariableView;
        const value = options.value;
        if (value) {
            if (isBinding(value)) view.bindVariable(value);
            else view.setValueFromSource(value);
        }
        return view;
    }

    public addObject(options: StoreAddObjectOptions): StoreNodeView {
        const index = this.#addNode(
            NodeClass.Object,
            { ...options, typeDefinition: options.typeDefinition ?? BASE_OBJECT_TYPE },
            { eventNotifier: options.eventNotifier }
        );
        return this.#space.viewOf(index);
    }

    public addMethod(options: StoreAddMethodOptions): StoreMethodView {
        const index = this.#addNode(NodeClass.Method, { ...options, typeDefinition: undefined }, {});
        const method = this.#space.viewOf(index) as StoreMethodView;
        const declare = (name: string, args: ArgumentOptions[] | undefined) => {
            if (!args) return;
            this.addVariable({
                browseName: new QualifiedName({ namespaceIndex: 0, name }),
                namespaceIndex: method.nodeId.namespace,
                propertyOf: method,
                dataType: ARGUMENT,
                valueRank: 1,
                accessLevel: AccessLevelFlag.CurrentRead,
                value: {
                    dataType: DataType.ExtensionObject,
                    arrayType: VariantArrayType.Array,
                    value: args.map((a) => new Argument(a))
                }
            });
        };
        declare("InputArguments", options.inputArguments);
        declare("OutputArguments", options.outputArguments);
        return method;
    }

    public addFolder(parent: NodeRef, options: StoreAddNodeOptions | string): StoreNodeView {
        const o = typeof options === "string" ? { browseName: options } : options;
        return this.addObject({ ...o, organizedBy: parent, typeDefinition: o.typeDefinition ?? FOLDER_TYPE });
    }

    /** a reference between two existing nodes; false when it is there already */
    public addReference(source: NodeRef, referenceType: NodeIdLike, target: NodeRef, forward = true): boolean {
        const from = this.#index(source);
        const to = this.#index(target);
        const added = this.#space.store.link(from, resolveNodeId(referenceType), forward, to);
        this.#afterReferenceChange(resolveNodeId(referenceType));
        if (added) this.#space.onLink?.(from, to);
        return added;
    }

    public removeReference(source: NodeRef, referenceType: NodeIdLike, target: NodeRef, forward = true): boolean {
        const removed = this.#space.store.unlink(this.#index(source), resolveNodeId(referenceType), forward, this.#index(target));
        this.#afterReferenceChange(resolveNodeId(referenceType));
        return removed;
    }

    /** the index of the node a caller named by view or NodeId; an unknown one is an error */
    public indexOf(ref: NodeRef): number {
        return this.#index(ref);
    }

    #addNode(nodeClass: NodeClass, options: StoreAddNodeOptions, extra: Partial<NodeRecord>): number {
        const space = this.#space;
        const store = space.store;
        const namespace = options.namespaceIndex ?? this.#defaultNamespace();
        const nodeId = options.nodeId ? resolveNodeId(options.nodeId) : this.#allocate(namespace);
        const browseName = coerceBrowseName(options.browseName, namespace);
        const displayName = textOf(options.displayName);
        // the parent the object namespace declares: the aggregating one
        const parentRef = options.componentOf ?? options.propertyOf;
        const parent = parentRef ? this.#index(parentRef) : undefined;
        const typeDefinition = options.typeDefinition ? this.#index(options.typeDefinition) : undefined;
        const index = store.addNode({
            nodeId,
            nodeClass,
            browseName: browseName.name ?? "",
            browseNameNamespace: browseName.namespaceIndex,
            displayName: displayName && displayName !== browseName.name ? displayName : null,
            description: textOf(options.description) ?? null,
            parent,
            typeDefinition,
            accessRestrictions: options.accessRestrictions,
            rolePermissions: options.rolePermissions,
            ...extra
        });
        const link = (source: number, referenceType: NodeId, forward: boolean, target: number) => {
            store.link(source, referenceType, forward, target);
            space.onLink?.(source, target);
        };
        if (typeDefinition !== undefined) link(index, HAS_TYPE_DEFINITION, true, typeDefinition);
        if (options.componentOf) link(this.#index(options.componentOf), HAS_COMPONENT, true, index);
        if (options.propertyOf) link(this.#index(options.propertyOf), HAS_PROPERTY, true, index);
        if (options.organizedBy) link(this.#index(options.organizedBy), ORGANIZES, true, index);
        for (const r of options.references ?? []) {
            link(index, resolveNodeId(r.referenceType), r.isForward ?? true, this.#index(r.nodeId));
        }
        if (nodeClass === NodeClass.ReferenceType) {
            space.browser.refresh();
        } else if (nodeClass === NodeClass.DataType) {
            space.dataTypes.invalidate();
        }
        space.permissions.invalidate();
        return index;
    }

    #afterReferenceChange(referenceType: NodeId): void {
        // a HasSubtype changes what "include subtypes" means for reference types, and what a
        // DataType resolves to
        if (referenceType.namespace === 0 && referenceType.value === 45) {
            this.#space.browser.refresh();
            this.#space.dataTypes.invalidate();
        }
    }

    #index(ref: NodeRef): number {
        if (typeof ref === "object" && ref !== null && "index" in ref && typeof (ref as StoreNodeView).index === "number") {
            return (ref as StoreNodeView).index;
        }
        const nodeId = resolveNodeId(ref as NodeIdLike);
        const index = this.#space.store.find(nodeId);
        if (index === -1) {
            throw new Error(`StoreAddressSpace: no node ${nodeId.toString()}`);
        }
        return index;
    }

    #dataType(ref: NodeRef): number {
        if (typeof ref === "string" && !ref.includes("=")) {
            const builtIn = DataType[ref as keyof typeof DataType];
            if (typeof builtIn === "number") {
                return this.#index(makeNumeric(builtIn, 0));
            }
        }
        return this.#index(ref);
    }

    #defaultNamespace(): number {
        const n = this.#space.namespaceUris.length;
        if (n < 2) {
            throw new Error("StoreAddressSpace: register a namespace before adding nodes to it");
        }
        return n - 1;
    }

    #allocate(namespace: number): NodeId {
        const store = this.#space.store;
        let id = this.#nextId.get(namespace) ?? 1000;
        let nodeId = makeNumeric(id, namespace);
        while (store.find(nodeId) !== -1) {
            nodeId = makeNumeric(++id, namespace);
        }
        this.#nextId.set(namespace, id + 1);
        return nodeId;
    }
}

function makeNumeric(value: number, namespace: number): NodeId {
    return new NodeId(NodeIdType.NUMERIC, value, namespace);
}

function coerceBrowseName(name: QualifiedNameLike, namespace: number): QualifiedName {
    if (name instanceof QualifiedName) return name;
    if (typeof name === "string") {
        const colon = name.indexOf(":");
        if (colon > 0) {
            const prefix = parseInt(name.slice(0, colon), 10);
            if (!Number.isNaN(prefix)) return new QualifiedName({ namespaceIndex: prefix, name: name.slice(colon + 1) });
        }
        return new QualifiedName({ namespaceIndex: namespace, name });
    }
    return new QualifiedName(name);
}

function textOf(text: LocalizedTextLike | undefined): string | undefined {
    if (text === undefined || text === null) return undefined;
    return typeof text === "string" ? text : (text.text ?? undefined);
}

function isBinding(value: VariantLike | VariableBinding): value is VariableBinding {
    const v = value as VariableBinding;
    return (
        typeof v.get === "function" ||
        typeof v.set === "function" ||
        typeof v.timestampedGet === "function" ||
        typeof v.refreshFunc === "function"
    );
}
