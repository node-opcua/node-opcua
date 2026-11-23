/**
 * A BrowseName is a QualifiedName: "1:SerialNumber" and "2:SerialNumber" are two members.
 *
 * DI DeviceType has a Mandatory DI:SerialNumber. A vendor subtype that declares a
 * SerialNumber of its own namespace (directly, or through an interface it implements)
 * adds a member: it does not override DeviceType's. instantiate() must create both.
 * It kept only the subtype's, matching the base declaration by its name alone.
 */

import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import { AddressSpace, type BaseNode, type Namespace, type UAObjectType } from "../dist/api/index.js";
import { generateAddressSpace } from "../distNodeJS/index.js";

function serialNumbersOf(node: BaseNode): string[] {
    return node
        .findReferencesExAsObject("Aggregates")
        .map((child) => child.browseName.toString())
        .filter((name) => name.endsWith(":SerialNumber"))
        .sort();
}

describe("instantiate() keeps base members whose name a subtype reuses in another namespace", function (this: Mocha.Suite) {
    this.timeout(60 * 1000);

    let addressSpace: AddressSpace;
    let baseNamespace: Namespace;
    let vendorNamespace: Namespace;
    let baseType: UAObjectType;

    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        baseNamespace = addressSpace.registerNamespace("urn:base");
        vendorNamespace = addressSpace.registerNamespace("urn:vendor");

        baseType = baseNamespace.addObjectType({ browseName: "DeviceLikeType" });
        baseNamespace.addVariable({
            browseName: "SerialNumber",
            propertyOf: baseType,
            dataType: "String",
            modellingRule: "Mandatory"
        });
    });
    after(() => {
        addressSpace.dispose();
    });

    const base = () => `${baseNamespace.index}:SerialNumber`;
    const vendor = () => `${vendorNamespace.index}:SerialNumber`;

    it("a subtype's own SerialNumber does not hide the base type's", () => {
        const subtype = vendorNamespace.addObjectType({ browseName: "MachineType", subtypeOf: baseType });
        vendorNamespace.addVariable({
            browseName: "SerialNumber",
            propertyOf: subtype,
            dataType: "Int16",
            modellingRule: "Mandatory"
        });

        const instance = subtype.instantiate({ browseName: "Machine", organizedBy: addressSpace.rootFolder.objects });
        should(serialNumbersOf(instance)).eql([base(), vendor()].sort());
    });

    it("a SerialNumber an implemented interface brings does not hide the base type's", () => {
        const baseInterfaceType = addressSpace.findObjectType("BaseInterfaceType")!;
        const iface = vendorNamespace.addObjectType({ browseName: "IMachineIdentificationType", subtypeOf: baseInterfaceType });
        vendorNamespace.addVariable({
            browseName: "SerialNumber",
            propertyOf: iface,
            dataType: "String",
            modellingRule: "Mandatory"
        });

        const subtype = vendorNamespace.addObjectType({ browseName: "IdentifiedMachineType", subtypeOf: baseType });
        // OPC 10000-3: the type implementing an interface also declares its members
        vendorNamespace.addVariable({
            browseName: "SerialNumber",
            propertyOf: subtype,
            dataType: "String",
            modellingRule: "Mandatory"
        });
        subtype.addReference({ referenceType: "HasInterface", nodeId: iface });

        const instance = subtype.instantiate({ browseName: "IdentifiedMachine", organizedBy: addressSpace.rootFolder.objects });
        should(serialNumbersOf(instance)).eql([base(), vendor()].sort());
    });

    it("a subtype that overrides the base SerialNumber (same namespace) still gets one", () => {
        const subtype = vendorNamespace.addObjectType({ browseName: "OverridingType", subtypeOf: baseType });
        baseNamespace.addVariable({
            browseName: "SerialNumber",
            propertyOf: subtype,
            dataType: "String",
            modellingRule: "Mandatory"
        });

        const instance = subtype.instantiate({ browseName: "Overriding", organizedBy: addressSpace.rootFolder.objects });
        should(serialNumbersOf(instance)).eql([base()]);
    });
});
