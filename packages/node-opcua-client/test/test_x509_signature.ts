// tslint:disable:no-console
// tslint:disable:only-arrow-functions
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs";
import * as should from "should";
import "mocha";
import { assert } from "node-opcua-assert";
import { decodeExpandedNodeId } from "node-opcua-basic-types";
import { BinaryStream } from "node-opcua-binary-stream";
import { Certificate, PrivateKeyPEM, readCertificate, readPrivateKeyPEM, split_der } from "node-opcua-crypto";
import { makeBufferFromTrace } from "node-opcua-debug";
import { constructObject } from "node-opcua-factory";
import {
    computeSignature,
    getCryptoFactory,
    MessageBuilder,
    MessageSecurityMode,
    SecurityPolicy,
    verifySignature
} from "node-opcua-secure-channel";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import {
    ActivateSessionRequest,
    CreateSessionResponse,
    SignatureData,
    SignatureDataOptions,
    UserIdentityToken,
    X509IdentityToken
} from "node-opcua-types";

const doDebug = false;

function readMessage(name: string): Buffer {
    const filename = path.join(__dirname, "./fixtures", name);
    const text = fs.readFileSync(filename, "ascii");
    const message = makeBufferFromTrace(text);
    return message;
}

async function decodeMessage(buffer: Buffer): Promise<any> {
    /*
    const offset = 16 * 3 + 6;
    buffer = buffer.slice(offset);
    */
    const messageBuilder = new MessageBuilder({});
    messageBuilder.setSecurity(MessageSecurityMode.None, SecurityPolicy.None);
    let objMessage: any = null;
    messageBuilder.once("full_message_body", (fullMessageBody: Buffer) => {
        const stream = new BinaryStream(fullMessageBody);
        const id = decodeExpandedNodeId(stream);
        objMessage = constructObject(id);
        objMessage.decode(stream);
    });
    messageBuilder.feed(buffer);

    return objMessage;
}

function verifyX509UserIdentity(
    serverCertificate: Certificate,
    sessionNonce: Buffer,
    securityPolicy: SecurityPolicy,
    userTokenPolicy: UserIdentityToken,
    userIdentityToken: X509IdentityToken,
    userTokenSignature: SignatureData,
    callback: (err: null, statusCode: StatusCode) => void
) {
    const cryptoFactory = getCryptoFactory(securityPolicy);
    if (!cryptoFactory) {
        return callback(null, StatusCodes.BadSecurityPolicyRejected);
    }

    if (!userTokenSignature || !userTokenSignature.signature) {
        return callback(null, StatusCodes.BadUserSignatureInvalid);
    }

    if (userIdentityToken.policyId !== userTokenPolicy.policyId) {
        console.log("invalid encryptionAlgorithm");
        console.log("userTokenPolicy", userTokenPolicy.toString());
        console.log("userTokenPolicy", userIdentityToken.toString());
        return callback(null, StatusCodes.BadSecurityPolicyRejected);
    }
    const certificate = userIdentityToken.certificateData; /* as Certificate*/

    const parts = split_der(certificate);

    const nonce = sessionNonce;
    assert(certificate instanceof Buffer, "expecting certificate to be a Buffer");
    assert(nonce instanceof Buffer, "expecting nonce to be a Buffer");
    assert(userTokenSignature.signature instanceof Buffer, "expecting userTokenSignature to be a Buffer");

    // verify proof of possession by checking certificate signature & server nonce correctness
    if (!verifySignature(serverCertificate, nonce, userTokenSignature, certificate, securityPolicy)) {
        return callback(null, StatusCodes.BadUserSignatureInvalid);
    }

    return callback(null, StatusCodes.Good);
}

const verifyX509UserIdentity1 = promisify(verifyX509UserIdentity);

function rebuildSignature(
    certificate: Certificate, // server certificate
    serverNonce: Buffer,
    privateKey: PrivateKeyPEM,
    securityPolicy: SecurityPolicy
) {
    // The signature generated with private key associated with the User Certificate
    const userTokenSignature: SignatureDataOptions = computeSignature(certificate, serverNonce, privateKey, securityPolicy)!;

    return userTokenSignature;
}

describe("X509 - Wireshark Analysis", () => {
    async function performTest(
        _messageCreateSessionResponsePacket: Buffer,
        _messageActivateSessionRequestPacket: Buffer,
        securityPolicy: SecurityPolicy
    ): Promise<void> {
        const createSessionResponse = (await decodeMessage(_messageCreateSessionResponsePacket)) as CreateSessionResponse;

        const activateSessionRequest = (await decodeMessage(_messageActivateSessionRequestPacket)) as ActivateSessionRequest;

        // Verify signature
        const serverNonce = createSessionResponse.serverNonce;
        const serverCertificate = createSessionResponse.serverCertificate;

        const userIdentityToken = activateSessionRequest.userIdentityToken as X509IdentityToken;

        // create a fake server userTokenPolicy
        const userTokenPolicy: any = {
            policyId: userIdentityToken.policyId
        };

        const userCertificate = readCertificate(path.join(__dirname, "./fixtures/user1_certificate.pem"));
        const privateKey = readPrivateKeyPEM(path.join(__dirname, "./fixtures/private_key.pem"));

        const signatureData = rebuildSignature(serverCertificate, serverNonce, privateKey, securityPolicy);

        if (doDebug) {
            console.log("policyId = ", userIdentityToken.policyId);
            console.log("serverNonce\n", createSessionResponse.serverNonce.toString("hex"));
            console.log("user certificate from file            \n", userCertificate.toString("hex"));
            console.log("user certificate from activate session\n", userIdentityToken.certificateData.toString("hex"));

            console.log("\nsignature recomputed by the test\n", signatureData.signature!.toString("hex"));
            console.log("", signatureData.algorithm);

            console.log(
                "signature generated by the client \n",
                activateSessionRequest.userTokenSignature.signature.toString("hex")
            );
            console.log("", activateSessionRequest.userTokenSignature.algorithm);
        }
        userCertificate.toString("hex").should.eql(userIdentityToken.certificateData.toString("hex"));

        const statusCode = await verifyX509UserIdentity1(
            serverCertificate,
            serverNonce,
            securityPolicy,
            userTokenPolicy,
            userIdentityToken,
            activateSessionRequest.userTokenSignature
        );
        if (doDebug) {
            console.log("statusCode = ", statusCode.toString());
        }
        statusCode.should.eql(StatusCodes.Good);
    }

    it("1-should create a valid ActiveSessionRequest with X509 ", async () => {
        // UAExpert connecting to UAExpertCPP Server
        // this capture has been made between UAExpert 1.5.0 client
        // and UACppServer
        // activateSession with X509 certificate ,
        // the connection was successful
        const messageCreateSessionResponsePacket = readMessage("createSessionResponse1.txt");
        const messageActivateSessionRequestPacket = readMessage("activateSessionRequest1.txt");
        await performTest(messageCreateSessionResponsePacket, messageActivateSessionRequestPacket, SecurityPolicy.Basic256Sha256);
    });

    it("2-should create a valid ActiveSessionRequest with X509 ", async () => {
        // this capture has been made between node-opcua@2.0.0-alpha.7 client
        // activateSession with X509 certificate on ProsysServer,
        //
        // the connection was successful and activateSessionRequest3 succeeded
        const messageCreateSessionResponsePacket = readMessage("createSessionResponse2.txt");
        const messageActivateSessionRequestPacket = readMessage("activateSessionRequest2.txt");
        await performTest(messageCreateSessionResponsePacket, messageActivateSessionRequestPacket, SecurityPolicy.Basic256);
    });
});
