# Migrating to key operations

node-opcua is moving every private-key use to an opaque *key-operations*
path (`IKeyOperations`), so the application key can be HSM/KMS-held. The
public API is unchanged for applications that configure keys through
`OPCUAClient` / `OPCUAServer` / `OPCUACertificateManager` options — file
based keys (`certificateFile` / `privateKeyFile`) remain first-class and
are NOT deprecated. This page maps each deprecated or removed pattern to
its replacement, for the few consumers that reach deeper.

## Deprecated (still working; removal candidates for the next major)

**Reading the application key** — prefer the ops object; it works whether
the key is local or HSM/KMS-held (where `getPrivateKey()` throws
`PrivateKeyUnavailableError`):

```typescript
// before
const privateKey = server.getPrivateKey();
// after
const keyOperations = server.getKeyOperations();
const signature = await keyOperations.sign(data, { padding: "RSA-PKCS1-v1_5", hash: "SHA-256" });
```

**`computeSignature`** — the async twin accepts a raw `PrivateKey`
(byte-identical result) or an `IKeyOperations`:

```typescript
// before
const signatureData = computeSignature(certificate, nonce, privateKey, securityPolicy);
// after
const signatureData = await computeSignatureAsync(certificate, nonce, privateKey /* or keyOperations */, securityPolicy);
```

**`CryptoFactory.asymmetricSign` / `asymmetricDecrypt`** — a custom
factory should declare the parameter objects instead; the helpers do the
work through any provider:

```typescript
// before (custom factory)
{ asymmetricSign: mySign, asymmetricDecrypt: myDecrypt, ... }
// after — add:
{ signParams: { padding: "RSA-PKCS1-v1_5", hash: "SHA-256" }, decryptParams: { padding: "RSA-OAEP", oaepHash: "SHA-1" }, ... }
// and decrypt via:
const plain = await asymmetricDecryptWithKeyOps(cryptoFactory, buffer, keyOperations);
```

**`UserIdentityInfoX509.privateKey` (raw PEM)** — one line:

```typescript
// before
{ type: UserTokenType.Certificate, certificateData, privateKey: privateKeyPem }
// after
import { keyOperationsFromPrivateKey, readPrivateKey } from "node-opcua-crypto";
{ type: UserTokenType.Certificate, certificateData, keyOperations: keyOperationsFromPrivateKey(readPrivateKey(privateKeyFile)) }
```

## Removed (internal API — deleted outright, changelog-noted)

These were `@internal` node-opcua plumbing; nothing outside the
repository constructed them (verified against samples, docs and
published consumers), but deep importers may have reached them through
re-exports:

| Removed | Replacement |
| --- | --- |
| `invalidPrivateKey` | none — build a `StaticCertificateChainProvider` with a locally-cast placeholder if a test needs one |
| `MessageBuilderOptions.privateKey` | `MessageBuilderOptions.keyOperations` |
| `ClientSecureChannelLayer.getPrivateKey()` / `ServerSecureChannelLayer.getPrivateKey()` | `getKeyOperations()` on the channel |
| `ServerSecureChannelParent.getPrivateKey()` (required member) | `getKeyOperations()` — wrap a local key with `keyOperationsFromPrivateKey` |
| `OPCUAServerEndPointOptions.certificateChain` + `.privateKey` | `certificateKeyPairProvider` (an `ICertificateChainProvider`, e.g. `StaticCertificateChainProvider`) |
| `OPCUAServerEndPoint.getPrivateKey()` | `getKeyOperations()` on the endpoint |

## Enforcement

`npm run check:privatekey` (run in CI) ratchets the number of
`.getPrivateKey(` call sites per package: it only ever tightens, so new
code goes through key operations. See the
[HSM/KMS guide](./using_hsm_kms_keys.md) for the provider interface.
