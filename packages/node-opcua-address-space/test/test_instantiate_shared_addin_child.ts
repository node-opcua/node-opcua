/**
 * OPC 40700 (Surface Technology - General Types) declares, on STSysType, the objects
 * MachineryItemState and MachineryOperationMode ONCE, reachable through two hierarchical
 * parents: HasAddIn from MachineryBuildingBlocks and HasComponent from Monitoring.Status.
 * OPC 40702 (OCT-MSS) subtypes STSysType and overrides both MachineryBuildingBlocks and
 * Monitoring.
 *
 * instantiate() must produce ONE instance node reachable from both parents, and must not
 * instantiate an Optional child that was not requested (node-opcua
 * issue 1143).
 */

import { BrowseDirection } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import { AddressSpace, type BaseNode, type Namespace, type UAObject, type UAObjectType } from "../dist/api/index.js";
import { generateAddressSpace } from "../distNodeJS/index.js";
import { chainOf } from "./nodeset_chain.js";

const stGeneralTypesUri = "http://opcfoundation.org/UA/SurfaceTechnology/GeneralTypes/";
const octMssUri = "http://opcfoundation.org/UA/SurfaceTechnology/OCT-MSS/";
const machineryUri = "http://opcfoundation.org/UA/Machinery/";

function byPath(root: BaseNode, path: string): BaseNode | null {
    let current: BaseNode | null = root;
    for (const segment of path.split(".")) {
        const next: BaseNode | undefined = current!
            .findReferencesExAsObject("HierarchicalReferences", BrowseDirection.Forward)
            .find((n) => n.browseName.name === segment);
        if (!next) return null;
        current = next;
    }
    return current;
}

function parentsOf(node: BaseNode): string[] {
    return node
        .findReferencesEx("HasChild", BrowseDirection.Inverse)
        .map(
            (r) =>
                `${node.addressSpace.findReferenceType(r.referenceType)?.browseName.name} <- ${node.addressSpace.findNode(r.nodeId)?.browseName.toString()}`
        )
        .sort();
}

function expectShared(root: BaseNode, pathA: string, pathB: string) {
    const a = byPath(root, pathA);
    const b = byPath(root, pathB);
    should.exist(a, `${pathA} must exist`);
    should.exist(b, `${pathB} must exist`);
    should(a!.nodeId.toString()).eql(
        b!.nodeId.toString(),
        `${pathA} and ${pathB} must be the same node, got parents ${parentsOf(a!)} vs ${parentsOf(b!)}`
    );
    return a!;
}

describe("instantiate() of a type whose child is shared by HasAddIn and HasComponent (OPC 40700)", function (this: Mocha.Suite) {
    this.timeout(60 * 1000);
    let addressSpace: AddressSpace;
    let namespace: Namespace;
    let stSysType: UAObjectType;
    let lineType: UAObjectType;
    let machinesFolder: UAObject;
    let machineryComponentsType: UAObjectType;

    before(async () => {
        addressSpace = AddressSpace.create();
        const files = chainOf("surfaceTechnologyOctMss").map((n) => nodesets[n as keyof typeof nodesets]);
        await generateAddressSpace(addressSpace, files);
        namespace = addressSpace.registerNamespace("urn:test:shared-addin-child");

        const stIdx = addressSpace.getNamespaceIndex(stGeneralTypesUri);
        const mssIdx = addressSpace.getNamespaceIndex(octMssUri);
        const machineryIdx = addressSpace.getNamespaceIndex(machineryUri);
        stSysType = addressSpace.findObjectType("STSysType", stIdx)!;
        lineType = addressSpace.findObjectType("STSysMaterialTransportLineType", mssIdx)!;
        machinesFolder = addressSpace.rootFolder.objects.getFolderElementByName("Machines", machineryIdx)! as UAObject;
        machineryComponentsType = addressSpace.findObjectType("MachineComponentsType", machineryIdx)!;
        should.exist(stSysType);
        should.exist(lineType);
        should.exist(machinesFolder);
        should.exist(machineryComponentsType);
    });
    after(() => {
        addressSpace.dispose();
    });

    it("the type itself declares the shared children once", () => {
        const viaBlocks = byPath(stSysType, "MachineryBuildingBlocks.MachineryOperationMode")!;
        const viaStatus = byPath(stSysType, "Monitoring.Status.MachineryOperationMode")!;
        viaBlocks.nodeId.toString().should.eql(viaStatus.nodeId.toString());
    });

    it("a direct instantiate with the optionals requested yields one node reachable from both parents", () => {
        const line = lineType.instantiate({
            browseName: "LineA",
            namespace,
            organizedBy: machinesFolder,
            optionals: [
                "Monitoring",
                "Monitoring.Status",
                "Monitoring.Status.MachineryItemState",
                "Monitoring.Status.MachineryOperationMode"
            ]
        });
        for (const name of ["MachineryItemState", "MachineryOperationMode"]) {
            const node = expectShared(line, `MachineryBuildingBlocks.${name}`, `Monitoring.Status.${name}`);
            parentsOf(node).should.eql(["HasAddIn <- 3:MachineryBuildingBlocks", "HasComponent <- 3:Status"]);
        }
        const monitoring = expectShared(line, "MachineryBuildingBlocks.Monitoring", "Monitoring");
        parentsOf(monitoring).should.eql([
            "HasAddIn <- 3:MachineryBuildingBlocks",
            `HasComponent <- ${line.browseName.toString()}`
        ]);
    });

    it("an Optional child that is not requested is not instantiated through either parent", () => {
        const line = lineType.instantiate({ browseName: "LineC", namespace, organizedBy: machinesFolder, optionals: [] });
        should.not.exist(byPath(line, "MachineryBuildingBlocks.MachineryItemState"));
        should.not.exist(byPath(line, "MachineryBuildingBlocks.MachineryOperationMode"));
        should.not.exist(byPath(line, "Monitoring"));
        should.not.exist(byPath(line, "MachineryBuildingBlocks.Monitoring"));
    });

    it("an instance child carried by a type gets the same single shared node when the type is instantiated", () => {
        const systemType = namespace.addObjectType({ browseName: "MySystemType", subtypeOf: stSysType });
        const components = machineryComponentsType.instantiate({
            browseName: "Components",
            namespace,
            addInOf: systemType,
            modellingRule: "Mandatory"
        });
        lineType.instantiate({ browseName: "LineB", namespace, componentOf: components, modellingRule: "Optional", optionals: [] });
        const system = systemType.instantiate({
            browseName: "System1",
            namespace,
            organizedBy: machinesFolder,
            optionals: [
                "Components.LineB",
                "Components.LineB.Monitoring",
                "Components.LineB.Monitoring.Status",
                "Components.LineB.Monitoring.Status.MachineryItemState",
                "Components.LineB.Monitoring.Status.MachineryOperationMode"
            ]
        });
        for (const name of ["MachineryItemState", "MachineryOperationMode"]) {
            expectShared(system, `Components.LineB.MachineryBuildingBlocks.${name}`, `Components.LineB.Monitoring.Status.${name}`);
        }
        expectShared(system, "Components.LineB.MachineryBuildingBlocks.Monitoring", "Components.LineB.Monitoring");
    });
});
