/**
 * Giving an application's own types a richer implementation class at nodeset load time.
 *
 * The test is written the way an application would have to write it: only published names, and
 * the promoter is registered for a NodeId that only exists once the nodeset declares it - the
 * numeric-only signature could never express that.
 *
 * There is no unregister: the registry is module level and not published, so a promoter
 * registered here stays registered for the rest of the mocha process. That is why the fixture
 * uses string NodeIds ("ns=1;s=Promoter...") that no other test's address space can produce -
 * a leftover entry cannot match anything but this fixture.
 */
import { nodesets } from "node-opcua-nodesets";
import should from "should";

import { AddressSpace, registerNodePromoter, type UAObject } from "../dist/api/index.js";
import { generateAddressSpace } from "../distNodeJS/index.js";
import { getAddressSpaceFixture } from "../test_helpers/get_address_space_fixture.js";

const fixture = getAddressSpaceFixture("fixture_promoter_types.xml");

/** browseNames the test promoters were handed, in the order the loader promoted them */
const promoted: string[] = [];

async function loadFixture(): Promise<AddressSpace> {
    const addressSpace = AddressSpace.create();
    await generateAddressSpace(addressSpace, [nodesets.standard, fixture]);
    return addressSpace;
}

describe("registerNodePromoter", function (this: Mocha.Suite) {
    this.timeout(Math.max(this.timeout(), 60000));

    let addressSpace: AddressSpace;

    before(async () => {
        // The NodeIds are discovered from a first load rather than hard-coded, because the
        // namespace index of an application nodeset is a property of the load, not of the file.
        const probe = await loadFixture();
        const namespaceIndex = probe.getNamespaceIndex("urn:promoter-test/");
        const findTypeNodeId = (browseName: string) => {
            const type = probe.findObjectType(browseName, namespaceIndex);
            if (!type) {
                throw new Error(`cannot find ${browseName} in the fixture`);
            }
            return type.nodeId;
        };
        const baseTypeNodeId = findTypeNodeId("PromoterBaseType");
        const instanceOnlyTypeNodeId = findTypeNodeId("PromoterInstanceOnlyType");
        probe.dispose();

        const record = (node: UAObject) => {
            promoted.push(node.browseName.name?.toString() ?? "");
            return node;
        };
        registerNodePromoter(baseTypeNodeId, record);
        registerNodePromoter(instanceOnlyTypeNodeId, record, true);

        promoted.length = 0;
        addressSpace = await loadFixture();
    });

    after(() => addressSpace.dispose());

    it("RNP-1 promotes an instance of a type registered by NodeId in an application namespace", () => {
        should(promoted).containEql("ExactInstance");
    });

    it("RNP-2 keeps the exact-match behaviour the built-in promoters rely on", () => {
        // AlarmConditionType.ActiveState is a TwoStateVariableType exactly, and the built-in
        // promoter is the only thing that gives it setValue - reading the member through
        // Reflect keeps the assertion about what the loader did, with no type assertion.
        const alarmConditionType = addressSpace.findObjectType("AlarmConditionType");
        should.exist(alarmConditionType);
        const activeState = alarmConditionType?.getComponentByName("ActiveState");
        should.exist(activeState);
        should(typeof Reflect.get(Object(activeState), "setValue")).eql("function");
    });

    it("RNP-3 onInstanceOnly still suppresses promotion under a type definition", () => {
        should(promoted).containEql("InstanceOnlyInstance");
        should(promoted).not.containEql("HolderInstanceOnlyChild");
    });
});
