process.env.NODEOPCUADEBUG = ""; // "CLIENT{TRACE-SECURITY}";
// process.env.NODEOPCUADEBUG = "CLIENT{TRACE-SECURITY};TRANSPORT{CHUNK-HELACK}";

const { setLogLevel, LogLevel, OPCUAClient, UserTokenType, MessageSecurityMode, SecurityPolicy } = require("node-opcua-client");
const chalk = require("chalk");

const endpointUrl = "opc.tcp://opcuademo.sterfive.com:26544";

setLogLevel(LogLevel.Critic);

async function test(security, endpoint) {
    console.log({ security, endpoint });
    const client = OPCUAClient.create({
        ...security,
        endpointMustExist: false,
        connectionStrategy
        : {
            initialDelay: 500,
            maxDelay: 1000,
            maxRetry: 3,
            randomisationFactor: 0
        }
    });
    try {
        client.on("backoff", (nbRetry, delay) => console.log("backoff #", nbRetry, " retrying in ", delay / 1000.0, "seconds"));
        await client.withSessionAsync(endpoint, async (session) => {
            console.log(chalk.green("**************************************"));

            console.log(chalk.green("Connection was successful !"));
            console.log(chalk.green("**************************************"));
        });
    } catch (err) {
        if (err.message.match(/socket has been disconnected by third party/)) {
            console.log(chalk.magenta("**************************************"));
            console.log(chalk.magenta("  The connection has been rejected by the server"));
            console.log(chalk.magenta("  if you are using security please make sure that"));
            console.log(chalk.magenta("  your client certificate is trusted by the server."));
            console.log(chalk.magenta("  Refers to the server document to find out how to proceed. "));
            console.log(chalk.magenta(""));
            console.log(chalk.magenta("  By the way! Your client certificate PEM file is located here "));
            console.log(chalk.magenta("    "), chalk.cyan(client.certificateFile));
            console.log(chalk.magenta("**************************************"));
        } else {
            console.log(chalk.red("**************************************"));
            console.log(chalk.red("Houston we have a problem:", err.message));
            console.log(chalk.red("**************************************"));
        }
    }

    console.log("\n");
    console.log("-----------------------------------------------------");
}

async function main() {
    const noSecurity = {};
    const security1 = {
        securityMode: MessageSecurityMode.SignAndEncrypt,
        securityPolicy: SecurityPolicy.Basic256Sha256
    };
    const endpoint1 = {
        endpointUrl,
        userIdentity: { type: UserTokenType.Anonymous }
    };
    const endpoint2 = {
        endpointUrl,
        userIdentity: { type: UserTokenType.UserName, userName: "user1", password: "password1" }
    };
    await test(noSecurity, endpoint1);
    await test(noSecurity, endpoint2);

    await test(security1, endpoint1);
    await test(security1, endpoint2);
}
main();
