/**
 * @module node-opcua-address-space
 *
 * A Variable over a node index: its value read from the value columns, or from the getter the
 * application bound to it; its writes into the columns, with a version bump the samplers see.
 */
import { NO_NODE, ValueKind } from "node-opcua-address-space-store";
import { DataValue } from "node-opcua-data-value";
import { getCurrentClock } from "node-opcua-date-time";
import type { NodeId } from "node-opcua-nodeid";
import { coerceStatusCode, StatusCodes } from "node-opcua-status-code";
import { DataType, Variant, VariantArrayType, type VariantLike } from "node-opcua-variant";
import type { StoreAddressSpace } from "./store_address_space.js";
import { StoreNodeView, type VariableBinding } from "./store_node_view.js";

export class StoreVariableView extends StoreNodeView {
    constructor(space: StoreAddressSpace, index: number) {
        super(space, index);
    }

    public get dataType(): NodeId {
        const t = this.space.store.nodes.dataType(this.index);
        return t === NO_NODE ? new (this.nodeId.constructor as new () => NodeId)() : this.space.store.nodes.nodeId(t);
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

    /** the current value: from the getter when one is bound, else from the columns */
    public readValue(): DataValue {
        const binding = this.space.bindings.get(this.index);
        if (binding?.get) {
            const variant = binding.get();
            const now = getCurrentClock();
            // the getter's value is also what the columns hold, so a sampler or another
            // thread reading the columns sees it
            this.#storeVariant(variant, StatusCodes.Good.value, now.timestamp.getTime(), now.timestamp.getTime());
            return this.#dataValueFromColumns();
        }
        return this.#dataValueFromColumns();
    }

    /** the application sets the value, as today: the timestamps are now unless given */
    public setValueFromSource(variant: VariantLike, statusCode = StatusCodes.Good, sourceTimestamp?: Date): void {
        const now = getCurrentClock();
        const source = sourceTimestamp ? sourceTimestamp.getTime() : now.timestamp.getTime();
        this.#storeVariant(
            variant instanceof Variant ? variant : new Variant(variant),
            statusCode.value,
            source,
            now.timestamp.getTime()
        );
    }

    /** a Write from a client: through the setter when one is bound, else into the columns */
    public writeValue(dataValue: DataValue): number {
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

    #dataValueFromColumns(): DataValue {
        const values = this.space.store.values;
        const i = this.index;
        const kind = values.kind(i);
        if (kind === ValueKind.None) {
            const status = values.statusCode(i);
            return new DataValue({
                statusCode: status === 0 ? StatusCodes.BadWaitingForInitialData : coerceStatusCode(status)
            });
        }
        const stored = values.get(i);
        let variant: Variant;
        if (kind === ValueKind.Object) {
            const o = stored.value as {
                dataType: DataType;
                arrayType?: VariantArrayType;
                dimensions?: number[] | null;
                value: unknown;
            };
            variant = new Variant({
                dataType: o.dataType,
                arrayType: o.arrayType ?? VariantArrayType.Scalar,
                dimensions: o.dimensions ?? undefined,
                value: o.value
            });
        } else {
            variant = new Variant({ dataType: stored.dataType, arrayType: VariantArrayType.Scalar, value: stored.value });
        }
        return new DataValue({
            value: variant,
            statusCode: coerceStatusCode(stored.statusCode),
            sourceTimestamp: new Date(stored.sourceTimestamp),
            sourcePicoseconds: stored.sourcePicoseconds,
            serverTimestamp: new Date(stored.serverTimestamp),
            serverPicoseconds: stored.serverPicoseconds
        });
    }
}
export { DataType };
