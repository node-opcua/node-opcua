import "mocha";
import { createPublicKey, randomBytes } from "node:crypto";
import { type IKeyOperations, keyOperationsFromPrivateKey, readCertificateChain, readPrivateKey } from "node-opcua-crypto";
import { getFixture } from "node-opcua-test-fixtures";
import "should";
import {
    asymmetricDecryptWithKeyOps,
    asymmetricDecryptWithKeyOpsSync,
    type CryptoFactory,
    computeSignature,
    computeSignatureAsync,
    getCryptoFactory,
    getDecryptParams,
    getSignParams,
    SecurityPolicy,
    verifySignature
} from "../source/security_policy.js";

const senderCertificate = readCertificateChain(getFixture("certs/server_cert_2048.pem"))[0];
const receiverPrivateKey = readPrivateKey(getFixture("certs/client_key_1024.pem"));
const receiverCertificate = readCertificateChain(getFixture("certs/client_cert_1024.pem"))[0];

const allPolicies = [
    SecurityPolicy.Basic128Rsa15,
    SecurityPolicy.Basic256,
    SecurityPolicy.Basic256Sha256,
    SecurityPolicy.Aes128_Sha256_RsaOaep,
    SecurityPolicy.Aes256_Sha256_RsaPss
];

/** A KMS-style async-only view over the fixture key, so results stay verifiable. */
function asAsyncOnly(ops: IKeyOperations): IKeyOperations {
    return {
        sign: ops.sign.bind(ops),
        decryptBlock: ops.decryptBlock.bind(ops),
        getKeyMetadata: ops.getKeyMetadata.bind(ops),
        getPublicKey: ops.getPublicKey ? ops.getPublicKey.bind(ops) : undefined
    };
}

describe("computeSignatureAsync", () => {
    const senderNonce = randomBytes(32);
    const localOps = keyOperationsFromPrivateKey(receiverPrivateKey);

    for (const securityPolicy of allPolicies) {
        it(`produces a signature verifySignature accepts, from a raw key and from key operations - ${securityPolicy}`, async () => {
            const fromRawKey = await computeSignatureAsync(senderCertificate, senderNonce, receiverPrivateKey, securityPolicy);
            const fromOps = await computeSignatureAsync(senderCertificate, senderNonce, asAsyncOnly(localOps), securityPolicy);
            const fromSync = computeSignature(senderCertificate, senderNonce, receiverPrivateKey, securityPolicy);

            for (const signatureData of [fromRawKey, fromOps, fromSync]) {
                verifySignature(senderCertificate, senderNonce, signatureData!, receiverCertificate, securityPolicy).should.eql(
                    true,
                    `signature must verify for ${securityPolicy}`
                );
            }
            fromRawKey?.algorithm?.should.eql(fromSync?.algorithm);
        });
    }

    it("byte-matches the sync computeSignature for the deterministic (PKCS#1 v1.5) policies", async () => {
        for (const securityPolicy of [SecurityPolicy.Basic128Rsa15, SecurityPolicy.Basic256Sha256]) {
            const fromAsync = await computeSignatureAsync(senderCertificate, senderNonce, receiverPrivateKey, securityPolicy);
            const fromSync = computeSignature(senderCertificate, senderNonce, receiverPrivateKey, securityPolicy);
            fromAsync?.signature?.equals(fromSync?.signature as Buffer).should.eql(true);
        }
    });

    it("returns undefined on missing inputs, like the sync form", async () => {
        (
            (await computeSignatureAsync(null, senderNonce, receiverPrivateKey, SecurityPolicy.Basic256Sha256)) === undefined
        ).should.eql(true);
        (
            (await computeSignatureAsync(senderCertificate, null, receiverPrivateKey, SecurityPolicy.Basic256Sha256)) === undefined
        ).should.eql(true);
        (
            (await computeSignatureAsync(senderCertificate, senderNonce, null, SecurityPolicy.Basic256Sha256)) === undefined
        ).should.eql(true);
    });
});

describe("getSignParams / getDecryptParams", () => {
    it("answers for every built-in factory", () => {
        for (const securityPolicy of allPolicies) {
            const cryptoFactory = getCryptoFactory(securityPolicy)!;
            getSignParams(cryptoFactory).padding.should.be.ok();
            getDecryptParams(cryptoFactory).padding.should.be.ok();
        }
    });

    it("fails with a clear error for a custom factory that predates the params", () => {
        const legacyFactory = { securityPolicy: SecurityPolicy.Basic256Sha256 } as CryptoFactory;
        (() => getSignParams(legacyFactory)).should.throw(/signParams/);
        (() => getDecryptParams(legacyFactory)).should.throw(/decryptParams/);
    });
});

describe("asymmetricDecryptWithKeyOps", () => {
    const localOps = keyOperationsFromPrivateKey(receiverPrivateKey);
    // a plaintext long enough to span several RSA blocks through the factory's block-wise encrypt
    const plaintext = randomBytes(200);

    async function publicKeyOfOps(): Promise<ReturnType<typeof createPublicKey>> {
        const spki = await localOps.getPublicKey();
        return createPublicKey({ key: Buffer.from(spki), format: "der", type: "spki" });
    }

    for (const securityPolicy of [SecurityPolicy.Basic256, SecurityPolicy.Basic256Sha256, SecurityPolicy.Aes256_Sha256_RsaPss]) {
        it(`round-trips what the factory encrypted, async and sync - ${securityPolicy}`, async () => {
            const cryptoFactory = getCryptoFactory(securityPolicy)!;
            const encrypted = cryptoFactory.asymmetricEncrypt(plaintext, await publicKeyOfOps());

            const viaOps = await asymmetricDecryptWithKeyOps(cryptoFactory, encrypted, asAsyncOnly(localOps));
            const viaSyncOps = asymmetricDecryptWithKeyOpsSync(cryptoFactory, encrypted, localOps);
            const viaLegacy = cryptoFactory.asymmetricDecrypt(encrypted, receiverPrivateKey);

            viaOps.subarray(0, plaintext.length).equals(plaintext).should.eql(true);
            viaOps.equals(viaSyncOps).should.eql(true);
            viaOps.equals(viaLegacy).should.eql(true, "ops-based decrypt must match the legacy factory decrypt");
        });
    }

    it("the sync form refuses an async-only provider", () => {
        const cryptoFactory = getCryptoFactory(SecurityPolicy.Basic256Sha256)!;
        (() => asymmetricDecryptWithKeyOpsSync(cryptoFactory, Buffer.alloc(128), asAsyncOnly(localOps))).should.throw(
            /synchronous fast path/
        );
    });

    it("rejects on an undecryptable block instead of returning garbage (documented divergence)", async () => {
        const cryptoFactory = getCryptoFactory(SecurityPolicy.Basic256Sha256)!;
        await asymmetricDecryptWithKeyOps(cryptoFactory, Buffer.alloc(128, 0xab), localOps).should.be.rejected();
    });
});
