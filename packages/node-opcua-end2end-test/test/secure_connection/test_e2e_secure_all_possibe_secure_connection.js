"use strict";

// http://opcfoundation.org/UA/SecurityPolicy#Basic256
Error.stackTraceLimit = Infinity;

const chalk = require("chalk");
const should = require("should");
const sinon = require("sinon");
const path = require("path");
const fs = require("fs");
const { callbackify } = require("util");
const { randomBytes } = require("crypto");

const {
    ClientSubscription,
    coerceMessageSecurityMode,
    MessageSecurityMode,
    SecurityPolicy,
    coerceSecurityPolicy,
    OPCUACertificateManager,
    OPCUAClient,
    ClientSecureChannelLayer,
    getDefaultCertificateManager
} = require("node-opcua");
const {
    CertificateAuthority
} = require("node-opcua-pki");
const { readCertificateRevocationList, readCertificate } = require("node-opcua-crypto");


const { make_debugLog, checkDebugFlag } = require("node-opcua-debug");
const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

const certificateFolder = path.join(__dirname, "../../../node-opcua-samples/certificates");
fs.existsSync(certificateFolder).should.eql(true, "expecting certificate store at " + certificateFolder);

const port = 2236;

const { build_server_with_temperature_device } = require("../../test_helpers/build_server_with_temperature_device");
const { perform_operation_on_client_session } = require("../../test_helpers/perform_operation_on_client_session");

const {
    start_simple_server,
    stop_simple_server
} = require("../../test_helpers/external_server_fixture");

const g_defaultSecureTokenLifetime = 30 * 1000; // ms
const g_tokenRenewalInterval = 200; // renew token as fast as possible
const g_numberOfTokenRenewal = 2;

let server, endpointUrl, serverCertificate, temperatureVariableId;

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
async function makeServerCertificateManager() {

    const certificateManager = new OPCUACertificateManager({
        automaticallyAcceptUnknownCertificate: true,
        rootFolder: path.join(_tmpFolder, "serverPKI-all-possible_secure_connection")
    });
    await certificateManager.initialize();

    const issuerCertificateFile = path.join(certificateFolder, "CA/public/cacert.pem");
    const issuerCertificateRevocationListFile = path.join(certificateFolder, "CA/crl/revocation_list.der");

    const issuerCertificate = await readCertificate(issuerCertificateFile);

    const issuerCrl = await readCertificateRevocationList(issuerCertificateRevocationListFile);
    await certificateManager.addIssuer(issuerCertificate);
    await certificateManager.addRevocationList(issuerCrl);

    return certificateManager;
}

function start_inner_server_local(options, callback) {
    // Given a server that have a signed end point

    callbackify(makeServerCertificateManager)((err, certificateManager) => {
        if (err) {
            return callback(err);
        }
        options = options || {};
        options.port = options.port || port;

        options.certificateManager = options.certificateManager || certificateManager;
        server = build_server_with_temperature_device(options, function (err) {
            if (err) {
                return callback(err);
            }
            const data = {};
            data.endpointUrl = server.getEndpointUrl();
            data.serverCertificate = server.endpoints[0].endpointDescriptions()[0].serverCertificate;
            data.temperatureVariableId = server.temperatureVariableId;
            data.server = server;
            callback(null, data);
        });
    });
}

function stop_inner_server_local(data, callback) {
    try {
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
            server.shutdown(callback);
        } else {
            callback();
        }
    } catch (err) {
        callback(err);
    }
}


function start_server1(options, callback) {
    // Given a server that have a signed end point
    start_simple_server(options, function (err, data) {
        if (err) {
            return callback(err, null);
        }
        endpointUrl = data.endpointUrl;
        serverCertificate = data.serverCertificate;
        temperatureVariableId = "ns=1;i=1";
        callback(null, data);
    });
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

function stop_server1(data, callback) {
    stop_simple_server(data, callback);
}

function trustCertificateOnServer(certificateFile, callback) {
    if (!certificateFile) { setImmediate(callback); return; }
    fs.existsSync(certificateFile).should.eql(true, " certificateFile must exist " + certificateFile);
    const certificate = readCertificate(certificateFile);
    server.serverCertificateManager.trustCertificate(certificate, callback);
}

async function trustCertificateOnClient() {

    try {

        const location =  path.join(certificateFolder, "CA");
        fs.existsSync(location).should.eql(true);
        const tmpCA = new CertificateAuthority({
            keySize: 2048,
            location
        });
        fs.existsSync(tmpCA.caCertificate).should.eql(true, " caCertificate must exist " + tmpCA.caCertificate);
        fs.existsSync(tmpCA.revocationListDER).should.eql(true, " CAcrl must exist " + tmpCA.revocationListDER);

        const caCertificate = readCertificate(tmpCA.caCertificate);
        const CAcrl = readCertificateRevocationList(tmpCA.revocationListDER);
 
        const defaultClientCerfificateManager = await getDefaultCertificateManager("PKI");
        await defaultClientCerfificateManager.initialize();

        await defaultClientCerfificateManager.trustCertificate(caCertificate);
        await defaultClientCerfificateManager.addIssuer(caCertificate);
        await defaultClientCerfificateManager.addRevocationList(CAcrl);
    } catch (err) {
        console.log(err);
    }

}
function start_server(options, callback) {
    if (typeof options === "function" && !callback) {
        callback = options;
        options = null;
    }
    // Given a server that have a signed end point
    start_inner_server_local(options, function (err, data) {
        if (err) {
            return callback(err, null);
        }
        endpointUrl = data.endpointUrl;
        serverCertificate = data.serverCertificate;
        temperatureVariableId = data.temperatureVariableId;

        trustCertificateOnClient().then(() => {
            callback(null, data);
        });

    });
}

const start_server_with_1024bits_certificate = function (callback) {

    const server_certificate_pem_file = path.join(certificateFolder, "server_cert_1024.pem");
    const server_certificate_privatekey_file = path.join(certificateFolder, "server_key_1024.pem");

    fs.existsSync(server_certificate_pem_file).should.eql(true);
    fs.existsSync(server_certificate_privatekey_file).should.eql(true);
    const options = {
        certificateFile: server_certificate_pem_file,
        privateKeyFile: server_certificate_privatekey_file
    };
    start_server(options, callback);
};

const start_server_with_2048bits_certificate = function (callback) {

    const server_certificate_pem_file = path.join(certificateFolder, "server_cert_2048.pem");
    const server_certificate_privatekey_file = path.join(certificateFolder, "server_key_2048.pem");

    fs.existsSync(server_certificate_pem_file).should.eql(true);
    fs.existsSync(server_certificate_privatekey_file).should.eql(true);

    const options = {
        certificateFile: server_certificate_pem_file,
        privateKeyFile: server_certificate_privatekey_file
    };
    start_server(options, callback);
};

const start_server_with_4096bits_certificate = function (callback) {

    const server_certificate_pem_file = path.join(certificateFolder, "server_cert_4096.pem");
    const server_certificate_privatekey_file = path.join(certificateFolder, "server_key_4096.pem");

    fs.existsSync(server_certificate_pem_file).should.eql(true);
    fs.existsSync(server_certificate_privatekey_file).should.eql(true);

    const options = {
        certificateFile: server_certificate_pem_file,
        privateKeyFile: server_certificate_privatekey_file
    };
    start_server(options, callback);
};


function stop_server(data, callback) {

    stop_inner_server_local(data, callback);
    temperatureVariableId = null;
    endpointUrl = null;
    serverCertificate = null;


}

//xx start_server=start_server1;
//xx stop_server=stop_server1;



function keep_monitoring_some_variable(client, session, security_token_renewed_limit, done) {


    let security_token_renewed_counter = 0;
    const nbTokenId_before_server_side = get_server_channel_security_token_change_count(server);


    client.on("security_token_renewed", function () {

        debugLog(" Security token has been renewed");

        security_token_renewed_counter += 1;
        if (security_token_renewed_counter === security_token_renewed_limit) {

            setImmediate(function () {
                subscription.terminate(function () {
                    debugLog("        subscription terminated ");
                    if (!the_error) {
                        const nbTokenId = get_server_channel_security_token_change_count(server) - nbTokenId_before_server_side;
                        nbTokenId.should.be.aboveOrEqual(security_token_renewed_limit - 1);
                    }
                    done(the_error);
                });
            });

        }
    });
    const subscription = ClientSubscription.create(session, {
        requestedPublishingInterval: 100,
        requestedLifetimeCount: 100,
        requestedMaxKeepAliveCount: 3,
        maxNotificationsPerPublish: 3,
        publishingEnabled: true,
        priority: 6
    });

    let the_error = null;
    subscription.on("started", function () {
        debugLog("xxx    starting monitoring ");
    });

    subscription.on("internal_error", function (err) {
        debugLog(chalk.red("xxx internal error in ClientSubscription"), err.message);
        the_error = err;
    });
    subscription.on("terminated", function () {
    });
    subscription.on("keepalive", function () {
        debugLog(chalk.red("keep alive"));
        //        console.log(".")
    });
}


function common_test(securityPolicy, securityMode, options, done) {

    if (global.gc) {
        global.gc(true);
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
        requestedSessionTimeout: 120 * 60 * 1000
    };

    options.defaultSecureTokenLifetime = options.defaultSecureTokenLifetime || g_defaultSecureTokenLifetime;
    // make sure that securityToken renewal will happen very soon,
    options.tokenRenewalInterval = g_tokenRenewalInterval;

    //xx debugLog("xxxx options.defaultSecureTokenLifetime",options.defaultSecureTokenLifetime);

    let token_change = 0;
    const client = OPCUAClient.create(options);

    trustCertificateOnServer(client.certificateFile, () => {

        perform_operation_on_client_session(client, endpointUrl, (session, inner_done) => {
            keep_monitoring_some_variable(client, session, g_numberOfTokenRenewal, (err) => {
                token_change.should.be.aboveOrEqual(2);
                inner_done(err);
            });
        }, done);
    });


    client.on("lifetime_75", function (token) {
        // check if we are late!
        //
        const expectedExpiryTick = token.createdAt.getTime() + token.revisedLifetime;
        const delay = (expectedExpiryTick - Date.now());
        if (delay <= 100) {
            debugLog(chalk.red("WARNING : token renewal is happening too late !!"), delay);
        }
        debugLog("received lifetime_75", JSON.stringify(token), delay);
    });
    client.on("security_token_renewed", function () {
        token_change += 1;
        debugLog("received security_token_renewed", token_change);
    });
    client.on("close", function () {
        debugLog(" connection has been closed");
    });
}

function check_open_secure_channel_fails(securityPolicy, securityMode, options, done) {

    options = options || {};
    options = {
        ...options,
        securityMode: coerceMessageSecurityMode(securityMode),
        securityPolicy: coerceSecurityPolicy(securityPolicy),
        serverCertificate,
        connectionStrategy: no_reconnect_connectivity_strategy
    };
    const client = OPCUAClient.create(options);
    client.on("backoff", function (number, delay) {
        debugLog(" backoff attempt#", number, " retry in ", delay);
    });

    trustCertificateOnServer(client.clientCertificate, () => {

        client.connect(endpointUrl, (err) => {

            if (err) {

                /* err is expected here */

                debugLog("Error = ", err.message);
                client.disconnect(function () {
                    // xx console.log((new Date()).toUTCString());
                    // xx dumpCertificate(client.certificateFile,(err,data) => { console.log(data)});
                    done();
                });

            } else {
                client.disconnect(function () {
                    const o = { ...options };
                    o.serverCertificate = null;
                    console.log("options", o);
                    console.log(endpointUrl);
                    console.log((new Date()).toUTCString());
                    dumpCertificate(client.certificateFile, (err, data) => { console.log(data) });
                    // give a other chance to explore what is going on by setting a break point here 
                    client.connect(endpointUrl, function (errX) {
                        console.log(errX);

                        done(new Error("The connection's succeeded, but was expected to fail!"));
                    });
                });
            }
        });
    });
}

function common_test_expected_server_initiated_disconnection(securityPolicy, securityMode, done) {


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

        connectionStrategy: fail_fast_connectivity_strategy
    };

    let token_change = 0;
    const client = OPCUAClient.create(options);

    trustCertificateOnServer(client.clientCertificate, () => {

        const after_reconnection_spy = new sinon.spy();
        const start_reconnection_spy = new sinon.spy();

        perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

            client.on("start_reconnection", start_reconnection_spy);
            client.on("after_reconnection", after_reconnection_spy);

            keep_monitoring_some_variable(client, session, g_numberOfTokenRenewal, function (err) {
                debugLog("err = ", err);
                // inner_done(err);
            });
            client.on("close", function () {
                debugLog("            connection has been closed");
                inner_done();
            });

        }, function (err) {

            debugLog(chalk.yellow.bold(" RECEIVED ERROR :"), err);
            start_reconnection_spy.callCount.should.eql(1);
            //xx after_reconnection_spy.callCount.should.eql(1);
            should(err).be.instanceOf(Error);

            done();
        });
    });
    client.on("backoff", function (number, delay) {
        debugLog(chalk.bgWhite.yellow("backoff  attempt #"), number, " retrying in ", delay / 1000.0, " seconds");
    });
    client.on("lifetime_75", function (token) {
        debugLog("            received lifetime_75", JSON.stringify(token));
    });
    client.on("security_token_renewed", function () {
        token_change += 1;
    });
    client.on("close", function () {
        debugLog("            connection has been closed");
    });
}

function perform_collection_of_test_with_client_configuration(message, options) {

    it("should succeed with Basic128Rsa15  with Sign           " + message, function (done) {
        common_test("Basic128Rsa15", "Sign", options, done);
    });

    it("should succeed with Basic128Rsa15  with Sign           " + message, function (done) {
        common_test("Basic128Rsa15", "Sign", options, done);
    });

    it("should succeed with Basic128Rsa15  with SignAndEncrypt " + message, function (done) {
        common_test("Basic128Rsa15", "SignAndEncrypt", options, done);
    });

    it("should succeed with Basic256       with Sign           " + message, function (done) {
        common_test("Basic256", "Sign", options, done);
    });

    it("should succeed with Basic256       with SignAndEncrypt " + message, function (done) {
        common_test("Basic256", "SignAndEncrypt", options, done);
    });

    it("should fail    with Basic256Rsa15  with Sign           " + message, function (done) {
        check_open_secure_channel_fails("Basic256Rsa15", "Sign", options, done);
    });

    it("should fail    with Basic256Rsa15  with SignAndEncrypt " + message, function (done) {
        check_open_secure_channel_fails("Basic256Rsa15", "SignAndEncrypt", options, done);
    });

    it("should succeed with Basic256Sha256 with Sign           " + message, function (done) {
        common_test("Basic256Sha256", "Sign", options, done);
    });

    it("should succeed with Basic256Sha256 with SignAndEncrypt " + message, function (done) {
        common_test("Basic256Sha256", "SignAndEncrypt", options, done);
    });

}

function perform_collection_of_test_with_various_client_configuration(prefix) {

    prefix = prefix || "";

    function build_options(keySize) {
        const client_certificate_pem_file = path.join(certificateFolder, "client_cert_" + keySize + ".pem");
        const client_certificate_privatekey_file = path.join(certificateFolder, "client_key_" + keySize + ".pem");
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


const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
const { dumpCertificate } = require("node-opcua-pki");
const { colorConsole } = require("tracer");
describe("ZZB- testing Secure Client-Server communication", function () {

    this.timeout(Math.max(this.timeout(), 20001));

    let serverHandle;


    before(function (done) {
        start_server(function (err, handle) {
            serverHandle = handle;
            done(err);
        });
    });
    after(function (done) {
        stop_server(serverHandle, function () {
            serverHandle = null;
            done();
        });
    });

    it("QQQ1 a client shall be able to establish a SIGNED connection with a server", function (done) {


        should.exist(serverCertificate);
        server.currentChannelCount.should.equal(0);
        const options = {
            securityMode: MessageSecurityMode.Sign,
            securityPolicy: SecurityPolicy.Basic128Rsa15,
            serverCertificate: serverCertificate,
            connectionStrategy: no_reconnect_connectivity_strategy

        };
        const client = OPCUAClient.create(options);
        trustCertificateOnServer(client.clientCertificate, () => {

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                inner_done();
            }, done);
        });

    });

    it("QQQ2 a client shall be able to establish a SIGN&ENCRYPT connection with a server and a 1024 bit client certificate", function (done) {

        should.exist(serverCertificate);

        const options = {

            certificateFile: path.join(certificateFolder, "client_selfsigned_cert_1024.pem"),
            privateKeyFile: path.join(certificateFolder, "client_key_1024.pem"),

            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic128Rsa15,
            serverCertificate: serverCertificate,
            connectionStrategy: no_reconnect_connectivity_strategy

        };
        const client = OPCUAClient.create(options);

        trustCertificateOnServer(client.certificateFile, () => {

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {
                inner_done();
            }, done);

        })

    });

    it("QQQ3 a client shall be able to establish a SIGN&ENCRYPT connection with a server and a 2048 bit client certificate", function (done) {

        should.exist(serverCertificate);

        const options = {

            certificateFile: path.join(certificateFolder, "client_selfsigned_cert_2048.pem"),
            privateKeyFile: path.join(certificateFolder, "client_key_2048.pem"),

            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic128Rsa15,
            serverCertificate: serverCertificate,

            connectionStrategy: no_reconnect_connectivity_strategy

        };
        const client = OPCUAClient.create(options);
        trustCertificateOnServer(client.certificateFile, () => {
            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {
                inner_done();
            }, done);
        });

    });
    it("QQQ3b a client shall be able to establish a SIGN&ENCRYPT connection with a server and a 2048 bit client certificate", function (done) {

        should.exist(serverCertificate);

        const options = {

            certificateFile: path.join(certificateFolder, "client_selfsigned_cert_2048.pem"),
            privateKeyFile: path.join(certificateFolder, "client_key_2048.pem"),

            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256,
            serverCertificate: serverCertificate,

            connectionStrategy: no_reconnect_connectivity_strategy

        };
        const client = OPCUAClient.create(options);
        trustCertificateOnServer(client.certificateFile, () => {
            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {
                inner_done();
            }, done);
        });
    });

    it("QQQ4 server shall reject secure connection when client provides a nonce with the wrong length", function (done) {

        should.exist(serverCertificate);

        const options = {
            certificateFile: path.join(certificateFolder, "client_selfsigned_cert_2048.pem"),
            privateKeyFile: path.join(certificateFolder, "client_key_2048.pem"),

            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic128Rsa15,
            serverCertificate: serverCertificate,

            connectionStrategy: no_reconnect_connectivity_strategy

        };
        const client = OPCUAClient.create(options);
        trustCertificateOnServer(client.certificateFile, () => {

            const old_performMessageTransaction = ClientSecureChannelLayer.prototype._performMessageTransaction;
            ClientSecureChannelLayer.prototype._performMessageTransaction = function (msgType, requestMessage, callback) {

                // let's alter the client Nonce,
                if (requestMessage.constructor.name === "OpenSecureChannelRequest") {
                    requestMessage.clientNonce.length.should.eql(16);
                    this.clientNonce = requestMessage.clientNonce = randomBytes(32);
                    ClientSecureChannelLayer.prototype._performMessageTransaction = old_performMessageTransaction;
                }
                old_performMessageTransaction.call(this, msgType, requestMessage, callback);
            };

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {
                inner_done();
            }, function (err) {
                debugLog(err.message);
                err.message.should.match(/BadSecurityModeRejected/);
                ClientSecureChannelLayer.prototype._performMessageTransaction.should.eql(old_performMessageTransaction);
                done();
            });
        });
    });

    it("QQQ5 a token shall be updated on a regular basis", function (done) {

        const options = {
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic128Rsa15,
            serverCertificate: serverCertificate,
            defaultSecureTokenLifetime: g_defaultSecureTokenLifetime,
            tokenRenewalInterval: g_tokenRenewalInterval,
            connectionStrategy: no_reconnect_connectivity_strategy
        };

        let token_change = 0;
        const client = OPCUAClient.create(options);

        trustCertificateOnServer(client.certificateFile, () => {

            client.on("lifetime_75", function (token) {
                debugLog("received lifetime_75", JSON.stringify(token));
            });

            client.on("security_token_renewed", function () {
                token_change += 1;
                //xx  debugLog("security_token_renewed");
            });
            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                keep_monitoring_some_variable(client, session, g_numberOfTokenRenewal + 3, function (err) {
                    //xx debugLog("end of Monitoring ")
                    token_change.should.be.aboveOrEqual(g_numberOfTokenRenewal);
                    inner_done(err);
                });
            }, done);
        });

    });
});

describe("ZZB- testing server behavior on secure connection ", function () {

    this.timeout(Math.max(this.timeout(), 20002));

    let serverHandle;
    let old_method;
    let timerId = null;
    before(function (done) {

        ClientSecureChannelLayer.prototype._renew_security_token.should.be.instanceOf(Function);
        // let modify the client behavior so that _renew_security_token call is delayed by an amount of time
        // that should cause the server to worry about the token not to be renewed.
        old_method = ClientSecureChannelLayer.prototype._renew_security_token;

        ClientSecureChannelLayer.prototype._renew_security_token = function () {
            if (timerId) {
                return;
            }
            const self = this;

            // delay renewal of security token by a long time (exceeding secureTokenLifeTime)
            timerId = setTimeout(function () {
                timerId = null;
                old_method.call(self);
            }, g_defaultSecureTokenLifetime * 4);
        };

        start_server(function (err, handle) {
            serverHandle = handle;
            done(err);
        });
    });
    after(function (done) {
        //Xx should(timerId).eql(null);
        if (timerId) {
            clearTimeout(timerId);
            timerId = null;
        }

        // restoring _renew_security_token
        ClientSecureChannelLayer.prototype._renew_security_token = old_method;
        debugLog(" Disconnecting server");

        stop_server(serverHandle, done);
    });

    it("ZZB-1 server shall shutdown the connection if client doesn't renew security token on time", function (done) {

        const options = {
            keepSessionAlive: true,
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic128Rsa15,
            serverCertificate: serverCertificate,
            defaultSecureTokenLifetime: 2000,
            tokenRenewalInterval: 30000,
            connectionStrategy: no_reconnect_connectivity_strategy
        };

        let token_change = 0;
        const client = OPCUAClient.create(options);
        trustCertificateOnServer(client.certificateFile, () => {

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {
                client.once("close", function (err) {
                    token_change.should.be.eql(0);
                    inner_done();
                });
                setTimeout(function () {
                    // security token has now expired
                    //
                    // this request will fail as we haven't renewed the securityToken
                    // Server will close the connection when receiving this request
                    session.read([], function () {

                    });
                }, 5000);
            }, function (err) {
                done();
            });
        });

        client.on("lifetime_75", function (token) {
            //xx debugLog("received lifetime_75", JSON.stringify(token));
        });
        client.on("security_token_renewed", function () {
            token_change += 1;
            //xx debugLog("security_token_renewed");
        });

        // common_test_expected_server_initiated_disconnection(SecurityPolicy.Basic128Rsa15, MessageSecurityMode.SIGN, done);
    });

});

describe("ZZC- testing Security Policy with a valid 1024 bit certificate on server", function () {

    this.timeout(Math.max(this.timeout(), 20003));

    let serverHandle;

    before(function (done) {
        start_server_with_1024bits_certificate(function (err, handle) {
            serverHandle = handle;
            done(err);
        });
    });
    after(function (done) {
        stop_server(serverHandle, function () {
            done();
        });
    });

    perform_collection_of_test_with_various_client_configuration(" (1024 bits certificate on server)");

    it("connection should fail if security mode requested by client is not supported by server", function (done) {

        const securityMode = "Sign";
        const securityPolicy = "Basic192Rsa15"; // !!! Our Server doesn't implement Basic192Rsa15 !!!
        check_open_secure_channel_fails(securityPolicy, securityMode, null, done);

    });
});

describe("ZZD- testing Security Policy with a valid 2048 bit certificate on server", function () {

    this.timeout(Math.max(this.timeout(), 20004));

    let serverHandle;

    before(function (done) {
        start_server_with_2048bits_certificate(function (err, handle) {
            serverHandle = handle;
            done(err);
        });
    });
    after(function (done) {
        stop_server(serverHandle, function () {
            done();
        });
    });


    perform_collection_of_test_with_various_client_configuration(" (2048 bits certificate on server)");

    it("connection should fail if security mode requested by client is not supported by server", function (done) {

        const securityMode = "Sign";
        const securityPolicy = "Basic192Rsa15"; // !!! Our Server doesn't implement Basic192Rsa15 !!!
        check_open_secure_channel_fails(securityPolicy, securityMode, null, done);

    });
});

describe("ZZD2- testing Security Policy with a valid 4096 bit certificate on server", function () {

    this.timeout(Math.max(this.timeout(), 20004));

    let serverHandle;

    before(function (done) {
        start_server_with_4096bits_certificate(function (err, handle) {
            serverHandle = handle;
            done(err);
        });
    });
    after(function (done) {
        stop_server(serverHandle, function () {
            done();
        });
    });

    perform_collection_of_test_with_various_client_configuration(" (4096 bits certificate on server)");

    it("connection should fail if security mode requested by client is not supported by server", function (done) {
        const securityMode = "Sign";
        const securityPolicy = "Basic192Rsa15"; // !!! Our Server doesn't implement Basic192Rsa15 !!!
        check_open_secure_channel_fails(securityPolicy, securityMode, null, done);
    });
});

describe("ZZE- testing with various client certificates", function () {

    this.timeout(Math.max(this.timeout(), 20005));

    let serverHandle;

    before(function (done) {
        start_server_with_1024bits_certificate(function (err, handle) {
            serverHandle = handle;
            done(err);
        });
    });
    after(function (done) {
        stop_server(serverHandle, function () {
            done();
        });
    });

    const client_privatekey_file = path.join(certificateFolder, "client_key_2048.pem");

    const client_certificate_ok = path.join(certificateFolder, "client_cert_2048.pem");
    const client_certificate_out_of_date = path.join(certificateFolder, "client_cert_2048_outofdate.pem");
    const client_certificate_not_active_yet = path.join(certificateFolder, "client_cert_2048_not_active_yet.pem");
    const client_certificate_revoked = path.join(certificateFolder, "client_cert_2048_revoked.pem");

    it("Server should allow a client with a valid certificate to connect", function (done) {

        const options = {
            certificateFile: client_certificate_ok,
            privateKeyFile: client_privatekey_file
        };
        common_test("Basic128Rsa15", "SignAndEncrypt", options, done);
    });

    xit("Server should not allow a client with a out of date certificate to connect", function (done) {

        const options = {
            certificateFile: client_certificate_out_of_date,
            privateKeyFile: client_privatekey_file
        };
        check_open_secure_channel_fails("Basic128Rsa15", "SignAndEncrypt", options, done);
    });

    xit("Server should not allow a client to connect when the certificate is not active yet", function (done) {

        const options = {
            certificateFile: client_certificate_not_active_yet,
            privateKeyFile: client_privatekey_file
        };
        check_open_secure_channel_fails("Basic128Rsa15", "SignAndEncrypt", options, done);
    });

    it("REVOKED-CERTIFICATE Server should not allow a client to connect with a revoked certificate", function (done) {
        const options = {
            certificateFile: client_certificate_revoked,
            privateKeyFile: client_privatekey_file
        };
        check_open_secure_channel_fails("Basic128Rsa15", "SignAndEncrypt", options, done);
    });


});
