import { ObjectIds } from "node-opcua-constants";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { PermissionType } from "node-opcua-types";
import should from "should";
import {
    AddressSpace,
    ensureObjectIsSecure,
    type IServerBase,
    makeRoles,
    type UAObject,
    type UAVariable,
    WellKnownRoles
} from "../dist/api/index.js";
import { generateAddressSpace } from "../nodeJS.js";
import { makeMockSessionContext } from "../testHelpers.js";

const serverFor = (roles: ReturnType<typeof makeRoles>): IServerBase => ({ userManager: { getUserRoles: () => roles } });

describe("ensureObjectIsSecure keeps the structure browsable", () => {
    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("http://sterfive.com/UA/SecureBrowse/");
        await generateAddressSpace(addressSpace, [nodesets.standard]);
    });
    after(() => addressSpace.dispose());

    it("an anonymous session sees the mandatory Identities of a well-known role, but cannot read it", () => {
        // CTT Base Info Core Structure 001 walks the Server node on an anonymous session and
        // expects every Mandatory child of the RoleType instances to be there
        const anonymousRole = addressSpace.findNode(resolveNodeId(ObjectIds.WellKnownRole_Anonymous)) as UAObject;
        should.exist(anonymousRole);
        ensureObjectIsSecure(anonymousRole);
        const identities = anonymousRole.getPropertyByName("Identities") as UAVariable;
        should.exist(identities);

        const anonymous = makeMockSessionContext({
            userName: "anonymous",
            server: serverFor(makeRoles([WellKnownRoles.Anonymous]))
        });
        anonymous.isBrowseAccessRestricted(anonymousRole).should.eql(false);
        anonymous.isBrowseAccessRestricted(identities).should.eql(false);
        anonymous.checkPermission(identities, PermissionType.Read).should.eql(false);

        const admin = makeMockSessionContext({ userName: "root", server: serverFor(makeRoles([WellKnownRoles.SecurityAdmin])) });
        admin.checkPermission(identities, PermissionType.Read).should.eql(true);
    });
});
