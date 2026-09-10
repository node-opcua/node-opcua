/**
 * Tests for namespaceOf.
 *
 * The point of the helper is what it lets an application write, so the test is written the way
 * an application would write it: only published names, and no type assertion anywhere. If
 * reaching a namespace method from a node ever needs a cast again, this stops compiling.
 */
import "should";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import { AddressSpace, namespaceOf, type UAObject } from "../dist/api/index.js";
import { generateAddressSpace } from "../distNodeJS/index.js";

describe("namespaceOf", () => {
    let addressSpace: AddressSpace;
    let node: UAObject;

    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, nodesets.standard);
        const namespace = addressSpace.registerNamespace("urn:test");
        node = namespace.addObject({ browseName: "Some", organizedBy: addressSpace.rootFolder.objects });
    });
    after(() => addressSpace.dispose());

    it("NSOF-1 returns the very namespace the node belongs to", () => {
        should(namespaceOf(node)).eql(node.namespace);
    });

    it("NSOF-2 reaches a method that BaseNode.namespace does not declare", () => {
        // instantiateAlarmCondition lives on Namespace, not on the INamespace a node exposes;
        // before this helper an application had to assert the type to get here
        should(typeof namespaceOf(node).instantiateAlarmCondition).eql("function");
        should(typeof namespaceOf(node).instantiateOffNormalAlarm).eql("function");
    });

    it("NSOF-3 works for a node from the standard nodeset too, not just one just created", () => {
        const server = addressSpace.rootFolder.objects.server;
        should(namespaceOf(server).index).eql(0);
    });
});
