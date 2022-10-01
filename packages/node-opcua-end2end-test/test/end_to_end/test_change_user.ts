import "should";
import "mocha";
import * as chalk from "chalk";
import {
    OPCUAClient,
    UserTokenType,
    IBasicSession,
    AttributeIds,
    DataValue,
    ClientSession,
    StatusCodes,
    OPCUAServer,
    makeRoles,
    WellKnownRoles,
    makeUserManager,
    DataType,
    makePermissionFlag,
    NodeId
} from "node-opcua";
import should = require("should");

const users = [
    {
        username: "user1",
        password: "password1",
        roles: makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.ConfigureAdmin])
    }
];

const port = 2237;
const endpointUrl = `opc.tcp://localhost:${port}`;

async function startServer() {
    const server = new OPCUAServer({
        port,
        userManager: makeUserManager({
            isValidUser: (username: string, password: string) => {

                if (username === "make_me_crash") {
                    throw new Error("isValidUser has thrown an exception");
                }

                const uIndex = users.findIndex(function (u) {
                    return u.username === username;
                });
                if (uIndex < 0) {
                    console.error(chalk.red("No such user, wrong username!"));
                    return false;
                }
                if (users[uIndex].password !== password) {
                    console.error(chalk.red("Wrong password!"));
                    return false;
                }
                return true;
            },
            getUserRoles: (username: string): NodeId[] => {
                const uIndex = users.findIndex(function (x) {
                    return x.username === username;
                });
                if (uIndex < 0) {
                    return makeRoles("Anonymous");
                }
                const userRole = users[uIndex].roles;
                return userRole;
            }
        })
    });

    await server.initialize();
    const addressSpace = server.engine.addressSpace!;

    const namespace = addressSpace.getOwnNamespace();

    const secretVariable = namespace.addVariable({
        browseName: "SecretValue",
        nodeId: "s=SecretValue",
        dataType: DataType.String,
        componentOf: addressSpace.rootFolder.objects.server
    });

    secretVariable.setRolePermissions([
        {
            roleId: WellKnownRoles.ConfigureAdmin,
            permissions: makePermissionFlag("Read | Browse | ReadRolePermissions")
        },
        {
            roleId: WellKnownRoles.Anonymous,
            permissions: makePermissionFlag("Browse")
        }
    ]);

    let counter = 0;
    const timerId = setInterval(() => {
        secretVariable.setValueFromSource({
            dataType: DataType.String,
            value: "confidential data - " + counter++
        });
    }, 1000);
    addressSpace.registerShutdownTask(() => clearInterval(timerId));

    await server.start();

    return server;
}

async function doTest(session: IBasicSession): Promise<DataValue> {
    const dataValue = await session.read({
        nodeId: "ns=1;s=SecretValue",
        attributeId: AttributeIds.Value
    });
    // console.log(dataValue.toString());
    return dataValue;
}

async function test_with_anonymous_user() {
    const client = OPCUAClient.create({ endpointMustExist: false });

    const dataValue = await client.withSessionAsync(
        {
            endpointUrl,
            userIdentity: { type: UserTokenType.Anonymous }
        },
        async (session) => {
            return await doTest(session);
        }
    );
    return dataValue;
}

async function test_with_admin_user() {
    const client = OPCUAClient.create({ endpointMustExist: false });

    return await client.withSessionAsync(
        {
            endpointUrl,
            userIdentity: {
                type: UserTokenType.UserName,
                userName: "user1",
                password: "password1"
            }
        },
        async (session) => {
            return await doTest(session);
        }
    );
}

async function test_with_wrong_user_should_throw() {
    const client = OPCUAClient.create({ endpointMustExist: false });

    let _err: Error | undefined = undefined;
    try {
        const dataValue = await client.withSessionAsync(
            {
                endpointUrl,
                userIdentity: {
                    type: UserTokenType.UserName,
                    userName: "user2",
                    password: "password2"
                }
            },
            async (session) => {
                return await doTest(session);
            }
        );
        console.log("Admin (wrong user)=>  Read => Expecting Good".padEnd(50) + " Got=", dataValue.statusCode.toString());
    } catch (err) {
        _err = err as Error;
        console.log((err as Error).message);
    }
    should.exist(_err, "expecting");
}

async function test_with_admin_user_changing_to_anonymous() {
    const client = OPCUAClient.create({ endpointMustExist: false });

    return await client.withSessionAsync(
        {
            endpointUrl,
            userIdentity: {
                type: UserTokenType.UserName,
                userName: "user1",
                password: "password1"
            }
        },
        async (session: ClientSession) => {
            await session.changeUser({
                type: UserTokenType.Anonymous
            });
            return await doTest(session);
        }
    );
}

async function test_with_anonymous_user_changing_to_admin() {
    const client = OPCUAClient.create({ endpointMustExist: false });

    return await client.withSessionAsync(
        {
            endpointUrl,
            userIdentity: { type: UserTokenType.Anonymous }
        },
        async (session: ClientSession) => {
            await session.changeUser({
                type: UserTokenType.UserName,
                userName: "user1",
                password: "password1"
            });
            return await doTest(session);
        }
    );
}
async function test_with_admin_user_changing_to_wrong_user() {
    const client = OPCUAClient.create({ endpointMustExist: false });

    return await client.withSessionAsync(
        {
            endpointUrl,
            userIdentity: {
                type: UserTokenType.UserName,
                userName: "user1",
                password: "password1"
            }
        },
        async (session: ClientSession) => {
            const statusCode1 = await session.changeUser({
                type: UserTokenType.UserName,
                userName: "user2",
                password: "password2"
            });
            console.log("statusCode1 = ", statusCode1.toString());
            return await doTest(session);
        }
    );
}

async function test_with_admin_chaging_to_make_is_valid_user_crash() {
    // make_me_crash
    const client = OPCUAClient.create({ endpointMustExist: false });

    return await client.withSessionAsync(
        {
            endpointUrl,
            userIdentity: {
                type: UserTokenType.Anonymous
            }
        },
        async (session: ClientSession) => {
            const statusCode1 = await session.changeUser({
                type: UserTokenType.UserName,
                userName: "make_me_crash",
                password: "who cares ?"
            });
            // console.log("statusCode1 = ", statusCode1.toString());
            return await doTest(session);
        }
    );
}
async function test_with_anonymous_user_changing_to_wrong_user() {
    const client = OPCUAClient.create({ endpointMustExist: false });

    return await client.withSessionAsync(
        {
            endpointUrl,
            userIdentity: {
                type: UserTokenType.Anonymous
            }
        },
        async (session: ClientSession) => {
            const statusCode1 = await session.changeUser({
                type: UserTokenType.UserName,
                userName: "user2",
                password: "password2"
            });
            console.log("statusCode1 = ", statusCode1.toString());
            return await doTest(session);
        }
    );
}

const doDebug = false;
describe("Testing user change security", () => {
    let server: OPCUAServer;
    before(async () => {
        server = await startServer();
    });
    after(async () => {
        await server.shutdown();
    });
    it("should **NOT** be possible to read the secret value when the session is anonymous", async () => {
        const dataValue = await test_with_anonymous_user();
        doDebug && console.log("Anonymous => Expecting BadUserAccessDenied".padEnd(50) + " Got=", dataValue.statusCode.toString());
        dataValue.statusCode.should.eql(StatusCodes.BadUserAccessDenied);
    });
    it("should  be possible to read the secret value when the session is admin", async () => {
        const dataValue = await test_with_admin_user();
        doDebug && console.log("Admin => Expecting Good".padEnd(50) + " Got=", dataValue.statusCode.toString());
        dataValue.statusCode.should.eql(StatusCodes.Good);
    });

    it("should throw if a invalid is provided at session creation", async () => {
        const dataValue = await test_with_wrong_user_should_throw();
    });

    it("should  be possible to read the secret value when the session is anonymous then changed to admin", async () => {
        const dataValue = await test_with_anonymous_user_changing_to_admin();
        doDebug && console.log("Anonymous => Admin=> Read => Expecting Good".padEnd(50) + " Got=", dataValue.statusCode.toString());
        dataValue.statusCode.should.eql(StatusCodes.Good);
    });
    it("should  be possible to read the secret value when the session is admin then changed to anonymous", async () => {
        const dataValue = await test_with_admin_user_changing_to_anonymous();
        doDebug &&
            console.log(
                "Admin=> Anonymous => Read => Expecting BadUserAccessDenied".padEnd(50) + " Got=",
                dataValue.statusCode.toString()
            );
        dataValue.statusCode.should.eql(StatusCodes.BadUserAccessDenied);
    });
    it("should  be possible to read the secret value when the session is admin then failing to changed to wrong user", async () => {
        const dataValue = await test_with_admin_user_changing_to_wrong_user();
        doDebug && console.log("Admin  => Wrong => Read => Expecting Good".padEnd(50) + " Got=", dataValue.statusCode.toString());
        dataValue.statusCode.should.eql(StatusCodes.Good);
    });

    it("should **NOT** be possible to read the secret value when the session is anonymous failing to changed to wrong user", async () => {
        const dataValue = await test_with_anonymous_user_changing_to_wrong_user();
        doDebug &&
            console.log(
                "Admin  => Wrong => Read => Expecting BadUserAccessDenied".padEnd(50) + " Got=",
                dataValue.statusCode.toString()
            );
        dataValue.statusCode.should.eql(StatusCodes.BadUserAccessDenied);
    });

    it("server should be robust when isValidUser  method provided by the developer crashes", async () => {
        const dataValue = await test_with_admin_chaging_to_make_is_valid_user_crash();
        dataValue.statusCode.should.eql(StatusCodes.BadUserAccessDenied);
    });
});
