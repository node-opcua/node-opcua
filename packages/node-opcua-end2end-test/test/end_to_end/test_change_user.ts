import os from "os";
import should from "should";
import "mocha";
import chalk from "chalk";
import {
    OPCUAClient,
    UserTokenType,
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
    NodeId,
    TimestampsToReturn,
    Variant,
    IBasicSessionReadAsyncSimple
} from "node-opcua";
import { compareSync, genSaltSync, hashSync } from "bcryptjs";

const salt = genSaltSync(10);

const users = [
    {
        username: "user1",
        password: hashSync((() => "password1")(), salt),
        roles: makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.ConfigureAdmin])
    }
];

const port = 2243;
const endpointUrl = `opc.tcp://${os.hostname()}:${port}`;
const nodeId = "ns=1;s=SecretValue";

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
                return compareSync(password, users[uIndex].password);
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
        componentOf: addressSpace.rootFolder.objects.server,
        minimumSamplingInterval: 50
    });
    secretVariable.setValueFromSource({
        value: new Variant({
            dataType: DataType.String,
            value: "OK"
        })
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
    }, 100);
    addressSpace.registerShutdownTask(() => clearInterval(timerId));

    await server.start();

    return server;
}

async function doTest(session: IBasicSessionReadAsyncSimple): Promise<DataValue> {
    const dataValue = await session.read({
        nodeId,
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
                password: (() => "password1")()
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
                    password: (() => "password2")()
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
                password: (() => "password1")()
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
                password: (() => "password1")()
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
                password: (() => "password1")()
            }
        },
        async (session: ClientSession) => {
            const statusCode1 = await session.changeUser({
                type: UserTokenType.UserName,
                userName: "user2",
                password: (() => "password2")()
            });
            console.log("statusCode1 = ", statusCode1.toString());
            return await doTest(session);
        }
    );
}

async function test_with_admin_changing_to_make_is_valid_user_crash() {
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
                password: (() => "who cares ?")()
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
                password: (() => "password2")()
            });
            console.log("statusCode1 = ", statusCode1.toString());
            return await doTest(session);
        }
    );
}

const doDebug = false;
// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
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
        const dataValue = await test_with_admin_changing_to_make_is_valid_user_crash();
        dataValue.statusCode.should.eql(StatusCodes.BadUserAccessDenied);
    });
});

describe("Testing subscription and  security", function (this: any) {
    this.timeout(1000000);

    let server: OPCUAServer;
    before(async () => {
        server = await startServer();
    });
    after(async () => {
        await server.shutdown();
    });

    it("should not be possible to monitor a restricted variable", async () => {
        const client = OPCUAClient.create({ endpointMustExist: false });

        const dataValues: DataValue[] = [];
        await client.withSubscriptionAsync(
            {
                endpointUrl,
                userIdentity: { type: UserTokenType.Anonymous }
            },
            {
                publishingEnabled: true,
                requestedPublishingInterval: 500
            },
            async (session, subscription) => {
                const dataValue = await session.read({
                    nodeId
                });
                dataValues.push(dataValue);

                const monitorItem = await subscription.monitor(
                    {
                        attributeId: AttributeIds.Value,
                        nodeId
                    },
                    {
                        queueSize: 100,
                        samplingInterval: 60
                    },
                    TimestampsToReturn.Both
                );
                monitorItem.on("err", (err) => {
                    console.log("on error");
                });
                monitorItem.on("changed", (dataValue) => {
                    dataValues.push(dataValue);
                });
                await new Promise((resolve) => setTimeout(resolve, 2 * 1000));
                console.log("s=", monitorItem.statusCode.toString());
            }
        );
        // return dataValue;
        dataValues[0].statusCode.should.eql(StatusCodes.BadUserAccessDenied);
        if (dataValues.length >= 1) {
            dataValues.forEach((d) => console.log(d.toString()));
        }
        if (dataValues.length > 1) {
            dataValues[1].statusCode.should.eql(StatusCodes.BadUserAccessDenied);
        }
        // dataValues.length.should.eql(1);
    });

    it("should stop monitoring a restricted variable when user change with lesser access right", async () => {
        const client = OPCUAClient.create({ endpointMustExist: false });

        let dataValues: DataValue[] = [];
        await client.withSubscriptionAsync(
            {
                endpointUrl,
                userIdentity: {
                    type: UserTokenType.UserName,
                    userName: "user1",
                    password: (() => "password1")()
                }
            },
            {
                publishingEnabled: true,
                requestedPublishingInterval: 250
            },
            async (session, subscription) => {
                const dataValue = await session.read({
                    nodeId
                });
                dataValues.push(dataValue);

                const monitorItem = await subscription.monitor(
                    {
                        attributeId: AttributeIds.Value,
                        nodeId
                    },
                    {
                        queueSize: 1,
                        samplingInterval: 100
                    },
                    TimestampsToReturn.Both
                );
                monitorItem.on("err", (err) => {
                    console.log("on error");
                });
                monitorItem.on("changed", (dataValue) => {
                    console.log("tick");
                    dataValues.push(dataValue);
                });

                await new Promise((resolve) => setTimeout(resolve, 2 * 1000));

                dataValues.length.should.be.greaterThan(2);
                // now rest dataValue
                dataValues = [];

                console.log("s=", monitorItem.statusCode.toString());
                // ------------------------------------
                await session.changeUser({
                    type: UserTokenType.Anonymous
                });
                await new Promise((resolve) => setTimeout(resolve, 5 * 1000));
                console.log("s=", monitorItem.statusCode.toString());
            }
        );
        // return dataValue;
        if (dataValues.length >= 1) {
            dataValues.forEach((d) => console.log(d.toString()));
        }
        if (dataValues.length > 1) {
            dataValues[dataValues.length - 1].statusCode.should.eql(StatusCodes.BadUserAccessDenied);
        } else {
            dataValues[0].statusCode.should.eql(StatusCodes.BadUserAccessDenied);
        }
    });
    it("should start monitoring a restricted variable when user change with great access right", async () => {
        const client = OPCUAClient.create({ endpointMustExist: false });

        let dataValues: DataValue[] = [];
        await client.withSubscriptionAsync(
            {
                endpointUrl,
                userIdentity: {
                    type: UserTokenType.Anonymous
                }
            },
            {
                publishingEnabled: true,
                requestedPublishingInterval: 250
            },
            async (session, subscription) => {
                const dataValue = await session.read({
                    nodeId
                });
                dataValues.push(dataValue);

                const monitorItem = await subscription.monitor(
                    {
                        attributeId: AttributeIds.Value,
                        nodeId
                    },
                    {
                        queueSize: 1,
                        samplingInterval: 100
                    },
                    TimestampsToReturn.Both
                );
                monitorItem.on("err", (err) => {
                    console.log("on error");
                });
                monitorItem.on("changed", (dataValue) => {
                    console.log("tick");
                    dataValues.push(dataValue);
                });

                await new Promise((resolve) => setTimeout(resolve, 2 * 1000));

                // now rest dataValue
                dataValues = [];

                console.log("s=", monitorItem.statusCode.toString());
                // ------------------------------------
                await session.changeUser({
                    type: UserTokenType.UserName,
                    userName: "user1",
                    password: (() => "password1")()
                });
                await new Promise((resolve) => setTimeout(resolve, 2 * 1000));
                dataValues.length.should.be.greaterThan(2);
                console.log("s=", monitorItem.statusCode.toString());
            }
        );
        // return dataValue;
        if (dataValues.length >= 1) {
            dataValues.forEach((d) => console.log(d.toString()));
        }
        if (dataValues.length > 1) {
            dataValues[1].statusCode.should.eql(StatusCodes.Good);
        } else {
            dataValues[0].statusCode.should.eql(StatusCodes.Good);
        }
    });
});
