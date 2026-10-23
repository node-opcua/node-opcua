import { makePermissionFlag } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";
import { AddressSpace, makeRoles, PseudoSession, type UAVariable, WellKnownRoles } from "../dist/api/index.js";
import { generateAddressSpace } from "../distNodeJS/index.js";
import { makeMockSessionContext } from "../testHelpers.js";

describe("a read that joins a read already in flight is checked on its own", () => {
    let addressSpace: AddressSpace;
    let variable: UAVariable;
    let release: () => void = () => undefined;
    let refreshCount = 0;

    const server = {
        userManager: {
            getUserRoles(username: string) {
                return username === "reader"
                    ? makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.ConfigureAdmin])
                    : makeRoles(WellKnownRoles.AuthenticatedUser);
            }
        }
    };
    const contextReader = makeMockSessionContext({ userName: "reader", server });
    const contextOutsider = makeMockSessionContext({ userName: "outsider", server });

    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("http://MyNamespace");
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        const namespace = addressSpace.getOwnNamespace();
        variable = namespace.addVariable({
            browseName: "Secret",
            dataType: "Double",
            organizedBy: addressSpace.rootFolder.objects,
            rolePermissions: [
                { roleId: WellKnownRoles.ConfigureAdmin, permissions: makePermissionFlag("Browse | Read") as number }
            ],
            value: {
                // the refresh stays in flight until the test releases it
                refreshFunc: (callback: (err: Error | null, dataValue?: DataValue) => void) => {
                    refreshCount++;
                    release = () => callback(null, new DataValue({ value: new Variant({ dataType: DataType.Double, value: 42 }) }));
                }
            }
        });
    });
    after(() => {
        addressSpace.dispose();
    });
    beforeEach(() => {
        refreshCount = 0;
    });

    it("CR-1 a reader without the Read permission does not receive the value another session is reading", async () => {
        const allowed = variable.readValueAsync(contextReader);
        const outsider = variable.readValueAsync(contextOutsider);
        should(refreshCount).eql(1); // the second read joined the first one
        release();
        should((await allowed).statusCode).eql(StatusCodes.Good);
        const denied = await outsider;
        should(denied.statusCode).eql(StatusCodes.BadUserAccessDenied);
        should(denied.value.value).not.eql(42);
    });

    it("CR-2 the same holds through PseudoSession.read", async () => {
        const reader = new PseudoSession(addressSpace, contextReader);
        const outsider = new PseudoSession(addressSpace, contextOutsider);
        const nodeId = variable.nodeId;
        const first = reader.read({ nodeId, attributeId: 13 });
        const second = outsider.read({ nodeId, attributeId: 13 });
        await new Promise((resolve) => setImmediate(resolve));
        release();
        should((await first).statusCode).eql(StatusCodes.Good);
        should((await second).statusCode).eql(StatusCodes.BadUserAccessDenied);
    });

    it("CR-3 a joining reader that is allowed still shares the refresh", async () => {
        const first = variable.readValueAsync(contextReader);
        const second = variable.readValueAsync(contextReader);
        should(refreshCount).eql(1);
        release();
        should((await first).value.value).eql(42);
        should((await second).value.value).eql(42);
    });

    it("CR-4 a denied reader never delays or spoils the allowed one that comes after", async () => {
        const denied = variable.readValueAsync(contextOutsider);
        const allowed = variable.readValueAsync(contextReader);
        should((await denied).statusCode).eql(StatusCodes.BadUserAccessDenied);
        release();
        should((await allowed).value.value).eql(42);
    });
});
