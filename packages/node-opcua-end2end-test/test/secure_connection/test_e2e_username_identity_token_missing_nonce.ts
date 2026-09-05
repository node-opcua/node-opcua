import { createPublicKey } from "node:crypto";
import "should";
import {
    ActivateSessionRequest,
    getCryptoFactory,
    MessageSecurityMode,
    OPCUAClient,
    OPCUAServer,
    type Request,
    SecurityPolicy,
    UserNameIdentityToken,
    UserTokenType
} from "node-opcua";
import { extractPublicKeyFromCertificateSync, toPem } from "node-opcua-crypto";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { assertThrow } from "../../test_helpers/assert_throw.js";
import { createServerCertificateManager } from "../../test_helpers/createServerCertificateManager.js";

// performMessageTransaction is public on the client implementation but not exposed on
// the public OPCUAClient interface; reached here to inject a malformed ActivateSessionRequest.
interface ClientWithTransaction {
    performMessageTransaction(request: Request, callback: (error: Error | null) => void): void;
}

const port = 5797;

const userManager = {
    isValidUser(userName: string, password: string) {
        return userName === "username" && password === "p@ssw0rd";
    }
};

// the encrypted UserNameIdentityToken carries the SecurityPolicy only through its
// encryptionAlgorithm: map it back to the crypto factory so we can re-encrypt the blob.
function findCryptoFactoryFromEncryptionAlgorithm(encryptionAlgorithm: string | null) {
    const candidates = [
        SecurityPolicy.Basic128Rsa15,
        SecurityPolicy.Basic256,
        SecurityPolicy.Basic256Sha256,
        SecurityPolicy.Aes128_Sha256_RsaOaep,
        SecurityPolicy.Aes256_Sha256_RsaPss
    ];
    const found = candidates
        .map((securityPolicy) => getCryptoFactory(securityPolicy))
        .find((cryptoFactory) => cryptoFactory?.asymmetricEncryptionAlgorithm === encryptionAlgorithm);
    if (!found) {
        throw new Error(`cannot find a crypto factory matching ${encryptionAlgorithm}`);
    }
    return found;
}

/**
 * OPC UA Part 4 - "Token Encryption and Proof of Possession": the client must append the
 * serverNonce to the password before encrypting it. A token that omits the nonce is
 * malformed - the server must reject it with BadIdentityTokenInvalid, and not with
 * BadUserAccessDenied which would suggest that the credentials were merely wrong.
 * (CTT: Security/Security User Name Password/006)
 */
describe("testing UserNameIdentityToken sent without the serverNonce appended to the password", () => {
    let server: OPCUAServer;
    let endpointUrl: string;

    before(async () => {
        const serverCertificateManager = await createServerCertificateManager(port);
        server = new OPCUAServer({
            port,
            serverCertificateManager,
            allowAnonymous: false,
            userManager,
            securityPolicies: [SecurityPolicy.None, SecurityPolicy.Basic256Sha256],
            securityModes: [MessageSecurityMode.None, MessageSecurityMode.SignAndEncrypt]
        });
        await server.start();
        endpointUrl = server.getEndpointUrl();
    });

    after(async () => {
        await server.shutdown();
    });

    it("should reject the identity token with BadIdentityTokenInvalid when the serverNonce is not appended to the password", async () => {
        const client = OPCUAClient.create({
            securityMode: MessageSecurityMode.None,
            securityPolicy: SecurityPolicy.None
        });

        const serverCertificate = server.getCertificate();
        const publicKey = createPublicKey(extractPublicKeyFromCertificateSync(toPem(serverCertificate, "CERTIFICATE")));

        let tampered = false;
        const clientEx = client as unknown as ClientWithTransaction;
        const original_performMessageTransaction = clientEx.performMessageTransaction;
        clientEx.performMessageTransaction = (request: Request, callback: (error: Error | null) => void) => {
            if (request instanceof ActivateSessionRequest && request.userIdentityToken instanceof UserNameIdentityToken) {
                const token = request.userIdentityToken;
                const cryptoFactory = findCryptoFactoryFromEncryptionAlgorithm(token.encryptionAlgorithm);
                // rebuild the password blob with the correct password, but *without* the
                // trailing serverNonce that the specification requires
                const passwordBuffer = Buffer.from("p@ssw0rd", "utf-8");
                const lengthBuffer = Buffer.alloc(4);
                lengthBuffer.writeUInt32LE(passwordBuffer.length, 0);
                token.password = cryptoFactory.asymmetricEncrypt(Buffer.concat([lengthBuffer, passwordBuffer]), publicKey);
                tampered = true;
            }
            original_performMessageTransaction.call(client, request, callback);
        };

        await client.connect(endpointUrl);
        try {
            await assertThrow(async () => {
                const session = await client.createSession({
                    type: UserTokenType.UserName,
                    userName: "username",
                    password: "p@ssw0rd"
                });
                await session.close();
            }, /BadIdentityTokenInvalid/);
        } finally {
            await client.disconnect();
        }
        tampered.should.eql(true, "the ActivateSessionRequest should have been tampered with");
    });
});
