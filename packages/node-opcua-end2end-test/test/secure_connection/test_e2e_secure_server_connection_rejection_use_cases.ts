import "should";
import {
    CreateSessionRequest,
    type CreateSessionResponse,
    get_empty_nodeset_filename,
    MessageSecurityMode,
    OPCUAClient,
    OPCUAClientBase,
    type OPCUAClientOptions,
    OPCUAServer,
    SecurityPolicy,
    StatusCodes
} from "node-opcua";
import { SignatureData } from "node-opcua-service-secure-channel";
import { randomBytes } from "node-opcua-utils";
import should from "should";
import sinon from "sinon";

const _doDebug = false;
const port = 2237;
const empty_nodeset_filename = get_empty_nodeset_filename();

import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

// biome-ignore lint/suspicious/noExplicitAny: monkey-patching private client/server implementation internals (computeClientSignature, makeServerNonce, performMessageTransaction) for fault injection
type InternalAny = any;

describe("testing the server ability to deny client session request (server with maxSessions = 1)", () => {
    let server: OPCUAServer;
    let endpointUrl: string;
    let clientOptions: OPCUAClientOptions;

    before(async () => {
        server = new OPCUAServer({ port, nodeset_filename: empty_nodeset_filename });
        const serverCertificate = server.getCertificateChain();
        clientOptions = {
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256,
            serverCertificate,
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

    async function test_connection(client: OPCUAClient): Promise<Error | undefined> {
        try {
            await client.connect(endpointUrl);
            await client.createSession();
            return undefined;
        } catch (err) {
            return err as Error;
        } finally {
            await client.disconnect();
        }
    }

    it("A-Server shall accept a secure client connection with a valid clientSignature", async () => {
        const client = OPCUAClient.create(clientOptions);
        const err = await test_connection(client);
        should.not.exist(err);
    });

    it("B-Server shall reject secure client connection if ActiveSession.clientSignature has wrong algorithm", async () => {
        const client = OPCUAClient.create(clientOptions) as InternalAny;
        const old_compute = client.computeClientSignature;
        // computeClientSignature is async (the key may be HSM/KMS-held)
        client.computeClientSignature = async function (...args: unknown[]) {
            const res = await old_compute.apply(this, args);
            res.algorithm = "<bad algorithm>";
            //  return res;
        };
        const err = await test_connection(client);
        (err as Error).message.should.match(/BadApplicationSignatureInvalid/);
    });

    it("C-Server shall reject secure client connection if ActiveSession.clientSignature is missing", async () => {
        const client = OPCUAClient.create(clientOptions) as InternalAny;
        const stub = sinon.stub();
        stub.returns(null);
        client.computeClientSignature = stub;
        const err = await test_connection(client);
        stub.callCount.should.eql(1);
        (err as Error).message.should.match(/BadApplicationSignatureInvalid/);
    });

    it("D-Server shall reject secure client connection if ActiveSession.clientSignature is tampered", async () => {
        const client = OPCUAClient.create(clientOptions) as InternalAny;
        const old_compute = client.computeClientSignature;
        // computeClientSignature is async (the key may be HSM/KMS-held)
        client.computeClientSignature = async function (...args: unknown[]) {
            const res = await old_compute.apply(this, args);
            res.should.be.instanceOf(SignatureData);
            // alter 10th word
            res.signature.writeInt16BE(res.signature.readInt16BE(10), 10);
            //  return res;
        };
        const err = await test_connection(client);
        (err as Error).message.should.match(/BadApplicationSignatureInvalid/);
    });

    it("E-Client shall deny server session if server nonce is too small", async () => {
        let bad_nonce = 0;
        (server as InternalAny).makeServerNonce = () => {
            bad_nonce += 1;
            return randomBytes(31); // instead of 32!
        };
        const client = OPCUAClient.create({ endpointMustExist: true });
        const err = await test_connection(client);
        (err as Error).message.should.match(/Invalid server Nonce/);
        bad_nonce.should.be.greaterThan(0);
    });

    it("TA - server shall return error if requestHeader.clientNonce has less than 32 bytes", async () => {
        const client = OPCUAClient.create(clientOptions);
        (client as InternalAny).endpointMustExist = true;
        await client.connect(endpointUrl);
        try {
            const createSessionRequest = new CreateSessionRequest({ requestHeader: {}, clientNonce: Buffer.alloc(31) });
            const result: { err?: Error; response?: CreateSessionResponse } = await new Promise((resolve) => {
                (client as InternalAny).performMessageTransaction(
                    createSessionRequest,
                    (err: Error, response: CreateSessionResponse) => {
                        if (err) return resolve({ err });
                        resolve({ response });
                    }
                );
            });
            should.exist(result.err);
            (result.err as Error).message.should.match(/BadNonceInvalid/);
            if (result.response) {
                result.response.responseHeader.serviceResult.should.eql(StatusCodes.BadNonceInvalid);
            }
        } finally {
            await client.disconnect();
        }
    });

    it("TB - client connects without specifying serverCertificate (fetch via GetEndpoints)", async () => {
        const client = OPCUAClient.create({
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256,
            // biome-ignore lint/suspicious/noExplicitAny: explicit null (not the same as omitting the field) forces the "not yet fetched" state; the option type only declares undefined
            serverCertificate: null as any,
            defaultSecureTokenLifetime: 2000
        });
        try {
            should(client.serverCertificate).eql(null);
            (client as InternalAny).endpointMustExist = true;
            await client.connect(endpointUrl);
            should.exist(client.serverCertificate);
        } finally {
            await client.disconnect();
        }
    });
});
