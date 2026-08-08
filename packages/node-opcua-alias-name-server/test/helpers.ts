import { AddressSpace, SessionContext, type UAMethod, type UAObject, type UAVariable } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import type { ISessionContext } from "node-opcua-address-space-base";
import { NodeClass } from "node-opcua-data-model";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import type { CallMethodResultOptions } from "node-opcua-service-call";
import type { AliasNameDataType, AliasNameVerboseDataType } from "node-opcua-types";
import { DataType, VariantArrayType, type VariantLike } from "node-opcua-variant";
import { addAliasCategory } from "../source/bind_alias_category.js";
import { installAliasNamesOnAddressSpace } from "../source/install_alias_names.js";

/**
 * A fresh address space with the standard nodeset (which carries Part 17).
 *
 * Loading and parsing the standard nodeset costs roughly a second, so this is
 * the dominant cost of the whole suite. Prefer {@link sharedAddressSpace} and
 * per-test isolation via {@link uniqueCategory}; reach for a private one only
 * when a test genuinely needs a pristine address space — one that checks the
 * pre-installation state, or that installs with its own options, since
 * installation is once per address space.
 */
export async function makeAddressSpace(): Promise<AddressSpace> {
    const addressSpace = AddressSpace.create();
    await generateAddressSpace(addressSpace, nodesets.standard);
    addressSpace.registerNamespace("urn:test:alias-names");
    return addressSpace;
}

let shared: AddressSpace | null = null;
let sharedInstall: Promise<AddressSpace> | null = null;

/**
 * One address space, loaded once for the whole run, with AliasNames installed
 * using the default options.
 *
 * Tests share it and stay isolated by working inside their own category (see
 * {@link uniqueCategory}) rather than by rebuilding the address space. Do not
 * mutate the three well-known categories directly from a test that uses this.
 */
export async function sharedAddressSpace(): Promise<AddressSpace> {
    if (!sharedInstall) {
        sharedInstall = (async () => {
            shared = await makeAddressSpace();
            await installAliasNamesOnAddressSpace(shared);
            return shared;
        })();
    }
    return sharedInstall;
}

/** Dispose the shared address space, if one was created. */
export function disposeSharedAddressSpace(): void {
    shared?.dispose();
    shared = null;
    sharedInstall = null;
}

let categoryCounter = 0;

/**
 * A fresh `AliasNameCategoryType` instance under `parent`, with a name no other
 * test uses.
 *
 * This is what makes the shared address space safe: `FindAlias` is scoped to the
 * category it is called on, so aliases added here are invisible to every other
 * test even though the address space is shared. Categories are cheap; address
 * spaces are not.
 */
export function uniqueCategory(addressSpace: AddressSpace, parent: NodeId | UAObject, label = "Cat"): UAObject {
    categoryCounter += 1;
    return addAliasCategory(addressSpace, parent, `${label}_${categoryCounter}`);
}

/** A Variable with a name no other test uses, for use as an alias target. */
export function uniqueVariable(addressSpace: AddressSpace, label = "V"): UAVariable {
    categoryCounter += 1;
    return addressSpace.getOwnNamespace().addVariable({
        browseName: `${label}_${categoryCounter}`,
        dataType: "Double"
    }) as UAVariable;
}

/** An Object with a name no other test uses, for use as a non-Variable target. */
export function uniqueObject(addressSpace: AddressSpace, label = "O"): UAObject {
    categoryCounter += 1;
    return addressSpace.getOwnNamespace().addObject({ browseName: `${label}_${categoryCounter}` });
}

/**
 * The session context Method calls run under.
 *
 * `SessionContext.defaultContext` is the real thing, so access-restriction and
 * executable checks in `UAMethod.execute` run as they would on a live Server.
 */
export function defaultContext(): ISessionContext {
    return SessionContext.defaultContext;
}

/** Look up an Object by NodeId, failing loudly if it is not there. */
export function getObject(addressSpace: AddressSpace, nodeId: NodeId | string): UAObject {
    const node = addressSpace.findNode(typeof nodeId === "string" ? resolveNodeId(nodeId) : nodeId);
    if (!node || node.nodeClass !== NodeClass.Object) {
        throw new Error(`expecting an Object at ${String(nodeId)}`);
    }
    return node as UAObject;
}

/** The Method with this BrowseName on `parent`, or null. */
export function getMethod(parent: UAObject, browseName: string): UAMethod | null {
    for (const component of parent.getComponents()) {
        if (component.nodeClass === NodeClass.Method && component.browseName.name === browseName) {
            return component as UAMethod;
        }
    }
    return null;
}

/** Call FindAlias / FindAliasVerbose on a category and return the raw result. */
export async function callFind(
    category: UAObject,
    methodName: "FindAlias" | "FindAliasVerbose",
    pattern: string | null,
    referenceTypeFilter?: NodeId
): Promise<CallMethodResultOptions> {
    const method = getMethod(category, methodName);
    if (!method) {
        throw new Error(`${category.browseName.toString()} has no ${methodName} Method`);
    }
    const inputArguments: VariantLike[] = [
        { dataType: DataType.String, value: pattern },
        // an omitted ReferenceTypeFilter arrives as the null NodeId, which is
        // what a Client sends; `null` is not a legal Variant value here
        { dataType: DataType.NodeId, value: referenceTypeFilter ?? NodeId.nullNodeId }
    ];
    return method.execute(category, inputArguments, defaultContext());
}

/** The AliasNameDataType array a FindAlias call produced. */
export function resultAliases(result: CallMethodResultOptions): AliasNameDataType[] {
    const output = result.outputArguments?.[0];
    const value = (output as { value?: unknown } | undefined)?.value;
    return (value ?? []) as AliasNameDataType[];
}

/** The AliasNameVerboseDataType array a FindAliasVerbose call produced. */
export function resultVerbose(result: CallMethodResultOptions): AliasNameVerboseDataType[] {
    const output = result.outputArguments?.[0];
    const value = (output as { value?: unknown } | undefined)?.value;
    return (value ?? []) as AliasNameVerboseDataType[];
}

/** The alias names a FindAlias call returned, sorted for stable comparison. */
export function aliasNames(result: CallMethodResultOptions): string[] {
    return resultAliases(result)
        .map((a) => a.aliasName.name ?? "")
        .sort();
}

export { VariantArrayType };
