# Using an HSM/KMS-held application key

node-opcua can operate with a private key it can never read: the key lives
in an HSM, a cloud KMS, a TPM, or an OS keystore, non-exportable, and
node-opcua drives it through an opaque *key-operations* provider. This
covers the whole lifecycle — certificate bootstrap, secure channels
(Sign and SignAndEncrypt), session signatures, user-token decryption,
and certificate renewal — without key material ever entering the process.

## Why

- **IEC 62443-4-2 / NIS2**: "the private key is non-exportable" becomes a
  property you can certify, and every use of the key appears in the
  HSM/KMS audit log.
- **Post-incident confidence**: memory dumps, disk images and backups
  contain no key; after a compromise, remediation is "revoke sessions",
  not "the application identity is lost".

**Honest scope**: a resident attacker with code execution inside the
process can still *use* the key through the provider while resident, and
the symmetric keys derived for message traffic still live in process
memory (inherent to OPC UA's design). The accurate claim is
"non-exportable, auditable identity key" — not "keys never in memory".

## The provider

Implement `IKeyOperations` (from `node-opcua-crypto`, re-exported by
`node-opcua-pki`). Sketch, for a Google-Cloud-KMS-style service:

```typescript
import type { AsymmetricDecryptParams, AsymmetricSignParams, IKeyOperations, KeyMetadata } from "node-opcua-crypto";

class MyKmsKeyOperations implements IKeyOperations {
    constructor(private keyName: string) {}

    async sign(data: Uint8Array, params: AsymmetricSignParams): Promise<Buffer> {
        // params.padding: "RSA-PKCS1-v1_5" | "RSA-PSS"   (PSS salt length = digest length)
        // params.hash:    "SHA-1" | "SHA-256"
        return Buffer.from(await myKms.sign({ keyName: this.keyName, data, algorithm: toKmsSignAlgorithm(params) }));
    }
    async decryptBlock(block: Uint8Array, params: AsymmetricDecryptParams): Promise<Buffer> {
        // exactly ONE RSA block per call (block.length === modulusLength);
        // node-opcua owns the multi-block loop and issues blocks concurrently
        return Buffer.from(await myKms.decrypt({ keyName: this.keyName, ciphertext: block, algorithm: toKmsDecryptAlgorithm(params) }));
    }
    async getKeyMetadata(): Promise<KeyMetadata> {
        // declared, not inspected: an HSM key exposes nothing to introspect
        return { keyType: "RSA", modulusLength: 256 }; // bytes — a 2048-bit key
    }
    async getPublicKey(): Promise<ArrayBuffer> {
        return await myKms.getPublicKey(this.keyName); // SPKI DER
    }
}
```

`getPublicKey` is formally optional, but certificate operations and the
startup certificate/key match check need it — implement it.

A local key can wear the same interface via
`keyOperationsFromPrivateKey(privateKey)`, which also provides the
synchronous fast path node-opcua uses to keep local-key performance
unchanged.

## Wiring a server

```typescript
import { MessageSecurityMode, OPCUACertificateManager, OPCUAServer } from "node-opcua";

const keyOperations = new MyKmsKeyOperations("projects/.../cryptoKeyVersions/1");

const serverCertificateManager = new OPCUACertificateManager({
    rootFolder: "./pki",
    keyOperations
});
await serverCertificateManager.initialize(); // fails closed if the provider is unreachable

// bootstrap: a self-signed certificate over the HSM-held key (first run only)
const certificateFile = `${serverCertificateManager.rootDir}/own/certs/self_signed_certificate.pem`;
await serverCertificateManager.createSelfSignedCertificate({
    applicationUri: "urn:myhost:myserver",
    subject: "/CN=MyServer",
    dns: ["myhost"],
    startDate: new Date(),
    validity: 365
});

const server = new OPCUAServer({
    port: 4840,
    serverCertificateManager,
    certificateFile,
    privateKeyFile: serverCertificateManager.privateKey, // path is unused: the key is in the HSM
    securityModes: [MessageSecurityMode.SignAndEncrypt]
});
await server.start();
```

A client is wired the same way through `clientCertificateManager`. The
user identity can also be HSM/smartcard-held: pass `keyOperations` in a
`UserIdentityInfoX509` instead of the (deprecated) raw `privateKey` PEM.

## Renewal: new certificate, same HSM key

```typescript
const csrFile = await serverCertificateManager.createCertificateRequest({
    applicationUri: "urn:myhost:myserver",
    subject: "/CN=MyServer",
    dns: ["myhost"]
});
// have your CA sign the CSR, then install the new certificate —
// the key never moved
```

The same provider can also drive a `CertificateAuthority` (CSR/CRL
signing) through the `caSignerFromKeyOperations` adapter from
`node-opcua-crypto` — one HSM integration serves both worlds.

## Performance and behavior

- Provider calls happen only at channel open/renewal, session
  activation, and user-token decryption. Message traffic uses symmetric
  derived keys: **zero provider calls on the hot path**.
- OpenSecureChannel chunks are signed/decrypted through the provider
  asynchronously; chunk ordering is preserved. A ~30 ms KMS round trip
  adds roughly that once or twice per connect.
- Token renewal re-signs through the provider (default lifetimes are
  tens of minutes; budget your KMS quota at roughly
  `sessions / lifetime` operations per second).
- `getPrivateKey()` throws a typed `PrivateKeyUnavailableError` when the
  key is opaque — anything that truly needs key material (for example
  `regeneratePrivateKey` in push certificate management) reports
  `BadNotSupported` instead of silently degrading.
