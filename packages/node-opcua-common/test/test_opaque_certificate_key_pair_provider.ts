import "mocha";
import nodeCrypto from "node:crypto";
import path from "node:path";
import { type IKeyOperations, keyOperationsFromPrivateKey, PrivateKeyUnavailableError } from "node-opcua-crypto";
import type { KeyMetadata, PrivateKey } from "node-opcua-crypto/web";
import "should";
import { getKeyOperationsFromProvider } from "../source/local_key_operations_provider";
import { OpaqueCertificateKeyPairProvider } from "../source/opaque_certificate_key_pair_provider";
import { type ICertificateKeyPairProvider, OPCUASecureObject } from "../source/opcua_secure_object";
import { resolvePrivateKeyProviderIfNeeded } from "../source/resolve_private_key_provider";

// a pre-generated self-signed certificate: only its parseability matters here
const fixtureCertificateFile = path.join(__dirname, "fixture_certificate.pem");

function makeLocalOps(): { ops: IKeyOperations; privateKey: PrivateKey } {
    const { privateKey } = nodeCrypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    const envelope: PrivateKey = { hidden: privateKey.export({ type: "pkcs8", format: "pem" }).toString() };
    return { ops: keyOperationsFromPrivateKey(envelope), privateKey: envelope };
}

/** A KMS-style async-only view over a local key, so results stay verifiable. */
function asAsyncOnly(ops: IKeyOperations): IKeyOperations {
    return {
        sign: ops.sign.bind(ops),
        decryptBlock: ops.decryptBlock.bind(ops),
        getKeyMetadata: ops.getKeyMetadata.bind(ops),
        getPublicKey: ops.getPublicKey ? ops.getPublicKey.bind(ops) : undefined
    };
}

describe("OpaqueCertificateKeyPairProvider", () => {
    const { ops } = makeLocalOps();
    const metadata: KeyMetadata = { keyType: "RSA", modulusLength: 256 };

    function makeProvider(certificateFile = "/nonexistent/certificate.pem") {
        return new OpaqueCertificateKeyPairProvider({ certificateFile, keyOperations: ops, keyMetadata: metadata });
    }

    it("getPrivateKey() throws PrivateKeyUnavailableError pointing to getKeyOperations()", () => {
        const provider = makeProvider();
        let caught: Error | undefined;
        try {
            provider.getPrivateKey();
        } catch (err) {
            caught = err as Error;
        }
        (caught instanceof PrivateKeyUnavailableError).should.eql(true);
        (caught as Error).message.should.match(/getKeyOperations/);
    });

    it("hands out the ops object and the prefetched metadata synchronously", () => {
        const provider = makeProvider();
        provider.getKeyOperations().should.equal(ops);
        provider.getKeyMetadata().should.equal(metadata);
        provider.privateKeyFile.should.eql("<opaque>");
    });

    it("reads the certificate chain lazily from disk", () => {
        const provider = makeProvider(fixtureCertificateFile);
        provider.getCertificateChain().length.should.be.greaterThan(0);
        provider.getCertificate().length.should.be.greaterThan(0);
        provider.invalidate();
        provider.getCertificate().length.should.be.greaterThan(0);
    });

    it("throws a clear error when the certificate file is missing", () => {
        const provider = makeProvider();
        (() => provider.getCertificate()).should.throw(/Certificate file not found/);
    });

    it("never leaks key-related state through JSON or inspect", () => {
        const provider = makeProvider();
        JSON.stringify(provider).should.not.match(/hidden|keyOperations/);
        String(provider[Symbol.for("nodejs.util.inspect.custom") as unknown as keyof typeof provider]).should.not.match(/hidden/);
    });
});

describe("getKeyOperationsFromProvider", () => {
    it("returns the provider's own ops when it implements ICertificateKeyPairProvider2", () => {
        const { ops } = makeLocalOps();
        const provider = new OpaqueCertificateKeyPairProvider({
            certificateFile: "/nonexistent",
            keyOperations: ops,
            keyMetadata: { keyType: "RSA", modulusLength: 256 }
        });
        getKeyOperationsFromProvider(provider).should.equal(ops);
    });

    it("wraps a plain provider's raw key, caches the wrap, and follows key rotation", () => {
        const { privateKey } = makeLocalOps();
        const { privateKey: rotatedKey } = makeLocalOps();
        let currentKey = privateKey;
        const plainProvider: ICertificateKeyPairProvider = {
            getCertificate: () => Buffer.alloc(0),
            getCertificateChain: () => [],
            getPrivateKey: () => currentKey
        };
        const first = getKeyOperationsFromProvider(plainProvider);
        getKeyOperationsFromProvider(plainProvider).should.equal(first, "same key must hit the cache");
        currentKey = rotatedKey;
        const second = getKeyOperationsFromProvider(plainProvider);
        second.should.not.equal(first, "a rotated key must get a fresh wrap");
    });

    it("OPCUASecureObject.getKeyOperations delegates to its provider", async () => {
        const { ops, privateKey } = makeLocalOps();
        const secureObject = new OPCUASecureObject({
            certificateKeyPairProvider: {
                getCertificate: () => Buffer.alloc(0),
                getCertificateChain: () => [],
                getPrivateKey: () => privateKey
            }
        });
        const wrapped = secureObject.getKeyOperations();
        const data = Buffer.from("check the wrap signs with the same key");
        const fromWrap = await wrapped.sign(data, { padding: "RSA-PKCS1-v1_5", hash: "SHA-256" });
        const fromOps = await ops.sign(data, { padding: "RSA-PKCS1-v1_5", hash: "SHA-256" });
        fromWrap.equals(fromOps).should.eql(true);
    });
});

describe("resolvePrivateKeyProviderIfNeeded with an opaque certificate manager", () => {
    it("installs an OpaqueCertificateKeyPairProvider with prefetched metadata and public key", async () => {
        const { ops } = makeLocalOps();
        const certificateFile = fixtureCertificateFile;
        const asyncOnly = asAsyncOnly(ops);
        const certificateManager = {
            isPrivateKeyOpaque: () => true,
            getKeyOperations: () => asyncOnly
        };
        let installed: ICertificateKeyPairProvider | undefined;
        const secureObject = {
            certificateFile,
            privateKeyFile: "<opaque>",
            setProvider: (provider: ICertificateKeyPairProvider) => {
                installed = provider;
            }
        };
        const resolved = await resolvePrivateKeyProviderIfNeeded(secureObject, certificateManager, false);
        resolved.should.eql(true);
        (installed instanceof OpaqueCertificateKeyPairProvider).should.eql(true);
        const opaque = installed as OpaqueCertificateKeyPairProvider;
        opaque.getKeyMetadata().modulusLength.should.eql(256);
        Buffer.from(opaque.getPublicKeySpki() as ArrayBuffer).length.should.be.greaterThan(0);
        opaque.getKeyOperations().should.equal(asyncOnly);
    });

    it("fails closed when the ops provider is broken", async () => {
        const certificateManager = {
            isPrivateKeyOpaque: () => true,
            getKeyOperations: (): IKeyOperations => ({
                sign: async () => {
                    throw new Error("HSM unreachable");
                },
                decryptBlock: async () => {
                    throw new Error("HSM unreachable");
                },
                getKeyMetadata: async () => {
                    throw new Error("HSM unreachable");
                }
            })
        };
        const secureObject = {
            certificateFile: "/some/certificate.pem",
            privateKeyFile: "<opaque>",
            setProvider: () => {
                throw new Error("must not install a provider when the probe fails");
            }
        };
        await resolvePrivateKeyProviderIfNeeded(secureObject, certificateManager, false).should.be.rejectedWith(/HSM unreachable/);
    });

    it("still no-ops for a user-provided provider even when the manager is opaque", async () => {
        const { ops } = makeLocalOps();
        const certificateManager = { isPrivateKeyOpaque: () => true, getKeyOperations: () => ops };
        const secureObject = {
            certificateFile: "/some/certificate.pem",
            privateKeyFile: "<opaque>",
            setProvider: () => {
                throw new Error("must not replace a user-provided provider");
            }
        };
        (await resolvePrivateKeyProviderIfNeeded(secureObject, certificateManager, true)).should.eql(false);
    });
});
