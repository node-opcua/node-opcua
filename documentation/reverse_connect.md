# OPC UA Reverse Connect

## What it is and why

In a normal OPC UA connection the **client** opens the TCP socket to the server. With **Reverse
Connect** the roles for opening the socket are inverted: the **server** dials out to the client and
sends a `ReverseHello` message; the client then establishes the SecureChannel over that socket.

This is defined in **OPC UA Part 6 §7.1.3** and is valuable when the server sits inside a protected
network (a factory production network, behind a firewall/NAT) with **no inbound ports open**, yet
still needs to expose data to a client in a less-trusted zone. Only the *server* has to be allowed
to make an outbound connection.

Everything above the transport (SecureChannel, Session, Subscriptions, …) is unchanged — only who
dials the socket and the initial `ReverseHello` differ.

## How it works

```
SERVER (behind firewall)                         CLIENT (has a public listener)
        │  1. open TCP socket ───────────────────────────►  accept
        │  2. ReverseHello (RHE) ────────────────────────►  read + validate ServerUri/EndpointUrl
        │            ◄──────────────────────────  3. Hello (HEL)
        │  4. Acknowledge (ACK) ─────────────────────────►
        │            ◄──────────────────────────  5. OpenSecureChannel
        │  ... normal Session / Read / Subscribe from here ...
```

The `ReverseHello` (`RHE`) message carries two fields (both `String`, max 4096 bytes):

- **`ServerUri`** – the server's `ApplicationUri`.
- **`EndpointUrl`** – the URL the client uses to establish the SecureChannel.

## Security considerations (OPC UA Part 2 §6.14)

Because the server opens the socket, reverse connect adds a denial-of-service surface on the client
that a normal (client-initiated) connection does not have. node-opcua mitigates this in the
`ClientReverseConnect` listener:

- Every inbound `ReverseHello` is validated against a `ReverseConnectExpectation`
  (`serverUri` / `endpointUrl`). **Always pass an expectation in production** so only the servers
  you expect can connect.
- Sockets that do not send a valid `ReverseHello` within `acceptTimeout` (default 2 min) are closed.
- The number of un-validated pending sockets is capped by `maxPendingSockets`.

Normal OPC UA security (message security mode, certificate trust, user authentication) is still
enforced afterwards on the SecureChannel. For a **secured** reverse connection the client must be
given the server certificate up front (`serverCertificate` option), since it cannot dial the server
to fetch it.

## Server configuration

Add a `reverseConnect` block to `OPCUAServerOptions`. All fields but `connections` are optional and,
when the whole block is omitted, the server behaves exactly as before (no outbound dialing).

```ts
import { OPCUAServer } from "node-opcua";

const server = new OPCUAServer({
    port: 26543,
    reverseConnect: {
        // the client reverse-connect listeners the server dials into
        connections: [{ endpointUrl: "opc.tcp://client-host:6666" }],
        reconnectDelay: 5000,      // delay before re-dialing after a drop (default 5000 ms)
        maxReconnectDelay: 60000,  // upper bound for exponential backoff (default 60000 ms)
        connectionTimeout: 120000  // give up waiting for the client's HEL after this (default 120000 ms)
    }
});
await server.start();
```

The server keeps one waiting connection per target: if the socket closes without a SecureChannel, or
the SecureChannel is later aborted, it recreates the socket and re-sends a `ReverseHello` after the
(exponentially-backed-off) delay.

## Limitations

- **Single endpoint / security policy.** The server always dials out from its first endpoint
  (`endpoints[0]`) and advertises a single `EndpointUrl` (from `getEndpointUrl()`) in the
  `ReverseHello`. A server exposing multiple endpoints or several security policies cannot let the
  client select among them over reverse connect — the client gets exactly the one endpoint the server
  advertises. If you need a specific security policy on a reverse connection, configure that policy on
  the server's primary endpoint.
- **Startup race.** If the manager tries to dial before the server's endpoints are ready, it retries
  after a fixed short delay (`reconnectDelay`) and does not inflate the drop backoff.

## Client usage

Open a `ClientReverseConnect` listener and let one or more clients wait on it, matched by
`ServerUri` / `EndpointUrl`:

```ts
import { ClientReverseConnect, OPCUAClient } from "node-opcua";

const reverseConnect = new ClientReverseConnect("opc.tcp://0.0.0.0:6666");
await reverseConnect.start();

const client = OPCUAClient.create({ endpointMustExist: false });

// blocks until an expected server dials in and sends its ReverseHello
await client.connectReverse(reverseConnect, { serverUri: "urn:the-server:ApplicationUri" });

const session = await client.createSession();
// ... use the session normally ...
```

`connectReverse` is "sticky": after a drop it automatically re-accepts the server's next dial-in, so
you do not need to call it again on reconnection.

## Running on a single machine

The client binds its listener to `127.0.0.1:<port>` and the server dials
`opc.tcp://127.0.0.1:<port>`. See the runnable samples:

- `packages/node-opcua-samples/bin/reverse_connect_client.ts`
- `packages/node-opcua-samples/bin/reverse_connect_server.ts`

Start the **client first** (it opens the listener), then the server.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `connectReverse` never resolves | No server is dialing in, or the `ServerUri`/`EndpointUrl` expectation does not match the server's `ReverseHello`. |
| Client receives `Bad_ServerTooBusy` / connection dropped | No client was waiting for that server within `matchTimeout`, or `maxPendingSockets` was exceeded. |
| Client rejects with `Bad_TcpEndpointUrlInvalid` | The `ReverseHello` fields are malformed or exceed the 4096-byte limit. |
| Server keeps re-dialing | The client listener is not started, a firewall blocks the outbound dial, or the client never sends `HEL`. |
| Session read fails with a URL mismatch | The server's advertised `EndpointUrl` (from `getEndpointUrl()`) does not match its own endpoints — check the server hostname/port configuration. |

## Interoperability

Reverse connect is a wire-level, spec-defined handshake. node-opcua's implementation is designed to
interoperate with other stacks that support it (e.g. the OPC Foundation UA-.NETStandard
`ReverseConnect` sample and open62541). Both directions should work: a node-opcua server dialing a
third-party reverse-connect client, and a node-opcua reverse-connect client accepting a dial-in from
a third-party server.
