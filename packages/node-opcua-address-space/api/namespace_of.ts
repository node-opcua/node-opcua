import type { BaseNode } from "node-opcua-address-space-base";
import type { Namespace } from "./namespace.js";

/**
 * The namespace a node belongs to, seen through the published {@link Namespace}.
 *
 * `BaseNode.namespace` is declared in node-opcua-address-space-base, which cannot name the
 * alarm-and-condition, data-access and machine-state methods this package adds without
 * depending on it. So a caller holding only a node saw the narrower `INamespace`, and reaching
 * `instantiateAlarmCondition` meant asserting the type at every call site.
 *
 * The same mismatch was already corrected for `AddressSpace.getOwnNamespace()`, which used to
 * return the narrower interface and hide those methods. This closes the remaining case: the
 * assertion happens once, here, where both types are in scope.
 *
 * ```ts
 * const alarm = namespaceOf(deviceNode).instantiateAlarmCondition(alarmType, {
 *     browseName: "FailureAlarm",
 *     conditionSource: deviceNode,
 *     inputNode: deviceHealthNode
 * });
 * ```
 */
export function namespaceOf(node: BaseNode): Namespace {
    // every namespace in this address space is a NamespaceImpl, which satisfies Namespace;
    // only the declaration BaseNode can reach is narrower
    return node.namespace as Namespace;
}
