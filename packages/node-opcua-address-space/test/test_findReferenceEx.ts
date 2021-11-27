// tslint:disable:no-console
import * as chalk from "chalk";
import { nodesets } from "node-opcua-nodesets";
import * as should from "should";

import { generateAddressSpace } from "../nodeJS";

import { AddressSpace, BaseNode, UAReference } from "..";

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing findReferencesEx", () => {
    const nodesetFilename = nodesets.standard;

    const my_nodesets = [nodesets.standard, nodesets.di];

    let addressSpace: AddressSpace;

    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("Private");
        await generateAddressSpace(addressSpace, my_nodesets);
    });
    after(async () => {
        addressSpace.dispose();
    });
    it("should findReferencesEx", () => {
        const nsDI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");
        const topologyElementType = addressSpace.findObjectType("TopologyElementType", nsDI)!;

        const deviceType = addressSpace.findObjectType("DeviceType", nsDI)!;

        function isMandatory(reference: UAReference) {
            // xx console.log(reference.node.modellingRule ,
            // reference._referenceType.browseName.toString(),reference.node.browseName.toString());
            if (!reference.node!.modellingRule) {
                return false;
            }
            (typeof reference.node!.modellingRule === "string").should.eql(true);
            return reference.node!.modellingRule === "Mandatory" || reference.node!.modellingRule === "Optional";
        }

        const r1_child = deviceType
            .findReferencesEx("Aggregates")
            .filter((x: UAReference) => isMandatory(x))
            .map((x: UAReference) => x.node!.browseName.name!.toString());

        const r1_components = deviceType
            .findReferencesEx("HasComponent")
            .filter((x: UAReference) => isMandatory(x))
            .map((x: UAReference) => x.node!.browseName.name!.toString());

        const r1_properties = deviceType
            .findReferencesEx("HasProperty")
            .filter((x: UAReference) => isMandatory(x))
            .map((x: UAReference) => x.node!.browseName.name!.toString());

        console.log("Aggregates from ", deviceType.browseName.toString(), ": ", chalk.yellow.bold(r1_child.sort().join(" ")));

        r1_child.length.should.be.greaterThan(1);

        ([] as string[]).concat(r1_components, r1_properties).sort().should.eql(r1_child.sort());

        const r2_child = topologyElementType
            .findReferencesEx("Aggregates")!
            .filter((x: UAReference) => isMandatory(x))
            .map((x: UAReference) => x.node!.browseName.name!.toString());

        r2_child.length.should.be.greaterThan(1);

        console.log(
            "Aggregates from ",
            topologyElementType.browseName.toString(),
            ": ",
            chalk.yellow.bold(r2_child.sort().join(" "))
        );

        const optionals = ([] as string[]).concat(r1_child.sort(), r2_child.sort());
        console.log("optionals ", topologyElementType.browseName.toString(), ": ", chalk.yellow.bold(optionals.join(" ")));

        const valveType = addressSpace.getOwnNamespace().addObjectType({
            browseName: "ValveType",
            subtypeOf: deviceType
        });

        const someDevice = valveType.instantiate({
            browseName: "SomeDevice",
            // let make sure that all properties are requires
            optionals
        });
        for (const opt of optionals) {
            const child = someDevice.getChildByName(opt);
            const childName = child ? child.browseName.toString() : " ???";
            // xx console.log("opt ",opt,childName);
        }
        const instance_children = someDevice
            .findReferencesEx("Aggregates")
            .map((x: UAReference) => x.node!.browseName.name!.toString());

        // xx console.log(instance_children);

        ([] as string[]).concat(r1_child, r2_child).sort().should.eql(instance_children.sort());
    });
});
