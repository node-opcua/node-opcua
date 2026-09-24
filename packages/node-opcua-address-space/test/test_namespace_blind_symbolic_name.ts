import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import { AddressSpace, getSymbols, type Namespace, setSymbols, type UAObject } from "../dist/api/index.js";
import { generateAddressSpace } from "../distNodeJS/index.js";

/**
 * Siblings whose browse names differ by the namespace only.
 *
 * A symbolic name spells the browse name without its namespace, so `1:Speed` next to `0:Speed`
 * (a model re-declaring, beside the core child, a member of its own) are both `Machine_Speed`.
 * The second got a fresh id but no name, so no preset table could give it a stable one. It now
 * takes the next free `Machine_Speed__2`.
 */
describe("siblings that differ by the browse name's namespace only (NodeIdManager)", () => {
    let addressSpace: AddressSpace;
    let ns: Namespace;
    let machine: UAObject;

    beforeEach(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("Private");
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        ns = addressSpace.getOwnNamespace();
        setSymbols(ns, []);
        machine = ns.addObject({ browseName: "Machine", organizedBy: addressSpace.rootFolder.objects });
    });
    afterEach(() => {
        addressSpace.dispose();
    });

    const nameOf = (value: unknown) => getSymbols(ns).find(([, id]) => id === value)?.[0];

    it("NBSN-1 the second sibling is named, after the first", () => {
        const own = ns.addVariable({ browseName: "Speed", componentOf: machine, dataType: "Double" });
        const core = ns.addVariable({ browseName: { name: "Speed", namespaceIndex: 0 }, componentOf: machine, dataType: "Double" });
        should(nameOf(own.nodeId.value)).eql("Machine_Speed");
        should(nameOf(core.nodeId.value)).eql("Machine_Speed__2");
    });

    it("NBSN-2 so a preset table gives it its id", () => {
        setSymbols(ns, [
            ["Machine_Speed", 6001, "Variable"],
            ["Machine_Speed__2", 6002, "Variable"]
        ]);
        const own = ns.addVariable({ browseName: "Speed", componentOf: machine, dataType: "Double" });
        const core = ns.addVariable({ browseName: { name: "Speed", namespaceIndex: 0 }, componentOf: machine, dataType: "Double" });
        should([own.nodeId.value, core.nodeId.value]).eql([6001, 6002]);
    });
});
