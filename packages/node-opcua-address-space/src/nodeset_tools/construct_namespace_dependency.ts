import { INamespace } from "node-opcua-address-space-base";
import { NamespacePrivate } from "../namespace_private";
import { BaseNodeImpl, getReferenceType } from "../base_node_impl";

export function constructNamespaceDependency(namespace: INamespace): INamespace[] {
    const addressSpace = namespace.addressSpace;
    const namespace_ = namespace as NamespacePrivate;
    // navigate all namespace recursively to
    // find dependency
    const dependency = [];
    const depMap = new Set();

    // default namespace is always first
    dependency.push(addressSpace.getDefaultNamespace());
    depMap.add(dependency[0].index);

    if (namespace !== addressSpace.getDefaultNamespace()) {
        dependency.push(namespace);
        depMap.add(namespace.index);
    }

    for (const node of namespace_.nodeIterator()) {
        // visit all reference
        const references = (<BaseNodeImpl>node).ownReferences();
        for (const reference of references) {
            // check referenceId
            const namespaceIndex = getReferenceType(reference)!.nodeId.namespace;
            if (!depMap.has(namespaceIndex)) {
                depMap.add(namespaceIndex);
                dependency.push(addressSpace.getNamespace(namespaceIndex));
            }
            const namespaceIndex2 = reference.nodeId.namespace;
            if (!depMap.has(namespaceIndex2)) {
                depMap.add(namespaceIndex2);
                dependency.push(addressSpace.getNamespace(namespaceIndex2));
            }
        }
    }
    return dependency;
}
