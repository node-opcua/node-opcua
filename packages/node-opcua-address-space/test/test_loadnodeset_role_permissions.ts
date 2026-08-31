import { AccessLevelFlag, AccessRestrictionsFlag } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { PermissionType } from "node-opcua-types";
import should from "should";
import { AddressSpace, generateAddressSpaceRaw, type UAMethod, type UAObject, type UAObjectType, type UAVariable } from "..";
import { generateAddressSpace, readNodeSet2XmlFile } from "../nodeJS.js";
import { getAddressSpaceFixture } from "../test_helpers/get_address_space_fixture.js";

const fixture = getAddressSpaceFixture("nodeset_with_role_permissions.xml");

const securityAdmin = resolveNodeId("WellKnownRole_SecurityAdmin").toString();
const anonymous = resolveNodeId("WellKnownRole_Anonymous").toString();
const IN_MEMORY = "<in-memory>";

describe("Testing loadNodeSet - per node RolePermissions and AccessRestrictions", function (this: Mocha.Suite) {
    this.timeout(200000);

    let addressSpace: AddressSpace;
    beforeEach(() => {
        addressSpace = AddressSpace.create();
    });
    afterEach(() => {
        addressSpace.dispose();
    });

    describe('when both parts of the policy are applied (accessRestrictions: "apply")', () => {
        beforeEach(async () => {
            await generateAddressSpace(addressSpace, [nodesets.standard, fixture], { accessRestrictions: "apply" });
        });

        it("LNSRP-1 should install RolePermissions and AccessRestrictions declared on a UAObject", () => {
            const object = addressSpace.findNode("ns=1;i=1000") as UAObject;
            should.exist(object);

            should(object.accessRestrictions).eql(
                AccessRestrictionsFlag.SigningRequired | AccessRestrictionsFlag.EncryptionRequired
            );

            const rolePermissions = object.rolePermissions!;
            rolePermissions.length.should.eql(1);
            rolePermissions[0].roleId.toString().should.eql(securityAdmin);
            rolePermissions[0].permissions.should.eql(63);
        });

        it("LNSRP-2 should install several RolePermissions declared on a UAVariable", () => {
            const variable = addressSpace.findNode("ns=1;i=1001") as UAVariable;
            should.exist(variable);

            should(variable.accessRestrictions).eql(AccessRestrictionsFlag.SigningRequired);

            const rolePermissions = variable.rolePermissions!;
            rolePermissions.length.should.eql(2);
            rolePermissions[0].roleId.toString().should.eql(securityAdmin);
            rolePermissions[0].permissions.should.eql(PermissionType.Browse | PermissionType.ReadRolePermissions);
            rolePermissions[1].roleId.toString().should.eql(anonymous);
            rolePermissions[1].permissions.should.eql(PermissionType.Browse);
        });

        it("LNSRP-3 should honour an explicit UserAccessLevel that restricts AccessLevel (issue #1552)", () => {
            const variable = addressSpace.findNode("ns=1;i=1001") as UAVariable;
            variable.accessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
            should(variable.userAccessLevel).eql(AccessLevelFlag.CurrentRead);
        });

        it("LNSRP-4 should let UserAccessLevel default to AccessLevel when it is not declared", () => {
            const variable = addressSpace.findNode("ns=1;i=1003") as UAVariable;
            variable.accessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
            should(variable.userAccessLevel).eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
        });

        it("LNSRP-5 should turn HasNoPermissions into an empty, non inherited, permission list", () => {
            const variable = addressSpace.findNode("ns=1;i=1002") as UAVariable;
            should(variable.rolePermissions).eql([]);
            // an empty list must not fall back on the namespace default
            should(variable.getRolePermissions(true)).eql([]);
        });

        it("LNSRP-6 should leave a node that declares no policy inheriting the namespace default", () => {
            const variable = addressSpace.findNode("ns=1;i=1003") as UAVariable;
            should(variable.rolePermissions).eql(undefined);
            should(variable.accessRestrictions).eql(undefined);
        });

        it("LNSRP-7 should install the policy on UAMethod and UAObjectType too", () => {
            const method = addressSpace.findNode("ns=1;i=1004") as UAMethod;
            should(method.accessRestrictions).eql(AccessRestrictionsFlag.EncryptionRequired);
            should(method.rolePermissions?.length).eql(1);
            should(method.rolePermissions?.[0].permissions).eql(PermissionType.Call);

            const objectType = addressSpace.findNode("ns=1;i=2000") as UAObjectType;
            should(objectType.accessRestrictions).eql(
                AccessRestrictionsFlag.SigningRequired | AccessRestrictionsFlag.EncryptionRequired
            );
            should(objectType.rolePermissions?.length).eql(1);
        });
    });

    describe("with the default options - RolePermissions applied, AccessRestrictions not", () => {
        beforeEach(async () => {
            await generateAddressSpace(addressSpace, [nodesets.standard, fixture]);
        });

        it("LNSRP-11 should install RolePermissions, which are a property of the model", () => {
            const object = addressSpace.findNode("ns=1;i=1000") as UAObject;
            should(object.rolePermissions?.length).eql(1);
            should(object.rolePermissions?.[0].roleId.toString()).eql(securityAdmin);

            const locked = addressSpace.findNode("ns=1;i=1002") as UAVariable;
            should(locked.rolePermissions).eql([], "HasNoPermissions is part of the same declaration");
        });

        it("LNSRP-12 should leave AccessRestrictions alone, since they depend on the deployment", () => {
            // opting in is what makes them take effect - see NodeSetLoaderOptions.accessRestrictions
            for (const nodeId of ["ns=1;i=1000", "ns=1;i=1001", "ns=1;i=1004", "ns=1;i=2000"]) {
                const node = addressSpace.findNode(nodeId)!;
                should(node.accessRestrictions).eql(undefined, `${nodeId} should carry no AccessRestrictions`);
            }
        });

        it("LNSRP-13 should not restrict a Server node an unsecured Session must still reach", () => {
            // i=16302, the InputArguments of AddRole, carries AccessRestrictions="1". Enforcing it
            // denies the read over an unsecured channel, which is what used to break the client proxy.
            const inputArguments = addressSpace.findNode("i=16302")!;
            should.exist(inputArguments);
            should(inputArguments.accessRestrictions).eql(undefined);
        });
    });

    describe('when the access policy is ignored (permissions: "ignore")', () => {
        beforeEach(async () => {
            await generateAddressSpace(addressSpace, [nodesets.standard, fixture], { permissions: "ignore" });
        });

        it("LNSRP-8 should drop RolePermissions and AccessRestrictions, as node-opcua used to", () => {
            const object = addressSpace.findNode("ns=1;i=1000") as UAObject;
            should(object.accessRestrictions).eql(undefined);
            should(object.rolePermissions).eql(undefined);

            const variable = addressSpace.findNode("ns=1;i=1001") as UAVariable;
            should(variable.accessRestrictions).eql(undefined);
            should(variable.rolePermissions).eql(undefined);

            const locked = addressSpace.findNode("ns=1;i=1002") as UAVariable;
            should(locked.rolePermissions).eql(undefined);
        });

        it("LNSRP-9 should still honour UserAccessLevel, which is not part of the access policy", () => {
            const variable = addressSpace.findNode("ns=1;i=1001") as UAVariable;
            should(variable.userAccessLevel).eql(AccessLevelFlag.CurrentRead);
        });
    });

    describe("round trip through the exporter", () => {
        it("LNSRP-10 should export the access policy and UserAccessLevel and read them back (issue #1552)", async () => {
            await generateAddressSpace(addressSpace, [nodesets.standard, fixture], { accessRestrictions: "apply" });

            const xml = addressSpace.getNamespace("http://sterfive.com/UA/RolePermissions/").toNodeset2XML();

            xml.should.match(/AccessRestrictions="3"/);
            xml.should.match(/UserAccessLevel="1"/);
            xml.should.match(/HasNoPermissions="true"/);
            xml.should.match(/<RolePermission Permissions="63">i=15704<\/RolePermission>/);

            const reloaded = AddressSpace.create();
            try {
                await generateAddressSpaceRaw(
                    reloaded,
                    [nodesets.standard, IN_MEMORY],
                    async (xmlFile: string) => (xmlFile === IN_MEMORY ? xml : await readNodeSet2XmlFile(xmlFile)),
                    { accessRestrictions: "apply" }
                );

                const object = reloaded.findNode("ns=1;i=1000") as UAObject;
                should(object.accessRestrictions).eql(
                    AccessRestrictionsFlag.SigningRequired | AccessRestrictionsFlag.EncryptionRequired
                );
                should(object.rolePermissions?.length).eql(1);
                should(object.rolePermissions?.[0].roleId.toString()).eql(securityAdmin);

                const variable = reloaded.findNode("ns=1;i=1001") as UAVariable;
                variable.accessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
                should(variable.userAccessLevel).eql(AccessLevelFlag.CurrentRead);
                should(variable.rolePermissions?.length).eql(2);

                const locked = reloaded.findNode("ns=1;i=1002") as UAVariable;
                should(locked.rolePermissions).eql([]);

                const plain = reloaded.findNode("ns=1;i=1003") as UAVariable;
                should(plain.rolePermissions).eql(undefined);
                should(plain.accessRestrictions).eql(undefined);
            } finally {
                reloaded.dispose();
            }
        });
    });
});
