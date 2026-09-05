import { AddressSpace, type UAVariable } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { nodesets } from "node-opcua-nodesets";
import should from "should";

import { build_address_space_for_conformance_testing } from "../dist/index.js";

// AutoID's RfidSighting: Antenna/Strength/CurrentPowerLevel (Int32) + Timestamp.
// A companion nodeset, which is the point - namespace zero has no concrete
// structure the ExtensionObject variables could hold.
const randomFields = () => ({
    antenna: 1 + Math.floor(Math.random() * 4),
    strength: -80 + Math.floor(Math.random() * 60),
    currentPowerLevel: 10 + Math.floor(Math.random() * 20),
    timestamp: new Date()
});

describe("the caller-supplied ExtensionObject", function () {
    this.timeout(60_000);

    let addressSpace: AddressSpace;
    let ns: number;
    const value = (id: string) => {
        const node = addressSpace.findNode(`ns=${ns};${id}`) as UAVariable;
        should.exist(node, id);
        const variant = node.readValue().value;
        return Array.isArray(variant.value) ? variant.value[0] : variant.value;
    };

    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard, nodesets.di, nodesets.autoId]);
        addressSpace.registerNamespace("urn:test");
        await build_address_space_for_conformance_testing(addressSpace, {
            extensionObject: { dataType: "RfidSighting", initialFields: randomFields(), randomFields }
        });
        ns = addressSpace.getNamespaceIndex("urn://node-opcua-simulator");
    });
    after(async () => {
        await addressSpace.shutdown();
        addressSpace.dispose();
    });

    it("fills the Static, Array and Multi-Dimensional ExtensionObject variables", () => {
        for (const id of [
            "s=Static_Scalar_Structure",
            "s=Static_Array_Structure",
            "s=Static_MultiDimensional_Array_Structure",
            "s=Scalar_Simulation_Structure"
        ]) {
            should(value(id)?.constructor.name).eql("RfidSighting", id);
        }
    });

    it("moves the fields of the Dynamic one", async () => {
        const before = JSON.stringify(value("s=Scalar_Simulation_Structure"));
        // the simulation timer ticks every 2s
        await new Promise((resolve) => setTimeout(resolve, 2500));
        JSON.stringify(value("s=Scalar_Simulation_Structure")).should.not.eql(before);
    });

    it("refuses a DataType that is not loaded, rather than silently falling back", async () => {
        const other = AddressSpace.create();
        try {
            await generateAddressSpace(other, [nodesets.standard]);
            await build_address_space_for_conformance_testing(other, {
                extensionObject: { dataType: "RfidSighting" }
            }).should.be.rejectedWith(/is not in the address space/);
        } finally {
            await other.shutdown();
            other.dispose();
        }
    });
});
