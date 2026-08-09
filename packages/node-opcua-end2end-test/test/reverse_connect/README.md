# Reverse connect end-to-end tests — reserved TCP ports

These tests bind fixed TCP ports, so they must not collide with any other test in the repository:
the mocha suites are run in parallel, and two suites sharing a port fail intermittently with
`EADDRINUSE` (or, worse, silently talk to the wrong server).

Two ranges are **reserved for this directory only**:

| Range       | Purpose                                                        |
| ----------- | -------------------------------------------------------------- |
| `2400–2409` | OPC UA server ports (and PKI-folder discriminators)              |
| `5600–5609` | Client reverse-connect listener ports and test TCP proxy ports   |

Both ranges were empty across all `.ts`/`.js` sources when they were reserved.

## Current allocation

| Port   | File                                        | Role                             |
| ------ | ------------------------------------------- | -------------------------------- |
| `2400` | `test_e2e_reverse_connect_basic.ts`         | server                           |
| `5600` | `test_e2e_reverse_connect_basic.ts`         | client reverse listener          |
| `2401` | `test_e2e_reverse_connect_endpoint.ts`      | server                           |
| `2402` | `test_e2e_reverse_connect_reconnection.ts`  | server                           |
| `5601` | `test_e2e_reverse_connect_reconnection.ts`  | client reverse listener          |
| `5602` | `test_e2e_reverse_connect_reconnection.ts`  | TCP proxy (drops the channel)    |
| `2403` | `test_e2e_reverse_connect_secure.ts`        | server (RC-E2E-3a)               |
| `5603` | `test_e2e_reverse_connect_secure.ts`        | client reverse listener (3a)     |
| `2404` | `test_e2e_reverse_connect_secure.ts`        | server (RC-E2E-3b)               |
| `5604` | `test_e2e_reverse_connect_secure.ts`        | client reverse listener (3b)     |
| `2405` | `test_e2e_reverse_connect_secure.ts`        | client PKI folder (3a)           |
| `2406` | `test_e2e_reverse_connect_secure.ts`        | client PKI folder (3b)           |

Free within the reservation: `2407–2409`, `5605–5609`.

## Adding a test here

Take the next free value from the tables above and add a row. Before picking anything outside these
ranges, check it is unused:

```bash
grep -rnE "\b<port>\b" --include=*.ts --include=*.js packages packages_extra test_compliance \
  | grep -v node_modules | grep -v /dist/
```

Unit tests (`node-opcua-client/test/test_client_reverse_connect.ts`,
`node-opcua-server/test/test_reverse_connect_manager.ts`) need no reservation: they listen on port
`0` and read back `listeningPort`. Prefer that whenever a fixed port is not required.
