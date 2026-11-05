# node-opcua-server-configuration

Part of [node-opcua](http://node-opcua.github.io/), the OPC UA SDK for Node.js written in TypeScript.

This package implements the `ServerConfiguration` object of OPC 10000-12
(Part 12, "Discovery and Global Services") for node-opcua servers, that is the
**push model** of certificate management: a CertificateManager (a GDS, or any
administration tool) connects to the server and

- asks it for a certificate signing request (`CreateSigningRequest`),
- installs the certificate signed by its CA (`UpdateCertificate`),
- updates its trust lists (the `TrustList` objects of the certificate groups),
- and makes the changes effective (`ApplyChanges`).

It also provides the client side of these calls (`ClientPushCertificateManagement`).

```bash
npm install node-opcua node-opcua-server-configuration
```

## Server side

Call `installPushCertificateManagementOnServer(server, options)` after
`server.initialize()` (the address space must exist; the function throws
otherwise) and before `server.start()`:

```typescript
import { OPCUACertificateManager, OPCUAServer, WellKnownRoles, makeRoles } from "node-opcua";
import { installPushCertificateManagementOnServer } from "node-opcua-server-configuration";

const serverCertificateManager = new OPCUACertificateManager({
    rootFolder: "/var/lib/my-server/PKI", // application certificate and trust list
    automaticallyAcceptUnknownCertificate: false
});
const userCertificateManager = new OPCUACertificateManager({
    rootFolder: "/var/lib/my-server/UserPKI", // trust list for X.509 user tokens
    automaticallyAcceptUnknownCertificate: false
});

const server = new OPCUAServer({
    port: 4840,
    serverCertificateManager,
    userCertificateManager,
    userManager: {
        isValidUser: (userName: string, password: string) =>
            userName === "admin" && password === process.env.ADMIN_PASSWORD,
        // the CertificateManager must log in with a user that has the SecurityAdmin role
        getUserRoles: (userName: string) =>
            userName === "admin"
                ? makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.SecurityAdmin])
                : makeRoles([WellKnownRoles.AuthenticatedUser])
    }
});

await server.initialize();
await installPushCertificateManagementOnServer(server, {
    closeChannelsOnApplyChanges: true,
    applicationSetup: { leaveWhenConfigured: false }
});
await server.start();
```

The installer also adds the Global Certificate Management facet
(`GLOBAL_CERTIFICATE_MANAGEMENT_PROFILE_URI`) to
`ServerCapabilities.ServerProfileArray`.

### Options (`InstallPushCertificateManagementOnServerOptions`)

| Option | Default | Meaning |
| --- | --- | --- |
| `closeChannelsOnApplyChanges` | `true` | When `ApplyChanges` puts a new server certificate (and possibly a new private key) into service, every open secure channel is closed once the response is sent, so all clients reconnect with the new certificate. Use this when the rotation answers a compromised or revoked key. With `false`, open channels keep running under the certificate and key they were created with (seamless planned rotation); new connections use the new pair. |
| `applicationSetup.leaveWhenConfigured` | `false` | Only matters while the server reports `ServerState.NoConfiguration` (see below). When `true`, the server moves to `Running` by itself once `ApplyChanges` has put a CA-issued certificate into service and the TrustList holds a certificate that was not trusted automatically; on leaving `NoConfiguration`, the certificates trusted automatically during the setup are removed again, except those a TrustList write kept. When `false`, the application decides when the setup ends, and those certificates stay trusted. |

### Security requirements

What the code enforces, for every session:

- **Encrypted channel.** `CreateSigningRequest`, `UpdateCertificate`,
  `GetRejectedList`, `ApplyChanges`, and the TrustList `AddCertificate` /
  `RemoveCertificate` methods check that the session's secure channel uses
  `MessageSecurityMode.SignAndEncrypt`, and return `BadSecurityModeInsufficient`
  otherwise. These methods, the certificate groups and the TrustList methods
  (`Open`, `OpenWithMasks`, `Read`, `Write`, `Close`, `CloseAndUpdate`, ...)
  also carry the `SigningRequired | EncryptionRequired` access restrictions.
- **SecurityAdmin role.** The same methods check that the session user has
  the `SecurityAdmin` well-known role, and return `BadUserAccessDenied`
  otherwise (an anonymous session never qualifies). Their RolePermissions grant
  everything to `SecurityAdmin` only; `ServerConfiguration` and
  `CertificateGroups` can be browsed by anybody, and read by `ConfigureAdmin`.
  Roles come from your `userManager.getUserRoles()`.
- **Disk based PKI.** `serverCertificateManager` must be an
  `OPCUACertificateManager` (the function throws otherwise): push management
  writes certificates and keys to its folders.
- **Private keys.** A key held by an HSM/KMS (opaque key) cannot be
  regenerated or replaced: `CreateSigningRequest` with `regeneratePrivateKey`
  and `UpdateCertificate` with a private key answer `BadNotSupported`.

### Where the PKI and trust lists live

| Certificate group | Certificate manager | Content |
| --- | --- | --- |
| `DefaultApplicationGroup` | `serverCertificateManager` | server certificate (`own/certs/certificate.pem`), private key (`own/private/private_key.pem`), trusted and issuer certificates and CRLs (`trusted/`, `issuers/`), rejected certificates (`rejected/`) |
| `DefaultUserTokenGroup` | `userCertificateManager` | trust list used to validate X.509 user identity tokens |

Without explicit managers, OPCUAServer uses the default ones, in
`<config>/node-opcua-default-nodejs/PKI` and `.../UserPKI` (on Linux,
`~/.config/node-opcua-default-nodejs/`).

A change of the TrustList re-evaluates open secure channels and sessions
(OPC 10000-12 7.8.2.5): those whose certificate is no longer trusted are
closed shortly after the method returns.

### First configuration (`NoConfiguration`)

A server that has never been provisioned can be put in the application setup
state by the application: `server.setServerState(ServerState.NoConfiguration)`
(the server is otherwise `Running` after `initialize()`). While in that state,
and only when push management is installed, the server admits a client whose
certificate is untrusted, whose chain is incomplete or whose revocation status
is unknown, and trusts its leaf certificate, so that a CertificateManager can connect the first time. Revoked,
expired or invalid certificates are never admitted. Leave the state as soon as
the server is configured (`applicationSetup.leaveWhenConfigured`, or set the
state yourself).

## Client side (GDS or administration tool)

```typescript
import { readFile } from "node:fs/promises";
import { MessageSecurityMode, OPCUAClient, SecurityPolicy, UserTokenType } from "node-opcua";
import { ClientPushCertificateManagement, rsaCertificateTypes, TrustListMasks } from "node-opcua-server-configuration";

/** your CA: turns a DER certificate signing request into a DER certificate and its issuer chain */
declare function signWithMyCA(csr: Buffer): Promise<{ certificate: Buffer; issuerCertificates: Buffer[] }>;

const client = OPCUAClient.create({
    securityMode: MessageSecurityMode.SignAndEncrypt, // required by the server
    securityPolicy: SecurityPolicy.Basic256Sha256
});

await client.withSessionAsync(
    {
        endpointUrl: "opc.tcp://my-server:4840",
        userIdentity: {
            type: UserTokenType.UserName,
            userName: "admin", // a user with the SecurityAdmin role
            password: process.env.ADMIN_PASSWORD ?? ""
        }
    },
    async (session) => {
        const pushManagement = new ClientPushCertificateManagement(session);

        // 1. ask the server for a certificate signing request
        const csr = await pushManagement.createSigningRequest(
            "DefaultApplicationGroup",
            rsaCertificateTypes.RsaSha256ApplicationCertificateType,
            "", // empty subject: the server proposes its own
            false // keep the current private key
        );
        if (csr.statusCode.isNotGood() || !csr.certificateSigningRequest) {
            throw new Error(`CreateSigningRequest failed: ${csr.statusCode.toString()}`);
        }

        // 2. sign it with your CA, then install the certificate
        const { certificate, issuerCertificates } = await signWithMyCA(csr.certificateSigningRequest);
        const update = await pushManagement.updateCertificate(
            "DefaultApplicationGroup",
            rsaCertificateTypes.RsaSha256ApplicationCertificateType,
            certificate,
            issuerCertificates
        );
        if (update.statusCode.isNotGood()) {
            throw new Error(`UpdateCertificate failed: ${update.statusCode.toString()}`);
        }

        // 3. update the trust list of the application group
        const applicationGroup = await pushManagement.getApplicationGroup();
        const trustList = await applicationGroup.getTrustList();
        const current = await trustList.readTrustedCertificateListWithMasks(TrustListMasks.All);
        current.trustedCertificates = [
            ...(current.trustedCertificates ?? []),
            await readFile("partner_certificate.der") // DER encoded certificate to trust
        ];
        const applyChangesRequired = await trustList.writeTrustedCertificateList(current);

        // 4. make the changes effective
        if (update.applyChangesRequired || applyChangesRequired) {
            const status = await pushManagement.applyChanges();
            if (status.isNotGood()) {
                throw new Error(`ApplyChanges failed: ${status.toString()}`);
            }
        }
    }
);
```

`writeTrustedCertificateList` opens the TrustList with `WriteEraseExisting`,
writes the whole `TrustListDataType` and calls `CloseAndUpdate`: lists that
are not set are cleared, so read the current content first, as above, and
modify it. For a single certificate, `trustList.addCertificate(certificate, true)`
and `trustList.removeCertificate(thumbprint, true)` are simpler.

With the default `closeChannelsOnApplyChanges: true`, the server closes the
channel of this client too after `ApplyChanges`: reconnect to continue.

Other helpers of `ClientPushCertificateManagement`: `getRejectedList()`,
`getSupportedPrivateKeyFormats()`, `getUserTokenGroup()` (trust list for X.509
user tokens), and `updateCertificate(..., privateKeyFormat, privateKey)` to
install a key pair generated outside the server.
