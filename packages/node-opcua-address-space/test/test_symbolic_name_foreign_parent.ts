import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import { AddressSpace, getSymbols, type Namespace, setSymbols, type UAObject } from "../dist/api/index.js";
import { generateAddressSpace } from "../distNodeJS/index.js";

/**
 * Members of a node that hangs from another namespace.
 *
 * Such a node is registered with the foreign chain in front of its name (the legacy type
 * dictionary under the core `OPC Binary` folder is `OPCBinary_TypeDictionary`), but its members
 * are named after the node alone (`TypeDictionary_NamespaceUri`), as the ModelCompiler spells them
 * in a companion spec's NodeIds.csv. 2.187.0 named them after the registered name
 * (`OPCBinary_TypeDictionary_NamespaceUri`): a preset table no longer gave them their ids.
 */
describe("members of a node hanging from another namespace keep the ModelCompiler's names (NodeIdManager)", () => {
    let addressSpace: AddressSpace;
    let ns: Namespace;

    beforeEach(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("Private");
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        ns = addressSpace.getOwnNamespace();
        setSymbols(ns, []);
    });
    afterEach(() => {
        addressSpace.dispose();
    });

    const idOf = (name: string) => getSymbols(ns).find(([n]) => n === name)?.[1];
    const build = () => {
        const namespaces = addressSpace.rootFolder.objects.server.namespaces as UAObject;
        const meta = ns.addObject({ browseName: "Meta", componentOf: namespaces });
        const uri = ns.addVariable({ browseName: "NamespaceUri", propertyOf: meta, dataType: "String" });
        const sub = ns.addObject({ browseName: "Sub", componentOf: meta });
        const leaf = ns.addVariable({ browseName: "Leaf", componentOf: sub, dataType: "Int32" });
        return { meta, uri, sub, leaf };
    };

    it("SNFP-1 the members are named after the node, without the foreign chain", () => {
        const { meta, uri, sub, leaf } = build();
        should(idOf("Server_Namespaces_Meta")).eql(meta.nodeId.value);
        should(idOf("Meta_NamespaceUri")).eql(uri.nodeId.value);
        should(idOf("Meta_Sub")).eql(sub.nodeId.value);
        should(idOf("Meta_Sub_Leaf")).eql(leaf.nodeId.value);
        should(getSymbols(ns).some(([n]) => n.startsWith("Server_Namespaces_Meta_"))).eql(false);
    });

    it("SNFP-2 a preset table gives the members their ids", () => {
        setSymbols(ns, [
            ["Server_Namespaces_Meta", 5001, "Object"],
            ["Meta_NamespaceUri", 6001, "Variable"],
            ["Meta_Sub", 5002, "Object"],
            ["Meta_Sub_Leaf", 6002, "Variable"]
        ]);
        const { meta, uri, sub, leaf } = build();
        should([meta, uri, sub, leaf].map((n) => n.nodeId.value)).eql([5001, 6001, 5002, 6002]);
    });
});
