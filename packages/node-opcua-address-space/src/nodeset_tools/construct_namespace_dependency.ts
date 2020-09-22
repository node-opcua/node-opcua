import { NamespacePrivate } from "../namespace_private";
import { Namespace } from "../../source/address_space_ts";

export function constructNamespaceDependency(namespace: NamespacePrivate): Namespace[] {
    const addressSpace = namespace.addressSpace;

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

    for (const node of Object.values(namespace._nodeid_index)) {
        // visit all reference
        const references = node.ownReferences();
        for (const reference of references) {
            // check referenceId
            const namespaceIndex = reference._referenceType!.nodeId.namespace;
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
