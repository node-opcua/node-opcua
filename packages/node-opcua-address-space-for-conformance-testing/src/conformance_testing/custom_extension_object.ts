/**
 * The concrete ExtensionObject the Static, Dynamic and Mass folders hold.
 *
 * This package cannot choose one on its own. Namespace zero has no concrete
 * structure worth exercising here - `Structure` (i=22) is abstract and the
 * rest are service types - and a usable one lives in a companion nodeset that
 * only the caller knows it has loaded. So the caller passes the behaviour in:
 * which DataType to build, and how to move its fields for the Dynamic folder.
 *
 * Without these options every ExtensionObject variable keeps a null
 * ExtensionObject, which is what the package did before and what its own tests
 * (namespace zero only) still exercise.
 *
 * A CTT server that has loaded the AutoID nodeset, for instance:
 *
 *     build_address_space_for_conformance_testing(addressSpace, {
 *         extensionObject: {
 *             dataType: "RfidSighting",
 *             randomFields: () => ({
 *                 antenna: 1 + Math.floor(Math.random() * 4),
 *                 strength: -80 + Math.floor(Math.random() * 60),
 *                 currentPowerLevel: 10 + Math.floor(Math.random() * 20),
 *                 timestamp: new Date()
 *             })
 *         }
 *     });
 */
import type { AddressSpace } from "node-opcua-address-space";
import type { NodeIdLike } from "node-opcua-nodeid";

export interface CustomExtensionObjectOptions {
    /**
     * DataType of the structure to build: a browse name ("RfidSighting") or a
     * NodeId, in a namespace the caller has already loaded. A DataType this
     * address space cannot find is an error - a silent fallback to null would
     * look like the option had been ignored.
     */
    dataType: NodeIdLike;
    /** field values of the static instances; the DataType's own defaults when omitted */
    initialFields?: Record<string, unknown>;
    /** field values for the Dynamic folder, called on every simulation tick */
    randomFields?: () => Record<string, unknown>;
}

export interface CustomExtensionObject {
    /** browse name of the structure, for descriptions */
    readonly typeName: string;
    /** a fresh instance carrying the initial field values */
    initialValue(): unknown;
    /** a fresh instance carrying new field values, or the initial one when no randomFields was given */
    random(): unknown;
}

/**
 * `findDataType("RfidSighting")` searches namespace zero only, and a companion
 * structure is never there. A bare browse name is therefore looked up in every
 * loaded namespace, so the caller does not have to know the index the nodeset
 * happened to land on. A NodeId, or a "1:RfidSighting" qualified name, still
 * resolves directly.
 */
function findDataTypeAnywhere(addressSpace: AddressSpace, dataType: NodeIdLike) {
    const direct = addressSpace.findDataType(dataType as string);
    if (direct) return direct;
    if (typeof dataType !== "string" || dataType.includes("=") || dataType.includes(":")) return null;
    for (let index = 1; index < addressSpace.getNamespaceArray().length; index++) {
        const found = addressSpace.findDataType(dataType, index);
        if (found) return found;
    }
    return null;
}

/** one row of the typeAndDefaultValue table, as the builders see it */
interface TypeEntry {
    type: string;
    realType?: string;
    defaultValue: unknown;
}

/**
 * The initial value of a typeAndDefaultValue row, with the caller's structure
 * standing in for the ExtensionObject row when one was supplied.
 */
export function initialValueFor(entry: TypeEntry, custom?: CustomExtensionObject): unknown {
    if (custom && (entry.realType ?? entry.type) === "ExtensionObject") return custom.initialValue();
    return typeof entry.defaultValue === "function" ? (entry.defaultValue as () => unknown)() : entry.defaultValue;
}

export function resolveCustomExtensionObject(
    addressSpace: AddressSpace,
    options?: CustomExtensionObjectOptions
): CustomExtensionObject | undefined {
    if (!options) return undefined;
    const dataType = findDataTypeAnywhere(addressSpace, options.dataType);
    if (!dataType) {
        throw new Error(
            `extensionObject.dataType ${options.dataType} is not in the address space: load the nodeset that defines it first`
        );
    }
    const build = (fields?: Record<string, unknown>) => addressSpace.constructExtensionObject(dataType, fields ?? {});
    return {
        typeName: dataType.browseName.name ?? String(options.dataType),
        initialValue: () => build(options.initialFields),
        random: () => build(options.randomFields ? options.randomFields() : options.initialFields)
    };
}
