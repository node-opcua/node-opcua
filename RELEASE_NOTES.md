
Faster Read, Write and sampling, and less memory per node
=========================================================

  - a Read or a Write whose items the server can serve at once is answered from the bytes of the
    request: no ReadRequest, WriteRequest, RequestHeader or ReadValueId is built and the service
    dispatch is skipped. The session checks, access rights, timestamps, maxAge and service counters
    are those of the normal path; anything else (another attribute, an index range, a data encoding,
    a Variable refreshed asynchronously before it is read, an unknown node, registered nodes, a
    listener of the server's `"request"` event) is decoded and served as before.
  - the Read and Write paths no longer build a promise, a PseudoSession or a NodeId string per item,
    resolve Roles and namespace defaults once per request, and find the session of a request from
    the bytes of its token. Sampling resolves permissions once per pass and samples every item of an
    interval in one pass.
  - a response that fits one chunk on a channel without security is written in place, and the chunks
    a tick produces leave in one socket write.
  - nodes take less heap: optional fields take no slot until set (100,000 Variables added to the
    standard nodeset: 2,635 to 2,469 bytes per node), references are indexed in an array, a
    defaulted display name stays a string, setters share one callback wrapper.
  - measured on a 4-core Gemini Lake mini PC (server on 2 cores, open62541 C client), node-opcua
    2.186.17 against this release: pipelined Reads of one value about 3,700 to 10,000-20,000 calls/s,
    Reads of 1000 values 38 to about 440 calls/s, Writes of 1000 values 20 to about 80 calls/s. With
    front threads (below) Reads of 1000 values reach about 1,400 calls/s and Writes about 500.
  - **behaviour change** a parent stops exposing children created at runtime as JavaScript
    properties past its first thousand of them (`folder.tag12345`); every child stays reachable
    through `getChildByName()` and Browse. A parent with a hundred thousand children no longer slows
    every access to it.

SignAndEncrypt: node-opcua-crypto 6.2.0, node-opcua-pki 7.1.0
=============================================================

  - node-opcua-crypto 6.2.0 signs and encrypts each chunk with KeyObjects made once per derived key,
    instead of handing node:crypto the key bytes, which Node.js checked and wrapped on every call.
    Measured with SignAndEncrypt (Basic256Sha256): Reads of one 10 KB value +47%, Reads of
    1000 x 10 KB values +29%, server CPU per small read 1.1 to 0.67 ms.

A channel admits requests as fast as their responses leave
==========================================================

  - **behaviour change** a channel starts a request only while the requests in progress, each counted
    at the recent response size of its service, and what its socket has not sent yet stay within
    16 MB; the others wait their turn on that channel. A client pipelining Reads of large values used
    to have every response built and held at once (10 channels x 32 Reads of 8 MB took a server past
    3 GB). PublishRequests are never held back.
  - the transport reports a malformed or unexpected handshake reply (an ACK below the Part 6 minimum
    buffer sizes, a reply to HEL that is neither ACK nor ERR) as a connection failure instead of
    asserting in the socket data handler, which ended the client process. node-opcua-assert is no
    longer a dependency of node-opcua-transport.
  - the packet assembler of a connection is kept when its limits change during the handshake.

Compact address space and front threads (new, experimental)
==========================================================

  - `OPCUAServerOptions.compactAddressSpace` adds a compact store next to the node objects: nodes,
    references, strings and values in typed columns (`node-opcua-address-space-store`).
    `server.engine.registerCompactNamespace(uri)` registers a namespace served from it, where the
    application adds its nodes; Read, Write, Browse, Translate, monitored items, Methods and history
    work on its nodes, and the rest of the address space is unchanged.
  - `FrontThreadEngine` (node-opcua-server) serves one server from several threads: an engine thread
    owns the address space and the record of every session, front threads hold the channels and
    answer the values of the store in place, and session workers host the subscriptions
    (TransferSubscriptions, ConditionRefresh, GetMonitoredItems, ResendData, SetSubscriptionDurable
    and the monitored item hooks included). Every front shows the same address space, sessions and
    diagnostics. Limits, build info and auditing are set on `FrontThreadEngine.create()`; the
    server's own namespace (1) derives from the `applicationUri`, and `registerNamespace()` declares
    a namespace of the model served from the store. Measured on the same mini PC: 44,000 Reads of one value per second with 2 fronts on 2
    cores, against about 20,000 for a single-thread server.
  - structures travel between threads as their binary encoding: `EncodedVariant`
    (`encodedVariant(bytes)`, node-opcua-variant) and `EncodedDataValue` (node-opcua-data-value)
    keep a value in the encoding it arrived in and decode it only when it is read.
  - `diagnosticsNamespaceUri` (OPCUAServerOptions, `FrontThreadEngine.create()`) puts the nodes the
    server creates while it runs (Sessions, their diagnostics, the diagnostics of their
    Subscriptions) in a namespace of their own; without it they stay in namespace 1, as before.

Fixes
=====

  - **behaviour change** a namespace's default access restrictions are applied. The check looked up
    a `defaultAccessRestriction` child of the NamespaceMetadata object while the property is
    `DefaultAccessRestrictions`, so every node without AccessRestrictions of its own was treated as
    unrestricted. The value given to `Namespace.setDefaultAccessRestrictions()` now applies too when
    there is no metadata. A server that declared default restrictions on a namespace now enforces
    them.
  - sampling ticks stay on a fixed grid (`start + k * interval`) instead of `setInterval`, which never
    made up lateness: at 10 ms an idle server sampled 98 to 99 times per second instead of 100.
  - a cloned `OpaqueStructure` keeps its body (`Variant.clone` dropped its NodeId and bytes).
  - a Session closed while its user is being checked is not activated.
  - node-opcua-date-time no longer depends on `long` at run time.

New nodesets
============

  - the UAFX nodesets (FX Data, AC, CM 1.00.04): `node-opcua-nodeset-fx-data`,
    `node-opcua-nodeset-fxac` and `node-opcua-nodeset-fxcm`.

A node keeps the `<Documentation>` link and the `<Category>` elements of its nodeset
==================================================================================

  - `BaseNode` gains two optional fields, `nodesetDocumentation?: string` and
    `nodesetCategory?: string[]`. A NodeSet2 document states, for many nodes, where the
    specification defines them (`https://reference.opcfoundation.org/...`) and which conformance
    units they belong to. The loader read both and the node forgot them, so nothing that works on
    a loaded address space could see them, and `toNodeset2XML()` wrote a document without them:
    DI lost 79 links, Machinery 17.
  - `toNodeset2XML()` and the record walk now write them back, in the order the schema requires
    (Description, Category, Documentation, References). An exported document therefore differs from
    what 2.185 wrote for any namespace that declares them; for the others it is byte-identical.
  - they are not named `documentation` and `category` because the children of a node are reachable
    as properties under their browse name: DI's `ISupportInfoType` has a `Documentation` folder and
    I4AAS has types with a `Category` property.
  - unchanged: neither is an OPC UA attribute and no service exposes them. They are set only on
    the nodes whose document declared them, and an instance does not inherit them from its type.

Nodeset packages load fewer files at startup, and need TypeScript 5.0 to compile against
=======================================================================================

  - the generated nodeset packages describe types, and all but their enum files compile to modules
    with no run-time content. Their index re-exported every file with `export *`, which keeps a
    run-time load even for an empty module: requiring `node-opcua` loaded 1606 files, 532 of them
    empty. The index now uses `export type *` for those files, so `require("node-opcua")` loads
    1074 files and `require("node-opcua-address-space")` 765 instead of 1297.
  - unchanged: every value these packages export is still exported. Only the modules that had no
    run-time content stopped being loaded.
  - **consumer requirement** `export type *` is TypeScript 5.0 syntax, and it now appears in the
    published `.d.ts` of the nodeset packages, which `node-opcua-address-space` re-exports. A
    project compiling against node-opcua needs TypeScript 5.0 or above; TypeScript 4.x cannot parse
    those declaration files.

TransferSubscriptions: the anonymous rule is now enforced by default (OPC UA Part 4 §5.13.7)
============================================================================================

  - **behaviour change** `OPCUAServerOptions.allowAnonymousSubscriptionTransferOnUnsecuredChannel`
    now defaults to `false` (it used to default to `true`). As required by Part 4 §5.13.7, a
    Subscription created by an anonymous Session is only transferred to another Session when the
    SecureChannel MessageSecurityMode is `Sign` or `SignAndEncrypt` **and** the client certificate's
    ApplicationUri is the one of the original Session; otherwise the transfer is refused with
    `Bad_UserAccessDenied`. A stock server used to accept the transfer over a `None` endpoint and
    failed the CTT 1.05 script *Subscription Services / Subscription Transfer / Err-017*.
  - migration: an anonymous client that reconnects over a `None` endpoint and expects to keep its
    subscriptionId now rebuilds its subscription instead. Set
    `allowAnonymousSubscriptionTransferOnUnsecuredChannel: true` on the server to restore the previous
    behaviour; the option is documented as an explicit relaxation of the specification.
  - unchanged: the cross-user ownership check (a transfer is refused unless the destination Session
    operates on behalf of the same user as the Subscription owner) is always enforced.

Local Discovery Server: registration conformance (OPC UA Part 4 §5.5.5 / §5.5.6)
================================================================================

  - **breaking** `OPCUADiscoveryServer` no longer accepts `RegisterServer` / `RegisterServer2`
    from unauthenticated callers. As required by OPC UA Part 4 §5.5.5 / §5.5.6:
    - a registration over a `MessageSecurityMode.None` SecureChannel (no client certificate) is refused
      with `Bad_SecurityModeInsufficient`
    - a registration whose `serverUri` does not match the ApplicationUri of the certificate that opened
      the SecureChannel is refused with `Bad_ServerUriInvalid`
    - the default certificate manager of the LDS no longer trusts unknown certificates: an unknown
      registrant is refused at `OpenSecureChannel` and its certificate is placed in the `rejected` folder;
      move it to `trusted/certs` to allow the registration (the LDS logs both paths at startup).
      This is the OPC Foundation UA-LDS default and what Part 12 §5.3.5 describes as the primary
      mechanism for establishing trust between applications.
  - `FindServers`, `FindServersOnNetwork` and `GetEndpoints` are unchanged and remain available without
    message security (Part 4 §5.5.1)
  - migration: after upgrading, each server that registers with a node-opcua LDS must have its
    certificate trusted by the LDS once. `OPCUAServer` already registers over `SignAndEncrypt`, so no
    change is needed on the server side.
  - legacy opt-ins on `OPCUADiscoveryServerOptions`, both disabled by default, both relaxing the Part 4
    requirements: `allowUnsecuredRegistration: true` and `automaticallyAcceptUnknownCertificate: true`
  - new `onRegistrationRefused` event on `OPCUADiscoveryServer` (Part 4 asks Discovery Servers to audit
    failed registrations); refusals are also logged with the caller's address, security mode and
    certificate ApplicationUri
  - `RegisterServerManager` now really falls back to a `Sign`, then `None`, LDS endpoint when the LDS
    offers no `SignAndEncrypt` endpoint; the fallback filtered an already-empty list and could never
    select anything
  - `OPCUADiscoveryServer.shutdown()` no longer sleeps one second after the endpoints are closed; the
    endpoint shutdown already waits for the listening socket to be released

Private key passphrase protection
==================================

  - opt-in private-key-at-rest protection, built on `node-opcua-pki` 6.20.0 / `node-opcua-crypto` 5.6.0
    - `OPCUACertificateManagerOptions.privateKeyPassphrase` (`string | () => Promise<string>`) encrypts the
      managed private key (PKCS#8, aes-256-cbc); an existing plaintext key is re-encrypted in place on
      `initialize()`, an existing encrypted key requires the same passphrase or fails closed
    - `OPCUACertificateManagerOptions.privateKeyProvider` sources the private key from elsewhere entirely
      (HSM, KMS, ...)
    - `OPCUACertificateManager.getPrivateKey()` resolves (and caches) the decrypted key asynchronously
    - `OPCUAServer` / `OPCUAClient` resolve the key once, asynchronously, during initialization — every
      later, synchronous `getPrivateKey()` call (secure channel layer, endpoints, ...) uses the resolved
      key, so an encrypted key never needs a synchronous disk read
    - push certificate management (`UpdateCertificate`) writes a pushed private key already encrypted when
      the certificate manager is passphrase-protected — it is never written back to disk in clear, not even
      transiently
    - default behavior (no passphrase configured) is unchanged: the key is read and written as plaintext,
      exactly as before
    - see documentation/creating_a_server.md

Reverse Connect
===============

  - implement OPC UA Reverse Connect (Part 6 §7.1.3) on client and server
    - new `ReverseHelloMessage` / `"RHE"` transport message in node-opcua-transport
    - server: `OPCUAServerOptions.reverseConnect` dials out to clients and (re)sends ReverseHello with backoff
    - client: `ClientReverseConnect` listener + `client.connectReverse(reverseConnect, expectation?)`
    - ServerUri/EndpointUrl validation and DoS guards on the client listener
    - see documentation/reverse_connect.md and the reverse_connect_{client,server}.ts samples

version 0.41
============

call service:
-------------

  - #25 add Call service support on client and server
  - #25 add engine.addMethod so that new method can be added to the address space

subscription service:
---------------------

  - implement SetMonitoringMode Request/Response
  - fixes RepublishResponse behavior on server
  - make sure monitoredItem timer func is not called if timer has been shutdown
  - #25 implement GetMonitoredItems method on Server Object

session service:
----------------

  - add ability to restrict number of concurrent sessions on server.
 -  make sure running sessions are automatically discarded after the timeout period has been reached without any activity from the client. (sessionTimeout)

read service:
-------------

  - #34, #35 Add asynchronous value read/write capability on server side

data access:
------------

  - start implementation of DataAccess (Part 8)
  - add some standard units for EUInformation
  - AxisInformation
  - add addAnalogDataItem to create DA node in address space

usability:
----------

  - #48  provides a way to pass specify serverInfo and buildInfo as options to OPCUAServer
  - #50 add flexible ways to specify typeDefinition and dataType in engine.addressSpace.addVariable
  - expose transactionCount Variables on VendorServerInfo
  - expose bytesWritten and bytesRead Variables on VendorServerInfo
  - use fully qualified domain name (fqdn), whenever possible, to build default endpoint urn instead of hostname only.
  - #40, set timeoutHint to non zero value to cope with servers that wrongly assume that timeoutHint =0 is 0s ( instead of 'no timeout' as per spec)

bug fixing
----------

  - fix various issues with secure connection
  - fix issue in TranslateBrowsePath
  - #42 GUID : permit lower case letters in GUID strings
  - fix high low inversion in Int64 encoding
  - #36 handle HEL messages received by server that are received in small chunks
  - #36 handle samplingInterval === -1 in CreateMonitoredItem Request


Contributors:
-------------

* special thanks to limjunliang, longtranphu2006, paragonRobotics, Diti24, yping, anson2004, Jochen1980, MackyNacky


version 0.40
============

  - #17 add support for Sign and Encrypt
  - #17 add ability for server to specify which endpoint to expose
  - #20 fix nodecrawler missing resultMask
  - #21 Add the ability to handle a specific source timestamp on variable
  - #23 clamp monitored item samplingInterval
  - #24 ServerSecureChannelLayer timeout between message was too short and is now be configurable

Contributors:
-------------

* special thanks: trongtin, ChrisJansson ,VincentGijsen, longtranphu2006


