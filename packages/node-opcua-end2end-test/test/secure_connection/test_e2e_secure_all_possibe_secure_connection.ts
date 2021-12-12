"use strict";

// http://opcfoundation.org/UA/SecurityPolicy#Basic256
Error.stackTraceLimit = Infinity;
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

import { randomBytes } from "crypto";

import * as chalk from "chalk";
import * as should from "should";
import * as sinon from "sinon";

import {
    ClientSubscription,
    coerceMessageSecurityMode,
    MessageSecurityMode,
    SecurityPolicy,
    coerceSecurityPolicy,
    OPCUACertificateManager,
    OPCUAClient,
    ClientSecureChannelLayer,
    getDefaultCertificateManager,
    TimestampsToReturn,
    MonitoringMode,
    AttributeIds,
    NodeId,
    OPCUAServer,
    OPCUAServerOptions,
    ClientSession,
    SecurityToken,
    ChannelSecurityToken
} from "node-opcua";
import { CertificateAuthority, dumpCertificate } from "node-opcua-pki";
import { readCertificateRevocationList, readCertificate } from "node-opcua-crypto";

import { make_debugLog, checkDebugFlag } from "node-opcua-debug";
const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

const sampleCertificateFolder = path.join(__dirname, "../../../node-opcua-samples/certificates");
fs.existsSync(sampleCertificateFolder).should.eql(true, "expecting certificate store at " + sampleCertificateFolder);

const port = 2236;

const { build_server_with_temperature_device } = require("../../test_helpers/build_server_with_temperature_device");

const g_defaultSecureTokenLifetime = 30 * 1000; // ms
const g_tokenRenewalInterval = 200; // renew token as fast as possible
const g_numberOfTokenRenewal = 2;

let server: OPCUAServer;
let endpointUrl: string;
let serverCertificate: string;
let temperatureVariableId: NodeId;

const no_reconnect_connectivity_strategy = {
    maxRetry: 0, // NO RETRY !!!
    initialDelay: 100,
    maxDelay: 200,
    randomisationFactor: 0
};
const _tmpFolder = path.join(__dirname, "../../tmp");
if (!fs.existsSync(_tmpFolder)) {
    fs.mkdirSync(_tmpFolder);
}

async function makeServerCertificateManager(port): Promise<OPCUACertificateManager> {
    const certificateManager = new OPCUACertificateManager({
        automaticallyAcceptUnknownCertificate: true,
        rootFolder: path.join(_tmpFolder, "serverPKI-all-possible_secure_connection")
    });
    await certificateManager.initialize();

    const issuerCertificateFile = path.join(sampleCertificateFolder, "CA/public/cacert.pem");
    const issuerCertificateRevocationListFile = path.join(sampleCertificateFolder, "CA/crl/revocation_list.der");

    const issuerCertificate = await readCertificate(issuerCertificateFile);

    const issuerCrl = await readCertificateRevocationList(issuerCertificateRevocationListFile);
    await certificateManager.addIssuer(issuerCertificate);
    await certificateManager.addRevocationList(issuerCrl);

    return certificateManager;
}

async function getClientCertificateManager(): Promise<OPCUACertificateManager> {
    const tmpFolder = path.join(os.tmpdir(), "node-opcua-3");
    const rootFolder = path.join(tmpFolder, "clientPKI");
    const clientCertificateManager = new OPCUACertificateManager({
        rootFolder
    });
    await clientCertificateManager.initialize();

    const fakeClient = OPCUAClient.create({
        clientCertificateManager
    });
    try {
        await (fakeClient as any).createDefaultCertificate();
    } catch(err) {
        debugLog("getClientCertificateManager: cannot connect to server");
    }
    // create default certificate
    return clientCertificateManager;
}

interface InnerServer {
    endpointUrl: string;
    serverCertificate: Buffer;
    temperatureVariableId: NodeId;
    server: OPCUAServer;
}
async function start_inner_server_local(options: OPCUAServerOptions): Promise<InnerServer> {
    options = options || {};
    if (options.serverCertificateManager) {
        throw new Error("start_inner_server_local: serverCertificateManager should not be defined");
    }
    // Given a server that have a signed end point
    options.certificateFile && fs.existsSync(options.certificateFile).should.eql(true);
    options.privateKeyFile && fs.existsSync(options.privateKeyFile).should.eql(true);

    options.port = options.port || port;

    options.serverCertificateManager = await makeServerCertificateManager(port);

    server = await build_server_with_temperature_device(options);
    const data = {
        endpointUrl: server.getEndpointUrl(),
        serverCertificate: server.endpoints[0].endpointDescriptions()[0].serverCertificate,
        temperatureVariableId: server.temperatureVariableId,
        server: server
    };
    return data;
}

async function stop_inner_server_local(data: InnerServer): Promise<void> {
    if (data) {
        const server = data.server;

        // it is possible that server still have running session in this series of test, as we are testing
        // faulty client that do not renew token properly, causing server to abruptly drop the connection that
        // has become un-secured. We simply issue a warning rather than a exception if we find that currentSessionCount != 0
        if (server.engine.currentSessionCount !== 0) {
            debugLog(chalk.yellow("stop_inner_server_local:  Warning all sessions should have been closed"));
        }
        //xxx server.engine.currentSessionCount.should.equal(0, " all sessions should have been closed");
        //xxx server.currentChannelCount.should.equal(0, "All channel should have been closed");
        await server.shutdown();
    }
}

/**
 * returns the number of security token exchanged on the server
 * since the server started, performed by any endpoints.
 * @param server
 * @return {Number}
 */
function get_server_channel_security_token_change_count(server) {
    const sessions = Object.values(server.engine._sessions);
    sessions.length.should.eql(1, "Expecting only one session on server at address " + server);
    const count = server.endpoints.reduce(function (accumulated, endpoint) {
        return accumulated + endpoint.securityTokenCount;
    }, 0);

    return count;
}

async function trustClientCertificateOnServer(client: OPCUAClient): Promise<void> {

    await client.createDefaultCertificate();

    const certificateFile = client.certificateFile;

    if (!certificateFile) {
        return;
    }
    fs.existsSync(certificateFile).should.eql(true, " certificateFile must exist " + certificateFile);
    const certificate = readCertificate(certificateFile);
    await server.serverCertificateManager.trustCertificate(certificate);
}

async function trustCertificateOnClient(): Promise<void> {
    try {
        const location = path.join(sampleCertificateFolder, "CA");
        fs.existsSync(location).should.eql(true);
        const tmpCA = new CertificateAuthority({
            keySize: 2048,
            location
        });

        await tmpCA.initialize();

        fs.existsSync(tmpCA.caCertificate).should.eql(true, " caCertificate must exist " + tmpCA.caCertificate);
        fs.existsSync(tmpCA.revocationListDER).should.eql(true, " CAcrl must exist " + tmpCA.revocationListDER);

        const caCertificate = readCertificate(tmpCA.caCertificate);
        const CAcrl = await readCertificateRevocationList(tmpCA.revocationListDER);

        const clientCertificateManager = await getClientCertificateManager();
        await clientCertificateManager.trustCertificate(caCertificate);
        await clientCertificateManager.addIssuer(caCertificate);
        await clientCertificateManager.addRevocationList(CAcrl);
    } catch (err) {
        console.log(err);
    }
}

async function start_server(options: OPCUAServerOptions): Promise<InnerServer> {
    // Given a server that have a signed end point
    const data = await start_inner_server_local(options);

    endpointUrl = data.endpointUrl;
    serverCertificate = data.serverCertificate;
    temperatureVariableId = data.temperatureVariableId;

    await trustCertificateOnClient();
    return data;
}

async function start_server_with_1024bits_certificate(): Promise<InnerServer> {
    const certificateFile = path.join(sampleCertificateFolder, "server_cert_1024.pem");
    const privateKeyFile = path.join(sampleCertificateFolder, "server_key_1024.pem");
    return await start_server({ certificateFile, privateKeyFile });
}

async function start_server_with_2048bits_certificate(): Promise<InnerServer> {
    const certificateFile = path.join(sampleCertificateFolder, "server_cert_2048.pem");
    const privateKeyFile = path.join(sampleCertificateFolder, "server_key_2048.pem");
    return await start_server({ certificateFile, privateKeyFile });
}

async function start_server_with_4096bits_certificate(): Promise<InnerServer> {
    const certificateFile = path.join(sampleCertificateFolder, "server_cert_4096.pem");
    const privateKeyFile = path.join(sampleCertificateFolder, "server_key_4096.pem");
    return await start_server({ certificateFile, privateKeyFile });
}

async function stop_server(data: InnerServer): Promise<void> {
    await stop_inner_server_local(data);
    temperatureVariableId = null;
    endpointUrl = null;
    serverCertificate = null;
}

async function waitUntilTokenRenewed(client, security_token_renewed_limit): Promise<number> {
    return await new Promise<number>((resolve) => {
        let security_token_renewed_counter = 0;
        client.on("security_token_renewed", function () {
            debugLog(" Security token has been renewed");

            security_token_renewed_counter += 1;
            if (resolve && security_token_renewed_counter >= security_token_renewed_limit) {
                resolve(security_token_renewed_counter);
                resolve = null;
            }
        });
    });
}

async function keep_monitoring_some_variable(client, session, security_token_renewed_limit): Promise<number> {
    const nbTokenId_before_server_side = get_server_channel_security_token_change_count(server);
    debugLog("nbTokenId_before_server_side=", nbTokenId_before_server_side);

    const subscription = await session.createSubscription2({
        requestedPublishingInterval: 100,
        requestedLifetimeCount: 100,
        requestedMaxKeepAliveCount: 3,
        maxNotificationsPerPublish: 3,
        publishingEnabled: true,
        priority: 6
    });

    let the_error = null;
    subscription.on("internal_error", function (err) {
        debugLog(chalk.red("xxx internal error in ClientSubscription"), err.message);
        the_error = err;
    });
    subscription.on("terminated", function () {
        /* */
    });
    subscription.on("keepalive", function () {
        debugLog(chalk.red("keep alive"));
        //        console.log(".")
    });

    const m = await subscription.monitor(
        { nodeId: "i=2258", attributeId: AttributeIds.Value },
        {
            samplingInterval: 100
        },
        TimestampsToReturn.Both,
        MonitoringMode.Reporting
    );

    const security_token_renewed_counter = await waitUntilTokenRenewed(client, security_token_renewed_limit);

    await subscription.terminate();
    return security_token_renewed_counter;
}

async function common_test(securityPolicy, securityMode, options): Promise<void> {
    if (global.gc) {
        global.gc();
    }

    //xx debugLog("securityPolicy = ", securityPolicy,"securityMode = ",securityMode);

    coerceMessageSecurityMode(securityMode).should.not.eql(MessageSecurityMode.Invalid, "expecting supporting");

    options = options || {};
    options = {
        ...options,
        securityMode: coerceMessageSecurityMode(securityMode),
        securityPolicy: coerceSecurityPolicy(securityPolicy),
        //xx serverCertificate: serverCertificate,
        connectionStrategy: no_reconnect_connectivity_strategy,
        requestedSessionTimeout: 120 * 60 * 1000,

        clientCertificateManager: await getClientCertificateManager()
    };

    options.defaultSecureTokenLifetime = options.defaultSecureTokenLifetime || g_defaultSecureTokenLifetime;
    // make sure that securityToken renewal will happen very soon,
    options.tokenRenewalInterval = g_tokenRenewalInterval;

    //xx debugLog("xxxx options.defaultSecureTokenLifetime",options.defaultSecureTokenLifetime);

    let token_change = 0;
    const client = OPCUAClient.create(options);
    

    client.on("lifetime_75", function (token: ChannelSecurityToken) {
        // check if we are late!
        //
        const expectedExpiryTick = token.createdAt.getTime() + token.revisedLifetime;
        const delay = expectedExpiryTick - Date.now();
        if (delay <= 100) {
            debugLog(chalk.red("WARNING : token renewal is happening too late !!"), delay);
        }
        debugLog("received lifetime_75", token.toString(), delay);
    });
    client.on("security_token_renewed", function () {
        token_change += 1;
        debugLog("received security_token_renewed", token_change);
    });
    client.on("close", function () {
        debugLog(" connection has been closed");
    });

    await trustClientCertificateOnServer(client);

    const tokenChangeRecorded = await client.withSessionAsync(endpointUrl, async (session) => {
        return await keep_monitoring_some_variable(client, session, g_numberOfTokenRenewal);
    });
    tokenChangeRecorded.should.be.aboveOrEqual(2);
}

async function check_open_secure_channel_fails(securityPolicy, securityMode, options): Promise<void> {
    options = options || {};
    options = {
        ...options,
        securityMode: coerceMessageSecurityMode(securityMode),
        securityPolicy: coerceSecurityPolicy(securityPolicy),
        serverCertificate,
        connectionStrategy: no_reconnect_connectivity_strategy,

        clientCertificateManager: await getClientCertificateManager()
    };
    const client = OPCUAClient.create(options);
    client.on("backoff", function (number, delay) {
        debugLog(" backoff attempt#", number, " retry in ", delay);
    });

    await trustClientCertificateOnServer(client);

    try {
        await client.connect(endpointUrl);
    } catch (err) {
        debugLog("expecting open secure channel to fail");
        await client.disconnect();
        return;
    }

    await client.disconnect();

    const o = { ...options };
    o.serverCertificate = null;
    console.log("options", o);
    console.log(endpointUrl);
    console.log(new Date().toUTCString());
    dumpCertificate(client.certificateFile, (err, data) => {
        console.log(data);
    });

    // give a other chance to explore what is going on by setting a break point here
    await client.connect(endpointUrl);
    throw new Error("The connection's succeeded, but was expected to fail!");
}

async function common_test_expected_server_initiated_disconnection(securityPolicy, securityMode) {
    coerceMessageSecurityMode(securityMode).should.not.eql(MessageSecurityMode.Invalid, "expecting a valid MessageSecurityMode");

    const fail_fast_connectivity_strategy = {
        maxRetry: 1,
        initialDelay: 100,
        maxDelay: 200,
        randomisationFactor: 0
    };
    const options = {
        securityMode: coerceMessageSecurityMode(securityMode),
        securityPolicy: coerceSecurityPolicy(securityPolicy),
        serverCertificate: serverCertificate,
        defaultSecureTokenLifetime: g_defaultSecureTokenLifetime,
        tokenRenewalInterval: g_tokenRenewalInterval,

        connectionStrategy: fail_fast_connectivity_strategy,

        clientCertificateManager: await getClientCertificateManager()
    };

    let token_change = 0;
    const client = OPCUAClient.create(options);

    const after_reconnection_spy = sinon.spy();
    const start_reconnection_spy = sinon.spy();

    client.on("start_reconnection", start_reconnection_spy);
    client.on("after_reconnection", after_reconnection_spy);
    client.on("backoff", function (number, delay) {
        debugLog(chalk.bgWhite.yellow("backoff  attempt #"), number, " retrying in ", delay / 1000.0, " seconds");
    });
    client.on("lifetime_75", function (token) {
        debugLog("            received lifetime_75", token.toString());
    });
    client.on("security_token_renewed", function () {
        token_change += 1;
    });
    client.on("close", function () {
        debugLog("            connection has been closed");
    });
    client.on("close", function () {
        debugLog("            connection has been closed");
    });

    await trustClientCertificateOnServer(client);

    try {
        await client.withSessionAsync(endpointUrl, async (session) => {
            return await keep_monitoring_some_variable(client, session, g_numberOfTokenRenewal);
        });
    } catch (err) {
        start_reconnection_spy.callCount.should.eql(1);
        return;
    }
}

function perform_collection_of_test_with_client_configuration(message, options): void {
    it("should succeed with Basic128Rsa15  with Sign           " + message, async () => {
        await common_test("Basic128Rsa15", "Sign", options);
    });

    it("should succeed with Basic128Rsa15  with Sign           " + message, async () => {
        await common_test("Basic128Rsa15", "Sign", options);
    });

    it("should succeed with Basic128Rsa15  with SignAndEncrypt " + message, async () => {
        await common_test("Basic128Rsa15", "SignAndEncrypt", options);
    });

    it("should succeed with Basic256       with Sign           " + message, async () => {
        await common_test("Basic256", "Sign", options);
    });

    it("should succeed with Basic256       with SignAndEncrypt " + message, async () => {
        await common_test("Basic256", "SignAndEncrypt", options);
    });

    it("should fail    with Basic256Rsa15  with Sign           " + message, async () => {
        await check_open_secure_channel_fails("Basic256Rsa15", "Sign", options);
    });

    it("should fail    with Basic256Rsa15  with SignAndEncrypt " + message, async () => {
        await check_open_secure_channel_fails("Basic256Rsa15", "SignAndEncrypt", options);
    });

    it("should succeed with Basic256Sha256 with Sign           " + message, async () => {
        await common_test("Basic256Sha256", "Sign", options);
    });

    it("should succeed with Basic256Sha256 with SignAndEncrypt " + message, async () => {
        await common_test("Basic256Sha256", "SignAndEncrypt", options);
    });

    it("should succeed with Aes128_Sha256_RsaOaep with SignAndEncrypt " + message, async () => {
        await common_test("Aes128_Sha256_RsaOaep", "SignAndEncrypt", options);
    });

    xit("should succeed with Aes256_Sha256_RsaPss with SignAndEncrypt " + message, async () => {
        await common_test("Aes256_Sha256_RsaPss", "SignAndEncrypt", options);
    });
}

function perform_collection_of_test_with_various_client_configuration(prefix?: string): void {
    prefix = prefix || "";

    function build_options(keySize) {
        const client_certificate_pem_file = path.join(sampleCertificateFolder, "client_cert_" + keySize + ".pem");
        const client_certificate_privatekey_file = path.join(sampleCertificateFolder, "client_key_" + keySize + ".pem");

        fs.existsSync(client_certificate_pem_file).should.eql(true, client_certificate_pem_file + " must exist");
        fs.existsSync(client_certificate_privatekey_file).should.eql(true, client_certificate_privatekey_file + " must exist");

        const options = {
            certificateFile: client_certificate_pem_file,
            privateKeyFile: client_certificate_privatekey_file
        };
        return options;
    }

    const options_2048 = build_options(2048);
    const options_3072 = build_options(3072);
    const options_4096 = build_options(4096);

    perform_collection_of_test_with_client_configuration(prefix + "(3072 bits certificate on client)", options_3072);
    perform_collection_of_test_with_client_configuration(prefix + "(4096 bits certificate on client)", options_4096);
    perform_collection_of_test_with_client_configuration(prefix + "(2048 bits certificate on client)", options_2048);
    perform_collection_of_test_with_client_configuration(prefix + "(1024 bits certificate on client)", null);
}

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("ZZB- testing Secure Client-Server communication", function () {
    this.timeout(Math.max(this.timeout(), 20001));

    let serverHandle;

    before(async () => {
        serverHandle = await start_server({});
    });
    after(async () => {
        await stop_server(serverHandle);
        serverHandle = null;
    });

    it("QQQ1 a client shall be able to establish a SIGNED connection with a server", async () => {
        should.exist(serverCertificate);
        server.currentChannelCount.should.equal(0);
        const options = {
            securityMode: MessageSecurityMode.Sign,
            securityPolicy: SecurityPolicy.Basic128Rsa15,
            serverCertificate: serverCertificate,
            connectionStrategy: no_reconnect_connectivity_strategy,

            clientCertificateManager: await getClientCertificateManager()
        };
        const client = OPCUAClient.create(options);
        await trustClientCertificateOnServer(client);

        await client.withSessionAsync(endpointUrl, async (session) => {
            /** */
        });
    });

    it("QQQ2 a client shall be able to establish a SIGN&ENCRYPT connection with a server and a 1024 bit client certificate", async () => {
        should.exist(serverCertificate);

        const options = {
            certificateFile: path.join(sampleCertificateFolder, "client_selfsigned_cert_1024.pem"),
            privateKeyFile: path.join(sampleCertificateFolder, "client_key_1024.pem"),

            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic128Rsa15,
            serverCertificate: serverCertificate,
            connectionStrategy: no_reconnect_connectivity_strategy,

            clientCertificateManager: await getClientCertificateManager()
        };
        const client = OPCUAClient.create(options);

        await trustClientCertificateOnServer(client);

        await client.withSessionAsync(endpointUrl, async (session) => {
            /** */
        });
    });

    it("QQQ3 a client shall be able to establish a SIGN&ENCRYPT connection with a server and a 2048 bit client certificate", async () => {
        should.exist(serverCertificate);

        const options = {
            certificateFile: path.join(sampleCertificateFolder, "client_selfsigned_cert_2048.pem"),
            privateKeyFile: path.join(sampleCertificateFolder, "client_key_2048.pem"),

            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic128Rsa15,
            serverCertificate: serverCertificate,

            connectionStrategy: no_reconnect_connectivity_strategy,

            certificateManager: await getClientCertificateManager()
        };
        const client = OPCUAClient.create(options);
        await trustClientCertificateOnServer(client);
        await client.withSessionAsync(endpointUrl, async (session) => {
            /** */
        });
    });
    it("QQQ3b a client shall be able to establish a SIGN&ENCRYPT connection with a server and a 2048 bit client certificate", async () => {
        should.exist(serverCertificate);

        const options = {
            certificateFile: path.join(sampleCertificateFolder, "client_selfsigned_cert_2048.pem"),
            privateKeyFile: path.join(sampleCertificateFolder, "client_key_2048.pem"),

            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256,
            serverCertificate: serverCertificate,

            connectionStrategy: no_reconnect_connectivity_strategy,

            clientCertificateManager: await getClientCertificateManager()
        };
        const client = OPCUAClient.create(options);
        await trustClientCertificateOnServer(client);
        await client.withSessionAsync(endpointUrl, async (session) => {
            /** */
        });
    });

    it("QQQ4 server shall reject secure connection when client provides a nonce with the wrong length", async () => {
        should.exist(serverCertificate);

        const options = {
            certificateFile: path.join(sampleCertificateFolder, "client_selfsigned_cert_2048.pem"),
            privateKeyFile: path.join(sampleCertificateFolder, "client_key_2048.pem"),

            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic128Rsa15,
            serverCertificate: serverCertificate,

            connectionStrategy: no_reconnect_connectivity_strategy,

            clientCertificateManager: await getClientCertificateManager()
        };
        const client = OPCUAClient.create(options);
        await trustClientCertificateOnServer(client);

        const prototype =  ClientSecureChannelLayer.prototype as any;
        const old_performMessageTransaction = prototype._performMessageTransaction;
        prototype._performMessageTransaction = function (msgType, requestMessage, callback) {
            // let's alter the client Nonce,
            if (requestMessage.constructor.name === "OpenSecureChannelRequest") {
                requestMessage.clientNonce.length.should.eql(16);
                this.clientNonce = requestMessage.clientNonce = randomBytes(32);
                prototype._performMessageTransaction = old_performMessageTransaction;
            }
            old_performMessageTransaction.call(this, msgType, requestMessage, callback);
        };

        let _err;
        try {
            await client.withSessionAsync(endpointUrl, async (session: ClientSession) => {
                session; /** */
            });
        } catch (err) {
            _err = err;
            debugLog(err.message);
            prototype._performMessageTransaction = old_performMessageTransaction;
        }
        prototype._performMessageTransaction.should.eql(old_performMessageTransaction);
        _err.message.should.match(/BadSecurityModeRejected/);
    });

    it("QQQ5 a token shall be updated on a regular basis", async () => {
        const options = {
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic128Rsa15,
            serverCertificate,
            defaultSecureTokenLifetime: g_defaultSecureTokenLifetime,
            tokenRenewalInterval: g_tokenRenewalInterval,
            connectionStrategy: no_reconnect_connectivity_strategy,
            clientCertificateManager: await getClientCertificateManager()
        };

        let token_change = 0;
        const client = OPCUAClient.create(options);
        client.on("lifetime_75", function (token) {
            debugLog("received lifetime_75", token.toString());
        });

        client.on("security_token_renewed", function () {
            token_change += 1;
            debugLog("security_token_renewed");
        });

        await trustClientCertificateOnServer(client);

        await client.withSessionAsync(endpointUrl, async (session) => {
            await keep_monitoring_some_variable(client, session, g_numberOfTokenRenewal + 3);
        });
        token_change.should.be.aboveOrEqual(g_numberOfTokenRenewal);
    });
});

describe("ZZB- testing server behavior on secure connection ", function () {
    this.timeout(Math.max(this.timeout(), 20002));

    let serverHandle;
    let old_method;
    let timerId = null;
    before(async () => {

        const prototype =  ClientSecureChannelLayer.prototype as any
        prototype._renew_security_token.should.be.instanceOf(Function);
        // let modify the client behavior so that _renew_security_token call is delayed by an amount of time
        // that should cause the server to worry about the token not to be renewed.
        old_method = prototype._renew_security_token;

        prototype._renew_security_token = function () {
            if (timerId) {
                return;
            }
            // eslint-disable-next-line @typescript-eslint/no-this-alias
            const self = this;

            // delay renewal of security token by a long time (exceeding secureTokenLifeTime)
            timerId = setTimeout(function () {
                timerId = null;
                old_method.call(self);
            }, g_defaultSecureTokenLifetime * 4);
        };

        serverHandle = await start_server({});
    });
    after(async () => {
        //Xx should(timerId).eql(null);
        if (timerId) {
            clearTimeout(timerId);
            timerId = null;
        }

        // restoring _renew_security_token
        const prototype =  ClientSecureChannelLayer.prototype as any
        prototype._renew_security_token = old_method;
        debugLog(" Disconnecting server");

        await stop_server(serverHandle);
    });

    it("ZZB-1 server shall shutdown the connection if client doesn't renew security token on time", async () => {
        const options = {
            keepSessionAlive: true,
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic128Rsa15,
            serverCertificate: serverCertificate,
            defaultSecureTokenLifetime: 2000,
            tokenRenewalInterval: 30000,
            connectionStrategy: no_reconnect_connectivity_strategy,
            clientCertificateManager: await getClientCertificateManager()
        };

        let token_change = 0;
        const client = OPCUAClient.create(options);
        client.on("lifetime_75", function (token) {
            debugLog("received lifetime_75", token.toString());
        });
        client.on("security_token_renewed", function () {
            token_change += 1;
            debugLog("security_token_renewed");
        });

        client.once("close", function (err) {
            token_change.should.be.eql(0);
        });

        await trustClientCertificateOnServer(client);

        await client.withSessionAsync(endpointUrl, async (session) => {
            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    // security token has now expired
                    // this request will fail as we haven't renewed the securityToken
                    // Server will close the connection when receiving this request
                    session.read([], () => {
                        /** */
                        resolve();
                    });
                }, 5000);
            });
        });
    });
});

describe("ZZC- testing Security Policy with a valid 1024 bit certificate on server", function () {
    this.timeout(Math.max(this.timeout(), 20003));

    let serverHandle;
    before(async () => {
        serverHandle = await start_server_with_1024bits_certificate();
    });

    after(async () => {
        await stop_server(serverHandle);
    });

    perform_collection_of_test_with_various_client_configuration(" (1024 bits certificate on server)");

    it("connection should fail if security mode requested by client is not supported by server", async () => {
        const securityMode = "Sign";
        const securityPolicy = "Basic192Rsa15"; // !!! Our Server doesn't implement Basic192Rsa15 !!!
        await check_open_secure_channel_fails(securityPolicy, securityMode, null);
    });
});

describe("ZZD- testing Security Policy with a valid 2048 bit certificate on server", function () {
    this.timeout(Math.max(this.timeout(), 20004));

    let serverHandle;
    before(async () => {
        serverHandle = await start_server_with_2048bits_certificate();
    });

    after(async () => {
        await stop_server(serverHandle);
    });

    perform_collection_of_test_with_various_client_configuration(" (2048 bits certificate on server)");

    it("connection should fail if security mode requested by client is not supported by server", async () => {
        const securityMode = "Sign";
        const securityPolicy = "Basic192Rsa15"; // !!! Our Server doesn't implement Basic192Rsa15 !!!
        await check_open_secure_channel_fails(securityPolicy, securityMode, null);
    });
});

describe("ZZD2- testing Security Policy with a valid 4096 bit certificate on server", function () {
    this.timeout(Math.max(this.timeout(), 20004));

    let serverHandle;
    before(async () => {
        serverHandle = await start_server_with_4096bits_certificate();
    });
    after(async () => {
        await stop_server(serverHandle);
    });

    perform_collection_of_test_with_various_client_configuration(" (4096 bits certificate on server)");

    it("connection should fail if security mode requested by client is not supported by server", async () => {
        const securityMode = "Sign";
        const securityPolicy = "Basic192Rsa15"; // !!! Our Server doesn't implement Basic192Rsa15 !!!
        await check_open_secure_channel_fails(securityPolicy, securityMode, null);
    });
});

describe("ZZE- testing with various client certificates", function () {
    this.timeout(Math.max(this.timeout(), 20005));

    let serverHandle;

    before(async () => {
        serverHandle = await start_server_with_1024bits_certificate();
    });
    after(async () => {
        await stop_server(serverHandle);
    });

    const client_privatekey_file = path.join(sampleCertificateFolder, "client_key_2048.pem");

    const client_certificate_ok = path.join(sampleCertificateFolder, "client_cert_2048.pem");
    const client_certificate_out_of_date = path.join(sampleCertificateFolder, "client_cert_2048_outofdate.pem");
    const client_certificate_not_active_yet = path.join(sampleCertificateFolder, "client_cert_2048_not_active_yet.pem");
    const client_certificate_revoked = path.join(sampleCertificateFolder, "client_cert_2048_revoked.pem");

    it("Server should allow a client with a valid certificate to connect", async () => {
        const options = {
            certificateFile: client_certificate_ok,
            privateKeyFile: client_privatekey_file
        };
        await common_test("Basic128Rsa15", "SignAndEncrypt", options);
    });

    xit("Server should not allow a client with a out of date certificate to connect", async () => {
        const options = {
            certificateFile: client_certificate_out_of_date,
            privateKeyFile: client_privatekey_file
        };
        await check_open_secure_channel_fails("Basic128Rsa15", "SignAndEncrypt", options);
    });

    xit("Server should not allow a client to connect when the certificate is not active yet", async () => {
        const options = {
            certificateFile: client_certificate_not_active_yet,
            privateKeyFile: client_privatekey_file
        };
        await check_open_secure_channel_fails("Basic128Rsa15", "SignAndEncrypt", options);
    });

    it("REVOKED-CERTIFICATE Server should not allow a client to connect with a revoked certificate", async () => {
        const options = {
            certificateFile: client_certificate_revoked,
            privateKeyFile: client_privatekey_file
        };
        await check_open_secure_channel_fails("Basic128Rsa15", "SignAndEncrypt", options);
    });
});
