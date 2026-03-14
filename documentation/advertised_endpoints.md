# Advertised Endpoints

## Overview

When an OPC UA server runs behind Docker port-mapping, a reverse proxy,
or a NAT gateway, the **internal** endpoint URL (e.g.
`opc.tcp://0.0.0.0:4840`) differs from the **external** URL that clients
actually connect to (e.g. `opc.tcp://public.example.com:48401`).

The `advertisedEndpoints` option lets you declare additional URLs that
the server advertises in `GetEndpoints` responses. The server still
listens on `port` — these are purely virtual aliases.

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

When different interfaces need different security requirements — for
example, a **public** endpoint that enforces `SignAndEncrypt` and
disallows anonymous access, while the **internal** endpoint allows all
modes — use `AdvertisedEndpointConfig` objects:

```typescript
import {
    MessageSecurityMode,
    OPCUAServer
} from "node-opcua";

const server = new OPCUAServer({
    port: 4840,
    // Main endpoint: all security modes, anonymous allowed
    securityModes: [
        MessageSecurityMode.None,
        MessageSecurityMode.Sign,
        MessageSecurityMode.SignAndEncrypt
    ],
    allowAnonymous: true,

    advertisedEndpoints: [
        // Internal: inherits everything from above
        "opc.tcp://docker-internal:4840",

        // Public: restricted
        {
            url: "opc.tcp://public.example.com:48401",
            securityModes: [MessageSecurityMode.SignAndEncrypt],
            allowAnonymous: false
        }
    ]
});
```

### Available Overrides

| Field              | Type                     | Default                  |
| ------------------ | ------------------------ | ------------------------ |
| `url`              | `string`                 | **(required)**           |
| `securityModes`    | `MessageSecurityMode[]`  | inherit from main        |
| `securityPolicies` | `SecurityPolicy[]`       | inherit from main        |
| `allowAnonymous`   | `boolean`                | inherit from main        |
| `userTokenTypes`   | `UserTokenType[]`        | inherit from main        |

## IP Addresses and Hostnames

You can pass IP addresses through `alternateHostname` — the server
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
