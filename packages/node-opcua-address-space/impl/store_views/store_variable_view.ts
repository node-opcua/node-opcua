/**
 * @module node-opcua-address-space
 *
 * A Variable over a node index: its value read from the value columns, or from the getter the
 * application bound to it; its writes into the columns, with a version bump the samplers see.
 */
import type { ISessionContext } from "node-opcua-address-space-base";
import { NO_NODE, ValueKind } from "node-opcua-address-space-store";
import { AttributeIds } from "node-opcua-data-model";
import type { DataValue } from "node-opcua-data-value";
import { getCurrentClock } from "node-opcua-date-time";
import { NodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant, VariantArrayType, type VariantLike } from "node-opcua-variant";
import type { StoreAddressSpace } from "./store_address_space.js";
import { deniedDataValue, valueDataValue } from "./store_data_value.js";
import { StoreNodeView, type VariableBinding } from "./store_node_view.js";

export class StoreVariableView extends StoreNodeView {
    // the DataValue built for the value's version: handed out again until the value moves
    #dataValue: DataValue | undefined;
    #dataValueVersion = -1;

    constructor(space: StoreAddressSpace, index: number) {
        super(space, index);
    }

    public get dataType(): NodeId {
        const t = this.space.store.nodes.dataType(this.index);
        return t === NO_NODE ? NodeId.nullNodeId : this.space.store.nodes.nodeId(t);
    }
    public get valueRank(): number {
        return this.space.store.nodes.valueRank(this.index);
    }
    public get accessLevel(): number {
        return this.space.store.nodes.accessLevel(this.index);
    }
    public get userAccessLevel(): number {
        return this.space.store.nodes.userAccessLevel(this.index);
    }
    public get minimumSamplingInterval(): number {
        return this.space.store.nodes.minimumSamplingInterval(this.index);
    }
    public get historizing(): boolean {
        return this.space.store.nodes.historizing(this.index);
    }

    /** the version word of the value: moves on every write, what a sampler compares */
    public get valueVersion(): number {
        return this.space.store.values.version(this.index);
    }

    public bindVariable(binding: VariableBinding): void {
        this.space.bindings.set(this.index, binding);
    }

    public override readAttribute(context: ISessionContext | null, attributeId: AttributeIds): DataValue {
        // the Value goes through the getter and the permission gates; the rest is the columns
        return attributeId === AttributeIds.Value ? this.readValue(context) : super.readAttribute(context, attributeId);
    }

    /**
     * the current value: from the getter when one is bound, else from the columns. The gates
     * come first, the same ones as the node objects apply: the access level for every caller,
     * the access restrictions and the role permissions for a session. What is denied comes
     * back as a status stamped with the time of the denial, the value behind it undisclosed.
     */
    public readValue(context?: ISessionContext | null): DataValue {
        const status = this.space.permissions.readValueStatus(context, this.index);
        if (status !== 0) {
            return deniedDataValue(status);
        }
        const binding = this.space.bindings.get(this.index);
        if (binding?.get) {
            const variant = binding.get();
            // the getter's value is also what the columns hold, so a sampler or another
            // thread reading the columns sees it; unchanged, it is not written again
            if (!this.#sameAsStored(variant)) {
                const now = getCurrentClock().timestamp.getTime();
                this.#storeVariant(variant, StatusCodes.Good.value, now, now);
            }
        }
        // a copy: the services stamp timestamps on what they are given, the cached one stays as built
        return this.#dataValueFromColumns().clone();
    }

    /**
     * the application sets the value, as today: the timestamps are now unless given, and a
     * value the DataType does not accept is an error (a Null clears the value)
     */
    public setValueFromSource(variant: VariantLike, statusCode = StatusCodes.Good, sourceTimestamp?: Date): void {
        const v = variant instanceof Variant ? variant : new Variant(variant);
        if (!this.#accepts(v, true)) {
            throw new Error(
                `StoreVariableView#setValueFromSource ${this.browseName.toString()} ${this.nodeId.toString()}: ` +
                    `a ${DataType[v.dataType]} value does not fit DataType ${this.dataType.toString()}`
            );
        }
        const now = getCurrentClock();
        const source = sourceTimestamp ? sourceTimestamp.getTime() : now.timestamp.getTime();
        this.#storeVariant(v, statusCode.value, source, now.timestamp.getTime());
    }

    /**
     * a Write from a client: the gates first when a context is given (the same as the node
     * objects apply), the DataType, then the setter when one is bound, else the columns
     */
    public writeValue(dataValue: DataValue, context?: ISessionContext | null): number {
        if (context) {
            const status = this.space.permissions.writeValueStatus(context, this.index);
            if (status !== 0) {
                return status;
            }
        }
        if (!this.#accepts(dataValue.value, false)) {
            return StatusCodes.BadTypeMismatch.value;
        }
        const binding = this.space.bindings.get(this.index);
        if (binding?.set) {
            const status = binding.set(dataValue.value);
            if (typeof status === "number" && status !== StatusCodes.Good.value) {
                return status;
            }
        }
        const now = getCurrentClock().timestamp.getTime();
        this.#storeVariant(
            dataValue.value,
            dataValue.statusCode.value,
            dataValue.sourceTimestamp ? dataValue.sourceTimestamp.getTime() : now,
            now
        );
        return StatusCodes.Good.value;
    }

    /** true when the Variable's DataType takes a value of the variant's built-in type */
    #accepts(variant: Variant, allowNull: boolean): boolean {
        return this.space.dataTypes.accepts(this.space.store.nodes.dataType(this.index), variant.dataType, allowNull);
    }

    #storeVariant(variant: Variant, statusCode: number, sourceTimestamp: number, serverTimestamp: number): void {
        const values = this.space.store.values;
        const scalar = variant.arrayType === VariantArrayType.Scalar;
        const v = variant.value;
        if (scalar && (typeof v === "number" || typeof v === "boolean")) {
            values.setScalar(this.index, variant.dataType, v, statusCode, sourceTimestamp, serverTimestamp);
        } else {
            values.setObject(
                this.index,
                variant.dataType,
                { dataType: variant.dataType, arrayType: variant.arrayType, dimensions: variant.dimensions, value: v },
                statusCode,
                sourceTimestamp,
                serverTimestamp
            );
        }
    }

    /** true when the columns already hold this scalar value with a Good status */
    #sameAsStored(variant: Variant): boolean {
        const values = this.space.store.values;
        const i = this.index;
        const v = variant.value;
        if (variant.arrayType !== VariantArrayType.Scalar || (typeof v !== "number" && typeof v !== "boolean")) {
            return false;
        }
        const kind = values.kind(i);
        if (kind !== (typeof v === "boolean" ? ValueKind.Boolean : ValueKind.Number)) {
            return false;
        }
        return (
            values.statusCode(i) === 0 &&
            values.dataType(i) === variant.dataType &&
            values.number(i) === (typeof v === "boolean" ? (v ? 1 : 0) : v)
        );
    }

    #dataValueFromColumns(): DataValue {
        const values = this.space.store.values;
        const i = this.index;
        const version = values.version(i);
        if (this.#dataValue !== undefined && this.#dataValueVersion === version) {
            return this.#dataValue;
        }
        const dataValue = this.#buildDataValue();
        this.#dataValue = dataValue;
        this.#dataValueVersion = version;
        return dataValue;
    }

    #buildDataValue(): DataValue {
        return valueDataValue(this.space.store.values, this.index);
    }
}
export { DataType };
