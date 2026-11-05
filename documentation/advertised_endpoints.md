# Advertised Endpoints

## Overview

When an OPC UA server runs behind Docker port-mapping, a reverse proxy,
or a NAT gateway, the **internal** endpoint URL (e.g.
`opc.tcp://0.0.0.0:4840`) differs from the **external** URL that clients
actually connect to (e.g. `opc.tcp://public.example.com:48401`).

The `advertisedEndpoints` option lets you declare additional URLs that
the server advertises in `GetEndpoints` responses. The server still
listens on `port`: these are purely virtual aliases, served by the
same socket (see the security model below).

## Basic Usage (String Shorthand)

Pass one or more URL strings. They inherit all security settings from
the main endpoint:

```typescript
const server = new OPCUAServer({
    port: 4840,
    advertisedEndpoints: "opc.tcp://public.example.com:48401"
});
```

Multiple URLs:

```typescript
const server = new OPCUAServer({
    port: 4840,
    advertisedEndpoints: [
        "opc.tcp://public.example.com:48401",
        "opc.tcp://vpn.internal:4840"
    ]
});
```

## Per-URL Security Overrides

An `AdvertisedEndpointConfig` object can make the endpoints advertised for
one URL **stricter** than the main endpoint: fewer security modes, fewer
security policies, no anonymous access, fewer user token types. Well-behaved
clients that reach the server through that URL then only see, and use, the
stricter settings.

```typescript
import { MessageSecurityMode, OPCUAServer, SecurityPolicy, UserTokenType } from "node-opcua";

const server = new OPCUAServer({
    port: 4840,
    // Main endpoint: secure modes only, user name or certificate
    securityModes: [MessageSecurityMode.Sign, MessageSecurityMode.SignAndEncrypt],
    securityPolicies: [SecurityPolicy.Basic256Sha256, SecurityPolicy.Aes256_Sha256_RsaPss],
    allowAnonymous: false,
    userTokenTypes: [UserTokenType.UserName, UserTokenType.Certificate],

    advertisedEndpoints: [
        // Docker internal name: inherits everything from above
        "opc.tcp://docker-internal:4840",

        // Public name: stricter
        {
            url: "opc.tcp://public.example.com:48401",
            securityModes: [MessageSecurityMode.SignAndEncrypt],
            userTokenTypes: [UserTokenType.Certificate]
        }
    ]
});
```

Do not rely on this to protect a weak main endpoint (for example a main
endpoint with `MessageSecurityMode.None` behind a stricter public URL): read
the security model below first.

### Available Overrides

| Field              | Type                     | Default            | Rule                              |
| ------------------ | ------------------------ | ------------------ | --------------------------------- |
| `url`              | `string`                 | **(required)**     |                                   |
| `securityModes`    | `MessageSecurityMode[]`  | inherit from main  | can only remove modes             |
| `securityPolicies` | `SecurityPolicy[]`       | inherit from main  | can only remove policies          |
| `allowAnonymous`   | `boolean`                | inherit from main  | `false` removes Anonymous; `true` cannot add it |
| `userTokenTypes`   | `UserTokenType[]`        | inherit from main  | can only remove token types       |

A value that the main endpoint does not allow is ignored, with a warning
in the log.

## Security Model

All advertised URLs are served by **one listener** (one TCP socket): that is
the point of the feature (Docker port mapping, NAT, reverse proxy). The
server sees which socket a client is connected to, but it cannot verify which
URL the client used to get there. The `endpointUrl` of the CreateSession
request is written by the client; OPC 10000-4 describes it as the address the
client used, for diagnostics and for choosing which endpoint descriptions to
return, not as a proof of where the client comes from.

What node-opcua guarantees:

- **A per-URL override can only restrict.** It never adds a mode, a policy
  or a user token type to the listener.
- **A client presenting an advertised URL** gets that URL's settings: a
  secure channel whose mode or policy that URL does not offer is refused at
  CreateSession (`BadSecurityModeRejected`, `BadSecurityPolicyRejected`), and
  a user token type it does not list is refused at ActivateSession
  (`BadIdentityTokenInvalid`).
- **A client presenting an unknown URL** (or the URL of another listener)
  gets the most restrictive settings common to all URLs of the listener it is
  connected to: the channel's mode and policy must be offered by every URL,
  and only the user token types listed by every URL are accepted.

What it does **not** guarantee:

- **A client presenting the main URL gets the main settings**, whatever path
  it really used. An internet client that reaches the public alias can
  present the internal URL (it appears in the server certificate) and get
  the main endpoint's modes, policies and token types. Per-URL overrides
  guide well-behaved clients; they are not a security boundary.

### Different security for different networks: use separate listeners

When two networks need different security, give each one its own listener
with `endpoints`, bound to its own interface with `host`. Each listener only
accepts what its own entry allows, whatever URL the client presents.

```typescript
const server = new OPCUAServer({
    endpoints: [
        {
            // exposed to the internet (or mapped by the NAT)
            host: "203.0.113.10",
            port: 4840,
            securityModes: [MessageSecurityMode.SignAndEncrypt],
            allowAnonymous: false,
            userTokenTypes: [UserTokenType.Certificate],
            advertisedEndpoints: "opc.tcp://public.example.com:4840"
        },
        {
            // plant network only
            host: "10.0.0.5",
            port: 4841,
            securityModes: [MessageSecurityMode.Sign, MessageSecurityMode.SignAndEncrypt],
            allowAnonymous: false,
            userTokenTypes: [UserTokenType.UserName, UserTokenType.Certificate]
        }
    ]
});
```

With Docker, publish only the port of the public listener.

### Strict URL matching

`OPCUAServer.requestExactEndpointUrl = true` makes CreateSession fail with
`BadServiceUnsupported` when the `endpointUrl` matches no advertised URL,
instead of using the most restrictive settings of the listener. It is a
global (static) setting, also enabled by the environment variable
`NODEOPCUA_SERVER_REQUEST_EXACT_ENDPOINT_URL`; it rejects clients that use an IP address or a name
that is not advertised, so list every name clients really use (see
`alternateHostname`). It does not change the main-URL limit above.

## IP Addresses and Hostnames

You can pass IP addresses through `alternateHostname`: the server
automatically classifies them using `net.isIP()` and places them in
the correct SAN field:

- **Hostnames** → certificate SAN `dNSName`
- **IPs** → certificate SAN `iPAddress`

```typescript
const server = new OPCUAServer({
    port: 4840,
    alternateHostname: ["my-docker-host", "192.168.1.100"],
    advertisedEndpoints: "opc.tcp://10.0.0.1:4840"
});
// Certificate SAN will include:
//   dNSName: [hostname, fqdn, "my-docker-host"]
//   iPAddress: [auto-detected IPs, "192.168.1.100", "10.0.0.1"]
```

## Certificate SAN Mismatch Warning

At startup (`initializeCM()`), the server compares the current
certificate's SAN entries against all **explicitly configured**
hostnames and IPs. If any are missing, a `[NODE-OPCUA-W26]` warning
is logged.

**Note:** auto-detected IPs (from network interfaces) are included in
the certificate at creation time but are **not** checked at startup.
This avoids noisy warnings when WiFi, tethering, or VPN interfaces
change between reboots.

To regenerate the certificate with current settings:

```typescript
await server.regenerateSelfSignedCertificate();
```

## Docker Compose Example

```yaml
version: "3.8"
services:
  opcua-server:
    build: .
    ports:
      - "48401:4840"   # Public access
    environment:
      - OPCUA_PORT=4840
      - OPCUA_ADVERTISED=opc.tcp://public.example.com:48401
    networks:
      - internal
      - public

networks:
  internal:
    internal: true
  public:
```

Server code:

```typescript
const server = new OPCUAServer({
    port: Number(process.env.OPCUA_PORT) || 4840,
    advertisedEndpoints: process.env.OPCUA_ADVERTISED
        ? process.env.OPCUA_ADVERTISED.split(",").map((url) => url.trim())
        : undefined
});
```
