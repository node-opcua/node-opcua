import { AddressSpace, SessionContext, type UAMethod, type UAObject } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import type { ISessionContext } from "node-opcua-address-space-base";
import { NodeClass } from "node-opcua-data-model";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import type { CallMethodResultOptions } from "node-opcua-service-call";
import { AliasNameDataType, AliasNameVerboseDataType } from "node-opcua-types";
import { DataType, type Variant, VariantArrayType } from "node-opcua-variant";

/** A fresh address space with the standard nodeset (which carries Part 17). */
export async function makeAddressSpace(): Promise<AddressSpace> {
    const addressSpace = AddressSpace.create();
    await generateAddressSpace(addressSpace, nodesets.standard);
    addressSpace.registerNamespace("urn:test:alias-names");
    return addressSpace;
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
    const inputArguments: Variant[] = [
        { dataType: DataType.String, value: pattern } as Variant,
        // an omitted ReferenceTypeFilter arrives as the null NodeId, which is
        // what a Client sends; `null` is not a legal Variant value here
        { dataType: DataType.NodeId, value: referenceTypeFilter ?? NodeId.nullNodeId } as Variant
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
