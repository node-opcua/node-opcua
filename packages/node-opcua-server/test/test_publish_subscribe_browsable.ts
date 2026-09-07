/**
 * Server/PublishSubscribe/SecurityGroups shows the mandatory methods of SecurityGroupFolderType to
 * every session over the Browse service, while calling them stays with the SecurityKeyServerAdmin
 * role the nodeset named (CTT Base Info Core Structure 002, FEAT-30).
 */
import { type AddressSpace, type ISessionContext, makeRoles, type UAMethod, WellKnownRoles } from "node-opcua-address-space";
import {
    BrowseDirection,
    type ClientSession,
    MessageSecurityMode,
    OPCUAClient,
    SecurityPolicy,
    type UserIdentityInfo,
    UserTokenType
} from "node-opcua-client";
import { ObjectIds } from "node-opcua-constants";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, type Variant } from "node-opcua-variant";
import "should";
import { OPCUAServer } from "../dist/index.js";

const port = 5798;
const securityGroups = "i=15443";
const addSecurityGroup = "i=15444";

const users: Record<string, ReturnType<typeof makeRoles>> = {
    // every administrative role a user manager hands out, none of the SecurityKeyServer ones: the CTT's admin
    root: makeRoles([
        WellKnownRoles.AuthenticatedUser,
        WellKnownRoles.Supervisor,
        WellKnownRoles.SecurityAdmin,
        WellKnownRoles.ConfigureAdmin
    ]),
    sks: makeRoles([WellKnownRoles.AuthenticatedUser, ObjectIds.WellKnownRole_SecurityKeyServerAdmin])
};

describe("Server/PublishSubscribe/SecurityGroups over the Browse service", function (this: Mocha.Suite) {
    this.timeout(120000);
    let server: OPCUAServer;
    before(async () => {
        server = new OPCUAServer({
            port,
            nodeset_filename: [nodesets.standard],
            userManager: {
                isValidUser: (userName: string, password: string) => userName in users && password === "secret",
                getUserRoles: (userName: string) => users[userName] ?? makeRoles([WellKnownRoles.Anonymous])
            }
        });
        await server.initialize();
        // an unbound method answers BadNotExecutable before its permissions are looked at
        const addressSpace = server.engine.addressSpace as AddressSpace;
        (addressSpace.findNode(addSecurityGroup) as UAMethod).bindMethod(
            async (_inputArguments: Variant[], _context: ISessionContext) => ({
                statusCode: StatusCodes.Good,
                outputArguments: [{ dataType: DataType.NodeId, value: addressSpace.findNode(securityGroups)!.nodeId }]
            })
        );
        await server.start();
    });
    after(async () => {
        await server.shutdown();
    });

    async function withSession<T>(identity: UserIdentityInfo, action: (session: ClientSession) => Promise<T>): Promise<T> {
        const client = OPCUAClient.create({
            endpointMustExist: false,
            securityMode: MessageSecurityMode.None,
            securityPolicy: SecurityPolicy.None
        });
        await client.connect(server.getEndpointUrl());
        try {
            const session = await client.createSession(identity);
            try {
                return await action(session);
            } finally {
                await session.close();
            }
        } finally {
            await client.disconnect();
        }
    }

    const anonymous: UserIdentityInfo = { type: UserTokenType.Anonymous };
    const asUser = (userName: string): UserIdentityInfo => ({ type: UserTokenType.UserName, userName, password: "secret" });

    async function componentsOfSecurityGroups(session: ClientSession): Promise<string[]> {
        const result = await session.browse({
            nodeId: securityGroups,
            browseDirection: BrowseDirection.Forward,
            referenceTypeId: "HasComponent",
            includeSubtypes: true,
            resultMask: 63
        });
        result.statusCode.should.eql(StatusCodes.Good);
        return (result.references || []).map((reference) => reference.browseName.name || "");
    }

    const callAddSecurityGroup = (session: ClientSession) =>
        session.call({
            objectId: securityGroups,
            methodId: addSecurityGroup,
            inputArguments: [
                { dataType: DataType.String, value: "Group1" },
                { dataType: DataType.Double, value: 1000 },
                { dataType: DataType.String, value: "http://opcfoundation.org/UA/SecurityPolicy#None" },
                { dataType: DataType.UInt32, value: 1 },
                { dataType: DataType.UInt32, value: 1 }
            ]
        });

    it("an anonymous session sees AddSecurityGroup and RemoveSecurityGroup", async () => {
        const components = await withSession(anonymous, componentsOfSecurityGroups);
        components.should.eql(["AddSecurityGroup", "RemoveSecurityGroup"]);
    });

    it("an administrator without the SecurityKeyServerAdmin role sees them too", async () => {
        const components = await withSession(asUser("root"), componentsOfSecurityGroups);
        components.should.eql(["AddSecurityGroup", "RemoveSecurityGroup"]);
    });

    it("but cannot call AddSecurityGroup: Call stays with the role the nodeset named", async () => {
        const result = await withSession(asUser("root"), callAddSecurityGroup);
        result.statusCode.should.eql(StatusCodes.BadUserAccessDenied);
    });

    it("a SecurityKeyServerAdmin calls it", async () => {
        const result = await withSession(asUser("sks"), callAddSecurityGroup);
        result.statusCode.should.eql(StatusCodes.Good);
    });
});
