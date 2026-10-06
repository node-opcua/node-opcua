/**
 * @module node-opcua-address-space-store
 *
 * What a Variable's DataType accepts: the built-in type a DataType node resolves to through
 * its HasSubtype ancestors, and whether a Variant of a given built-in type may be written to a
 * Variable of that DataType. Same rules as the node objects apply (findCorrespondingBasicDataType
 * and verifyVariantCompatibility), answered on indexes and remembered per DataType.
 */

import { NodeId, NodeIdType } from "node-opcua-nodeid";
import { DataType } from "node-opcua-variant";
import type { CompactStore } from "./compact_store.js";
import { NO_NODE } from "./node_id_index.js";

const HAS_SUBTYPE = new NodeId(NodeIdType.NUMERIC, 45, 0);
const STRUCTURE = 22;
const BASE_DATA_TYPE = 24;
const NUMBER = 26;
const INTEGER = 27;
const UINTEGER = 28;
const ENUMERATION = 29;

/** what the DataType resolves to for a write: a built-in type, or one of these */
export enum ResolvedType {
    /** any value (BaseDataType) */
    Any = -1,
    /** any numeric value of a subtype (Number, Integer, UInteger) */
    AbstractNumber = -2,
    /** an extension object of a subtype of Structure */
    Structure = -3,
    /** nothing resolved: the DataType is unknown to the store */
    Unknown = -4
}

export class DataTypeResolver {
    readonly #store: CompactStore;
    // by DataType node index; built-in types are their own answer
    readonly #resolved = new Map<number, number>();
    // the node index of each built-in type, by DataType value
    #builtIn: Int32Array | null = null;

    constructor(store: CompactStore) {
        this.#store = store;
    }

    /** after DataType nodes or HasSubtype references changed */
    public invalidate(): void {
        this.#resolved.clear();
        this.#builtIn = null;
    }

    /** the built-in DataType a DataType node stands for, or a ResolvedType marker */
    public resolve(dataType: number): number {
        if (dataType === NO_NODE) return ResolvedType.Any;
        const known = this.#resolved.get(dataType);
        if (known !== undefined) return known;
        const resolved = this.#walk(dataType, 0);
        this.#resolved.set(dataType, resolved);
        return resolved;
    }

    /** true when `dataType` is `ancestor` or a subtype of it */
    public isSubtypeOf(dataType: number, ancestor: number): boolean {
        let node = dataType;
        for (let depth = 0; node !== NO_NODE && depth < 64; depth++) {
            if (node === ancestor) return true;
            node = this.#parentOf(node);
        }
        return false;
    }

    /**
     * true when a Variant of built-in type `variantType` may be written to a Variable of
     * DataType `dataType`. A Null variant is accepted when `allowNull`: the application may
     * clear a value, a client may not.
     */
    public accepts(dataType: number, variantType: DataType, allowNull: boolean): boolean {
        if (variantType === DataType.Null) return allowNull;
        if (dataType === NO_NODE) return true;
        const resolved = this.resolve(dataType);
        switch (resolved) {
            case ResolvedType.Any:
            case ResolvedType.Unknown:
                return true;
            case ResolvedType.Structure:
                return variantType === DataType.ExtensionObject;
            case ResolvedType.AbstractNumber: {
                // Number, Integer, UInteger: a value whose own type descends from them
                const builtIn = this.#builtInNode(variantType);
                return builtIn !== NO_NODE && this.isSubtypeOf(builtIn, dataType);
            }
            default:
                break;
        }
        if (resolved === DataType.Variant) return true;
        if (resolved === variantType) return true;
        // a string and a byte string stand in for one another, as they do for the node objects
        if (resolved === DataType.String && variantType === DataType.ByteString) return true;
        if (resolved === DataType.ByteString && variantType === DataType.String) return true;
        return false;
    }

    #walk(dataType: number, depth: number): number {
        if (depth > 64) return ResolvedType.Unknown;
        const nodes = this.#store.nodes;
        if (nodes.namespace(dataType) === 0 && nodes.nodeId(dataType).identifierType === NodeIdType.NUMERIC) {
            const id = nodes.nodeId(dataType).value as number;
            if (id === ENUMERATION) return DataType.Int32;
            if (id === BASE_DATA_TYPE) return ResolvedType.Any;
            if (id === NUMBER || id === INTEGER || id === UINTEGER) return ResolvedType.AbstractNumber;
            if (id === STRUCTURE) return ResolvedType.Structure;
            if (id > 0 && id <= 25) return id;
        }
        const parent = this.#parentOf(dataType);
        if (parent === NO_NODE) return ResolvedType.Unknown;
        const resolved = this.#walk(parent, depth + 1);
        // a subtype of an abstract number is a concrete one: Int32 is Number's child but stands alone
        return resolved;
    }

    #parentOf(dataType: number): number {
        const parents = this.#store.targets(dataType, HAS_SUBTYPE, false);
        return parents.length > 0 ? parents[0] : NO_NODE;
    }

    #builtInNode(variantType: DataType): number {
        if (this.#builtIn === null) {
            this.#builtIn = new Int32Array(32).fill(NO_NODE);
            for (let id = 1; id <= 25; id++) {
                this.#builtIn[id] = this.#store.find(new NodeId(NodeIdType.NUMERIC, id, 0));
            }
        }
        return variantType > 0 && variantType <= 25 ? this.#builtIn[variantType] : NO_NODE;
    }
}
