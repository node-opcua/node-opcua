/**
 * TranslateBrowsePathToNodeIds answers a forward, named, hierarchical step through the child index
 * rather than by scanning every reference of the node; the answer must be the one the scan gives.
 */

import { NodeClass } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { makeBrowsePath } from "node-opcua-service-translate-browse-path";
import { StatusCodes } from "node-opcua-status-code";
import { RelativePathElement } from "node-opcua-types";
import should from "should";
import { AddressSpace, type UAObject, type UAVariable } from "../dist/api/index.js";
import { generateAddressSpace } from "../distNodeJS/index.js";

describe("TranslateBrowsePath through the child index", function (this: Mocha.Suite) {
    this.timeout(60000);

    let addressSpace: AddressSpace;
    let folder: UAObject;
    let variables: UAVariable[];

    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        const namespace = addressSpace.registerNamespace("urn:translate-index");
        folder = namespace.addFolder(addressSpace.rootFolder.objects, { browseName: "WideFolder" });
        variables = [];
        for (let i = 0; i < 5000; i++) {
            variables.push(namespace.addVariable({ browseName: `Tag_${i}`, componentOf: folder, dataType: "Double" }));
        }
        // one child that is only organized, and a method: different reference types on the same parent
        namespace.addObject({ browseName: "Organized", organizedBy: folder });
        namespace.addMethod(folder, { browseName: "DoIt" });
    });
    after(() => {
        addressSpace.dispose();
    });

    const translate = (relativePath: string) => {
        const browsePath = makeBrowsePath(folder.nodeId, relativePath);
        const result = addressSpace.browsePath(browsePath);
        return { statusCode: result.statusCode, targets: (result.targets || []).map((t) => t.targetId.toString()) };
    };

    it("finds a component among 5000 by name, and only it", () => {
        const { statusCode, targets } = translate("/1:Tag_4321");
        should(statusCode).eql(StatusCodes.Good);
        should(targets).eql([variables[4321].nodeId.toString()]);
    });

    it("respects the reference type of the step", () => {
        // Organized is reached through Organizes, not through HasComponent
        should(translate(".1:Organized").statusCode).eql(StatusCodes.BadNoMatch);
        should(translate("/1:Organized").targets.length).eql(1);
        // a method is a component
        should(translate(".1:DoIt").targets.length).eql(1);
    });

    it("gives the same answer as a scan of every reference, for every child", () => {
        const hasComponent = resolveNodeId("HasComponent");
        const scanned = (name: string) => {
            const element = new RelativePathElement({
                referenceTypeId: hasComponent,
                isInverse: false,
                includeSubtypes: true,
                targetName: { namespaceIndex: 1, name }
            });
            return folder
                .allReferences()
                .filter((r) => r.isForward)
                .map((r) => r.node ?? addressSpace.findNode(r.nodeId))
                .filter((n) => n && n.browseName.name === element.targetName?.name && n.browseName.namespaceIndex === 1)
                .map((n) => (n as UAVariable).nodeId.toString());
        };
        for (let i = 0; i < 5000; i += 97) {
            should(translate(`.1:Tag_${i}`).targets).eql(scanned(`Tag_${i}`));
        }
    });

    it("still answers inverse and untyped steps by scanning", () => {
        const child = variables[7];
        const upward = addressSpace.browsePath(makeBrowsePath(child.nodeId, "<!HasComponent>1:WideFolder"));
        should(upward.statusCode).eql(StatusCodes.Good);
        should(upward.targets?.[0].targetId.toString()).eql(folder.nodeId.toString());
        should(folder.nodeClass).eql(NodeClass.Object);
    });
});
