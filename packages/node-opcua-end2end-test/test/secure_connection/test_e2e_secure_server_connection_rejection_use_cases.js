"use strict";

const { randomBytes } = require("crypto");
const should = require("should");
const async = require("async");
const sinon = require("sinon");

const {
    OPCUAServer,
    OPCUAClientBase,
    OPCUAClient,
    StatusCodes,
    MessageSecurityMode,
    SecurityPolicy,
    CreateSessionRequest,
    get_empty_nodeset_filename
} = require("node-opcua");

const { SignatureData } = require("node-opcua-service-secure-channel");

const doDebug = false;

const port = 2237;

const empty_nodeset_filename = get_empty_nodeset_filename();

const crypto_utils = require("node-opcua-crypto");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing the server ability to deny client session request (server with maxSessions = 1)", function () {
    let server, endpointUrl, options;

    before(async () => {
        server = new OPCUAServer({
            port,
            nodeset_filename: empty_nodeset_filename
        });

        const serverCertificate = server.getCertificateChain();

        options = {
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256,
            serverCertificate: serverCertificate,
            defaultSecureTokenLifetime: 2000
        };

        await server.start();

        OPCUAServer.registry.count().should.eql(1);
        OPCUAClientBase.registry.count().should.eql(0);

        endpointUrl = server.getEndpointUrl();
    });

    after(async () => {
        await server.shutdown();
        OPCUAServer.registry.count().should.eql(0);
    });

    async function test_connection(client) {
        // given that client1 is connected, and have a session
        try {
            await client.connect(endpointUrl);
            await client.createSession();
            return undefined;
        } catch (err) {
            return err;
        } finally {
            await client.disconnect();
        }
    }

    it("Server shall accept a secure client connection with a valid clientSignature", async () => {
        // this is the nominal case
        const client = OPCUAClient.create(options);
        const err = await test_connection(client);
        should.not.exist(err);
    });

    it("Server shall reject a secure client connection if ActiveSession.clientSignature has the wrong algorithm", async () => {
        const client = OPCUAClient.create(options);
        const old_computeClientSignature = client.computeClientSignature;
        const computeClientSignatureStub = sinon.stub();

        client.computeClientSignature = function () {
            const res = old_computeClientSignature.apply(this, arguments);
            res.algorithm = "<bad algorithm>";
        };

        const err = await test_connection(client);
        err.message.should.match(/BadApplicationSignatureInvalid/);
    });
    it("Server shall reject a secure client connection if ActiveSession.clientSignature is missing", async () => {
        const client = OPCUAClient.create(options);
        const old_computeClientSignature = client.computeClientSignature;
        const computeClientSignatureStub = sinon.stub();
        computeClientSignatureStub.returns(null);

        client.computeClientSignature = computeClientSignatureStub;

        const err = await test_connection(client);
        computeClientSignatureStub.callCount.should.eql(1);
        err.message.should.match(/BadApplicationSignatureInvalid/);
    });
    it("Server shall reject a secure client connection if ActiveSession.clientSignature is tampered", async () => {
        const client = OPCUAClient.create(options);
        const old_computeClientSignature = client.computeClientSignature;
        const computeClientSignatureStub = sinon.stub();

        client.computeClientSignature = function () {
            const res = old_computeClientSignature.apply(this, arguments);
            res.should.be.instanceOf(SignatureData);
            // alter 10th word
            res.signature.writeInt16BE(res.signature.readInt16BE(10), 10);
        };

        const err = await test_connection(client);

        err.message.should.match(/BadApplicationSignatureInvalid/);
    });

    it("Client shall deny server session if server nonce is too small", async () => {
        let bad_nonce = 0;
        server.makeServerNonce = function () {
            bad_nonce += 1;
            return randomBytes(31); //<< instead of 32  !!!
        };
        const options = {
            endpointMustExist: true
        };
        const client = OPCUAClient.create(options);
        const err = await test_connection(client);
        err.message.should.match(/Invalid server Nonce/);
        bad_nonce.should.be.greaterThan(0);
    });

    it("TA -#createSession Server shall return an error if requestHeader.clientNonce has less than 32 bytes", async () => {
        const client = OPCUAClient.create(options);

        client.endpointMustExist = true;
        await client.connect(endpointUrl);

        try {
            const createSessionRequest = new CreateSessionRequest({
                requestHeader: {},
                clientNonce: Buffer.alloc(31)
            });

            const { err, response } = await new Promise((resolve, reject) => {
                client.performMessageTransaction(createSessionRequest, (err, response) => {
                    if (err) {
                        doDebug && console.log(err);
                        resolve({ err });
                        return;
                    }
                    resolve({ response });
                });
            });
            should.exist(err);
            err.message.should.match(/BadNonceInvalid/);
            if (response) {
                response.responseHeader.serviceResult.should.eql(StatusCodes.BadNonceInvalid);
            }
        } finally {
            await client.disconnect();
        }
    });

    it("TB - a client shall be able to connect to a server using a SecureChannel without specifying the serverCertificate", async () => {
        // in this case, server certificate will be extracted from the getPoint Information
        const options = {
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256,
            serverCertificate: null, // NOT KNOWN
            defaultSecureTokenLifetime: 2000
        };
        const client = OPCUAClient.create(options);

        try {
            should(client.serverCertificate).eql(null);
            client.endpointMustExist = true;
            await client.connect(endpointUrl);

            should.exist(client.serverCertificate);
            console.log(" Client has detected that server certificate is ", client.serverCertificate.toString("base64"));
        } finally {
            await client.disconnect();
        }
    });
});
