import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import { AddressSpace, getSymbols, type Namespace, setSymbols, type UAObjectType } from "../dist/api/index.js";
import { generateAddressSpace } from "../distNodeJS/index.js";

/**
 * Parentless nodes that share a browse name.
 *
 * OPC 40502 CNC ships three `X` axes that nothing, or only a folder's Organizes, references. A
 * parentless node is named after its browse name alone, so all three were `X`: the second was
 * handed the id the first holds and its creation threw "already registered", and getSymbols()
 * could never list the others. The n-th such node is now `X__n`, and its members are named after
 * that name (`X__2_ActStatus`), so a preset table can give each its own id. The same node
 * declared twice in one folder is still reported.
 */
describe("same-named parentless nodes get distinct symbolic names (NodeIdManager)", () => {
    let addressSpace: AddressSpace;
    let ns: Namespace;
    let axisType: UAObjectType;

    beforeEach(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("Private");
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        ns = addressSpace.getOwnNamespace();
        setSymbols(ns, []);
        axisType = ns.addObjectType({ browseName: "AxisType" });
        ns.addVariable({ browseName: "ActStatus", componentOf: axisType, dataType: "Int32", modellingRule: "Mandatory" });
    });
    afterEach(() => {
        addressSpace.dispose();
    });

    const idOf = (name: string) => getSymbols(ns).find(([n]) => n === name)?.[1];
    const threeAxes = () => {
        const channel = ns.addFolder(addressSpace.rootFolder.objects, { browseName: "Channel_1" });
        return [
            axisType.instantiate({ browseName: "X" }),
            axisType.instantiate({ browseName: "X", organizedBy: channel }),
            axisType.instantiate({ browseName: "X" })
        ];
    };

    it("SNPN-1 each gets its own name, and its members are named after it", () => {
        const axes = threeAxes();
        should(new Set(axes.map((x) => x.nodeId.toString())).size).eql(3);
        should(axes.map((x) => idOf(x === axes[0] ? "X" : x === axes[1] ? "X__2" : "X__3"))).eql(axes.map((x) => x.nodeId.value));
        const status = axes.map((x) => x.getComponentByName("ActStatus")?.nodeId.value);
        should([idOf("X_ActStatus"), idOf("X__2_ActStatus"), idOf("X__3_ActStatus")]).eql(status);
    });

    it("SNPN-2 a preset table gives each its own id", () => {
        setSymbols(ns, [
            ["X", 5011, "Object"],
            ["X_ActStatus", 6232, "Variable"],
            ["X__2", 5020, "Object"],
            ["X__2_ActStatus", 6408, "Variable"],
            ["X__3", 5032, "Object"],
            ["X__3_ActStatus", 7120, "Variable"]
        ]);
        const axes = threeAxes();
        should(axes.map((x) => x.nodeId.value)).eql([5011, 5020, 5032]);
        should(axes.map((x) => x.getComponentByName("ActStatus")?.nodeId.value)).eql([6232, 6408, 7120]);
    });

    it("SNPN-3 the same node declared twice in one folder is still reported", () => {
        const channel = ns.addFolder(addressSpace.rootFolder.objects, { browseName: "Channel_1" });
        axisType.instantiate({ browseName: "X", organizedBy: channel });
        should(() => axisType.instantiate({ browseName: "X", organizedBy: channel })).throw(/already registered/);
    });

    it("SNPN-4 nodes created with their ids (a NodeSet being loaded) are listed under the same names", () => {
        for (const id of [5011, 5020, 5032]) {
            ns.addObject({ browseName: "X", nodeId: `i=${id}` });
        }
        should([idOf("X"), idOf("X__2"), idOf("X__3")]).eql([5011, 5020, 5032]);
    });
});
