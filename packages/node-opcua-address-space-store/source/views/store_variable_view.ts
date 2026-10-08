/**
 * @module node-opcua-address-space-store
 *
 * A Variable over a node index: its value read from the value columns, or from the getter the
 * application bound to it; its writes into the columns, with a version bump the samplers see.
 */

import type { ISessionContext } from "node-opcua-address-space-base";
import { AttributeIds, isValidDataEncoding, type QualifiedNameLike } from "node-opcua-data-model";
import { DataValue, extractRange } from "node-opcua-data-value";
import { getCurrentClock } from "node-opcua-date-time";
import { NodeId } from "node-opcua-nodeid";
import type { NumericRange } from "node-opcua-numeric-range";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import { DataType, encodedVariant, sameVariant, Variant, VariantArrayType, type VariantLike } from "node-opcua-variant";
import { ResolvedType } from "../data_type_resolver.js";
import { NO_NODE } from "../node_id_index.js";
import { ValueKind } from "../value_store.js";
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
        // a reader in another thread cannot call the getter: it asks the owner
        this.space.store.nodes.setBound(this.index, !!(binding.get || binding.timestampedGet || binding.refreshFunc));
    }

    public override readAttribute(
        context: ISessionContext | null,
        attributeId: AttributeIds,
        indexRange?: NumericRange | null,
        dataEncoding?: QualifiedNameLike | null
    ): DataValue {
        // the Value goes through the getter and the permission gates; the rest is the columns
        return attributeId === AttributeIds.Value
            ? this.readValue(context, indexRange, dataEncoding)
            : super.readAttribute(context, attributeId, indexRange, dataEncoding);
    }

    /**
     * the current value: from the getter when one is bound, else from the columns. The gates
     * come first, the same ones as the node objects apply: the access level for every caller,
     * the access restrictions and the role permissions for a session. What is denied comes
     * back as a status stamped with the time of the denial, the value behind it undisclosed.
     */
    public readValue(
        context?: ISessionContext | null,
        indexRange?: NumericRange | null,
        dataEncoding?: QualifiedNameLike | null
    ): DataValue {
        const status = this.space.permissions.readValueStatus(context, this.index);
        if (status !== 0) {
            return deniedDataValue(status);
        }
        if (!isValidDataEncoding(dataEncoding)) {
            // Table 51: no encoding can be applied to a non-Structure value
            return deniedDataValue(StatusCodes.BadDataEncodingInvalid.value);
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
        // a copy: the services stamp timestamps on what they are given, the cached one stays as built;
        // extractRange makes that copy when a range is asked for
        const dataValue = this.#dataValueFromColumns();
        // an invalid range is not "defined" but must still be refused: anything but an empty one goes through
        return indexRange && !indexRange.isEmpty() && dataValue.statusCode.isGoodish()
            ? extractRange(dataValue, indexRange)
            : dataValue.clone();
    }

    /**
     * the application sets the value, as today: the timestamps are now unless given, and a
     * value the DataType does not accept is an error (a Null clears the value)
     */
    public setValueFromSource(variant: VariantLike, statusCode: StatusCode = StatusCodes.Good, sourceTimestamp?: Date): void {
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
    public writeValue(
        dataValue: DataValue,
        context?: ISessionContext | null,
        indexRange?: NumericRange | null,
        now: number = getCurrentClock().timestamp.getTime()
    ): number {
        if (context) {
            const status = this.space.permissions.writeValueStatus(context, this.index);
            if (status !== 0) {
                return status;
            }
        }
        if (!this.#accepts(dataValue.value, false)) {
            return StatusCodes.BadTypeMismatch.value;
        }
        if (indexRange && !indexRange.isEmpty()) {
            // the new elements land in the array the columns hold; what is stored is the whole array
            const merged = this.#mergeRange(dataValue.value, indexRange);
            if (typeof merged === "number") {
                return merged;
            }
            dataValue = new DataValue({
                value: merged,
                statusCode: dataValue.statusCode,
                sourceTimestamp: dataValue.sourceTimestamp,
                sourcePicoseconds: dataValue.sourcePicoseconds
            });
        }
        const binding = this.space.bindings.get(this.index);
        if (binding?.set) {
            // a setter answers with a StatusCode, its number, or nothing for Good
            const answer = binding.set(dataValue.value);
            const status = typeof answer === "number" ? answer : answer ? (answer as StatusCode).value : 0;
            if (status !== StatusCodes.Good.value) {
                return status;
            }
        }
        this.#storeVariant(
            dataValue.value,
            dataValue.statusCode.value,
            dataValue.sourceTimestamp ? dataValue.sourceTimestamp.getTime() : now,
            now
        );
        return StatusCodes.Good.value;
    }

    /** the stored array or matrix with `variant` written over `indexRange`, or the status that refuses it */
    #mergeRange(variant: Variant, indexRange: NumericRange): Variant | number {
        if (!indexRange.isValid()) {
            return StatusCodes.BadIndexRangeInvalid.value;
        }
        const values = this.space.store.values;
        if (values.kind(this.index) !== ValueKind.Object) {
            // a scalar, or nothing yet: there is no array to write into
            return StatusCodes.BadTypeMismatch.value;
        }
        const stored = values.get(this.index).value as {
            dataType: DataType;
            arrayType?: VariantArrayType;
            dimensions?: number[] | null;
            value: unknown;
        };
        const storedArrayType = stored.arrayType ?? VariantArrayType.Scalar;
        if (variant.arrayType === VariantArrayType.Array && storedArrayType === VariantArrayType.Array) {
            const result = indexRange.set_values(stored.value as never, variant.value as never);
            if (!result.statusCode.isGood()) {
                return result.statusCode.value;
            }
            return new Variant({ dataType: stored.dataType, arrayType: VariantArrayType.Array, value: result.array });
        }
        if (variant.arrayType === VariantArrayType.Matrix && storedArrayType === VariantArrayType.Matrix && stored.dimensions) {
            const result = indexRange.set_values_matrix(
                { matrix: stored.value as never, dimensions: stored.dimensions },
                variant.value as never
            );
            if (!result.statusCode.isGood()) {
                return result.statusCode.value;
            }
            return new Variant({
                dataType: stored.dataType,
                arrayType: VariantArrayType.Matrix,
                dimensions: stored.dimensions,
                value: result.matrix
            });
        }
        return StatusCodes.BadTypeMismatch.value;
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
            const written = { dataType: variant.dataType, arrayType: variant.arrayType, dimensions: variant.dimensions, value: v };
            values.setObject(this.index, variant.dataType, written, statusCode, sourceTimestamp, serverTimestamp);
            if (values.encodedLength(this.index) > 0) {
                // a shared store keeps only the bytes: the value just written spares the notifications
                // and the next reads a decode
                this.#dataValue = valueDataValue(values, this.index, written);
                this.#dataValueVersion = values.version(this.index);
            }
        }
        // what a monitored item delivered on change listens to, as on the node objects; a view
        // with listeners is the one every writer of this node reaches (see ViewCache)
        if (this.hasListeners()) {
            this.emit("value_changed", this.#changedDataValue());
        }
        // a historized Variable: the value goes to its historian, as on the node objects
        const historian = this.space.historians.get(this.index);
        if (historian) {
            historian.push(this.#changedDataValue()).catch(() => undefined);
        }
    }

    /**
     * what the listeners of a change get: a copy of the value. A structure kept in the shared heap goes as
     * its bytes (an EncodedVariant, decoded only if read), not as a deep copy of the object made at each write
     */
    #changedDataValue(): DataValue {
        const values = this.space.store.values;
        const encoded = values.dataType(this.index) === DataType.ExtensionObject ? values.encodedCopy(this.index) : null;
        if (!encoded) return this.#dataValueFromColumns().clone();
        const dataValue = valueDataValue(values, this.index, { dataType: DataType.Null, value: null });
        dataValue.value = encodedVariant(encoded);
        return dataValue;
    }

    /** the value through a callback, as the node objects offer it to the samplers; nothing here waits */
    public readValueAsync(context: ISessionContext | null, callback: (err: Error | null, dataValue?: DataValue) => void): void {
        callback(null, this.readValue(context));
    }

    /** true when the DataType takes numbers: what a deadband filter needs */
    public isNumberDataType(): boolean {
        const resolved = this.space.dataTypes.resolve(this.space.store.nodes.dataType(this.index));
        return resolved === ResolvedType.AbstractNumber || (resolved >= DataType.SByte && resolved <= DataType.Double);
    }

    /** true when the columns already hold this value with a Good status */
    #sameAsStored(variant: Variant): boolean {
        const values = this.space.store.values;
        const i = this.index;
        const v = variant.value;
        if (variant.arrayType !== VariantArrayType.Scalar || (typeof v !== "number" && typeof v !== "boolean")) {
            // a string, an array, a structure: compared with the Variant built from the columns
            return (
                values.kind(i) === ValueKind.Object &&
                values.statusCode(i) === 0 &&
                sameVariant(this.#dataValueFromColumns().value, variant)
            );
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
