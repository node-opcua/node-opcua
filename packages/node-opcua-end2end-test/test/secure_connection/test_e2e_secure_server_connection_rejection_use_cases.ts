import "should";
import should from "should";
import { randomBytes } from "crypto";
import sinon from "sinon";
import {
    OPCUAServer,
    OPCUAClientBase,
    OPCUAClient,
    StatusCodes,
    MessageSecurityMode,
    SecurityPolicy,
    CreateSessionRequest,
    get_empty_nodeset_filename
} from "node-opcua";
import { SignatureData } from "node-opcua-service-secure-channel";

const doDebug = false;
const port = 2237;
const empty_nodeset_filename = get_empty_nodeset_filename();

import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

describe("testing the server ability to deny client session request (server with maxSessions = 1)", () => {
    let server: OPCUAServer; let endpointUrl: string; let clientOptions: any;

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
        const client = OPCUAClient.create(clientOptions) as any;
        const old_compute = client.computeClientSignature;
        client.computeClientSignature = function (...args: any[]) {
            const res = old_compute.apply(this, args);
            res.algorithm = "<bad algorithm>";
           //  return res;
        };
        const err = await test_connection(client);
        (err as Error).message.should.match(/BadApplicationSignatureInvalid/);
    });

    it("C-Server shall reject secure client connection if ActiveSession.clientSignature is missing", async () => {
        const client = OPCUAClient.create(clientOptions) as any;
        const stub = sinon.stub();
        stub.returns(null);
        client.computeClientSignature = stub;
        const err = await test_connection(client);
        stub.callCount.should.eql(1);
        (err as Error).message.should.match(/BadApplicationSignatureInvalid/);
    });

    it("D-Server shall reject secure client connection if ActiveSession.clientSignature is tampered", async () => {
        const client = OPCUAClient.create(clientOptions) as any;
        const old_compute = client.computeClientSignature;
        client.computeClientSignature = function (...args: any[]) {
            const res = old_compute.apply(this, args);
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
        (server as any).makeServerNonce = function () {
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
        (client as any).endpointMustExist = true;
        await client.connect(endpointUrl);
        try {
            const createSessionRequest = new CreateSessionRequest({ requestHeader: {}, clientNonce: Buffer.alloc(31) });
            const result: any = await new Promise((resolve) => {
                (client as any).performMessageTransaction(createSessionRequest, (err: Error, response: any) => {
                    if (err) return resolve({ err });
                    resolve({ response });
                });
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
            serverCertificate: null as any,
            defaultSecureTokenLifetime: 2000
        });
        try {
            should(client.serverCertificate).eql(null);
            (client as any).endpointMustExist = true;
            await client.connect(endpointUrl);
            should.exist(client.serverCertificate);
        } finally {
            await client.disconnect();
        }
    });
});
