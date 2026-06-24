# node-opcua

[![NPM version](https://img.shields.io/npm/v/node-opcua)](https://www.npmjs.com/package/node-opcua)
[![NPM downloads](https://img.shields.io/npm/dm/node-opcua.svg)](https://www.npmtrends.com/node-opcua)
[![Node.js CI](https://github.com/node-opcua/node-opcua/actions/workflows/workflow.yml/badge.svg)](https://github.com/node-opcua/node-opcua/actions/workflows/workflow.yml)
[![Coverage Status](https://img.shields.io/coverallsCoverage/github/node-opcua/node-opcua)](https://coveralls.io/r/node-opcua/node-opcua)

**The most complete OPC UA stack for Node.js** — build industrial-grade OPC UA servers and clients in TypeScript.

## Why node-opcua?

- 🏭 **Full OPC UA stack** — server, client, discovery, aggregation, and GDS
- 🔒 **Production-grade security** — X.509 certificates, encrypted channels, user authentication
- 🌍 **Cross-platform** — Windows, Linux, macOS, and browser (via WebSocket)
- 📦 **120+ packages** — modular architecture, use only what you need
- 🛡️ **Battle-tested** — 12+ years of development, 1,600+ GitHub stars, 3,000+ tests
- 📖 **Well documented** — *NodeOPCUA by Example* book + API reference

## Quick Start

**Requirements:** Node.js 20 or later

```bash
npm install node-opcua
```

### Create an OPC UA Server

```typescript
import { OPCUAServer, DataType, Variant } from "node-opcua";

const server = new OPCUAServer({ port: 4840 });
await server.initialize();

const addressSpace = server.engine.addressSpace!;
const namespace = addressSpace.getOwnNamespace();
namespace.addVariable({
    browseName: "Temperature",
    componentOf: addressSpace.rootFolder.objects,
    dataType: DataType.Double,
    value: { get: () => new Variant({ dataType: DataType.Double, value: 22.5 }) },
});

await server.start();
console.log("Server started at", server.getEndpointUrl());
```

### Connect as an OPC UA Client

```typescript
import { OPCUAClient, AttributeIds } from "node-opcua";

const client = OPCUAClient.create({ endpointMustExist: false });
await client.connect("opc.tcp://localhost:4840");

const session = await client.createSession();
const value = await session.read({ nodeId: "ns=1;s=Temperature", attributeId: AttributeIds.Value });
console.log("Temperature =", value.value.value);

await session.close();
await client.disconnect();
```

## 🏢 Professional Support

|                          | Community (MIT)    | Professional         |
| ------------------------ | :----------------: | :------------------: |
| Full documentation       | ✅                 | ✅ + extended docs   |
| Bug fixes                | Best effort        | **Priority SLA**     |
| CVE security advisories  | After disclosure   | **Early access — patch before public disclosure** |
| Certifiable version      | —                  | ✅                   |
| Dedicated consulting     | —                  | ✅                   |
| Custom development       | —                  | ✅                   |

[![Professional Support](https://img.shields.io/static/v1?style=for-the-badge&label=Professional&message=Support&labelColor=blue&color=green&logo=data:image/svg%2bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2ZXJzaW9uPSIxLjEiIGlkPSJMYXllcl8xIiB4PSIwcHgiIHk9IjBweCIgdmlld0JveD0iMCAwIDQ5MS41MiA0OTEuNTIiIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgMCAwIDQ5MS41MiA0OTEuNTI7IiB4bWw6c3BhY2U9InByZXNlcnZlIj4NCjxnPg0KCTxnPg0KCQk8cGF0aCBkPSJNNDg3Ljk4OSwzODkuNzU1bC05My4xMDktOTIuOTc2Yy00LjgxMy00LjgwNi0xMi42NDItNC42Sinaptik-AI/pandas-aiNzQtMTcuMjczLDAuMzA3Yy03LjE0OCw3LjY4OS0xNC42NCwxNS41NTQtMjEuNzMsMjIuNjM0ICAgIGMtMC4yNzEsMC4yNy0wLjUwMSwwLjQ5My0wLjc2MywwLjc1NUw0NjcuMyw0MzIuNTA0YzguOTEtMTAuNjE0LDE2LjY1Ny0yMC40MSwyMS43My0yNi45NyAgICBDNDkyLjcyLDQwMC43NjIsNDkyLjI1NywzOTQuMDE5LDQ4Ny45ODksMzg5Ljc1NXoiLz4NCgk8L2c+DQo8L2c+DQo8Zz4NCgk8Zz4NCgkJPHBhdGggZD0iTTMzNC4zLDMzNy42NjFjLTM0LjMwNCwxMS4zNzktNzcuNTYsMC40MTMtMTE0LjU1NC0yOS41NDJjLTQ5LjAyMS0zOS42OTMtNzUuOTcyLTEwMi42NDItNjUuODM4LTE1MC41OTNMMzcuNjM0LDQxLjQxOCAgICBDMTcuNjUzLDU5LjQyNCwwLDc4LjU0NSwwLDkwYzAsMTQxLjc1MSwyNjAuMzQ0LDQxNS44OTYsNDAxLjUwMyw0MDAuOTMxYzExLjI5Ni0xLjE5OCwzMC4xNzYtMTguNjUxLDQ4LjA2Mi0zOC4xNjdMMzM0LjMsMzM3LjY2MSAgICB6Ii8+DQoJPC9nPg0KPC9nPg0KPGc+DQoJPGc+DQoJCTxwYXRoIGQ9Ik0xOTMuODU0LDk2LjA0MUwxMDEuMjEzLDMuNTNjLTQuMjI1LTQuMjItMTAuODgyLTQuNzI0LTE1LjY2NC0xLjE0NWMtNi42NTQsNC45ODMtMTYuNjQ4LDEyLjY1MS0yNy40NTMsMjEuNDk4ICAgIGwxMTEuOTQ1LDExMS43ODVjMC4wNjEtMC4wNiwwLjExMS0wLjExMywwLjE3Mi0wLjE3NGM3LjIzOC03LjIyOCwxNS4zNTUtMTQuODg1LDIzLjI5MS0yMi4xNjcgICAgQzE5OC41MzQsMTA4LjcxMywxOTguNjg0LDEwMC44NjMsMTkzLjg1NCw5Ni4wNDF6Ii8+DQoJPC9nPg0KPC9nPg0KPGc+DQo8L2c+DQo8Zz4NCjwvZz4NCjxnPg0KPC9nPg0KPGc+DQo8L2c+DQo8Zz4NCjwvZz4NCjxnPg0KPC9nPg0KPGc+DQo8L2c+DQo8Zz4NCjwvZz4NCjxnPg0KPC9nPg0KPGc+DQo8L2c+DQo8Zz4NCjwvZz4NCjxnPg0KPC9nPg0KPGc+DQo8L2c+DQo8Zz4NCjwvZz4NCjxnPg0KPC9nPg0KPC9zdmc+)](https://support.sterfive.com)

Or [contact Sterfive](mailto:contact@sterfive.com) for dedicated consulting and enterprise needs.

## 📖 Documentation

- **[NodeOPCUA by Example](https://leanpub.com/node-opcuabyexample-edition2024)** — the definitive guide with practical, ready-to-use examples
- **[API Reference](https://node-opcua.github.io/api_doc/index.html)** — full TypeScript API documentation
- **[Tutorials](https://github.com/node-opcua/node-opcua/tree/master/documentation)** — step-by-step guides in the main repository

## Value-Added Extensions

Source-available companion modules available to [NodeOPCUA subscription members](https://support.sterfive.com) (additional fee):

| Module | Description |
| ------ | ----------- |
| **node-opcua-pub-sub** | OPC UA PubSub over MQTT (Part 14) — Industry 4.0 ready |
| **aggregator** | Combine and monitor hundreds of servers and millions of variables |
| **node-opcua-optimized-client** | High-performance OPC UA client for demanding workloads |
| **node-opcua-gds** | Global Discovery Server — certificate lifecycle at scale (Part 12) |
| **node-opcua-modeler-ex** | Programmatic OPC UA modeler |

👉 Visit [support.sterfive.com](https://support.sterfive.com) for access and pricing.

## Ecosystem

### AI-Powered Modeling with MCP

**[node-opcua-modeler-mcp-server](https://www.npmjs.com/package/node-opcua-modeler-mcp-server)** — an [MCP server](https://modelcontextprotocol.io) that gives AI agents access to the OPC UA companion specification type system. Discover types, resolve namespace dependencies, and look up engineering units.

```bash
npx node-opcua-modeler-mcp-server
```

### OPC UA Modeler

**[OPC UA Modeler](https://opcua-modeler.sterfive.com)** — create, validate, and generate OPC UA information models using a YAML-first workflow with full companion spec support.

## :heart: Sponsors

If you rely on node-opcua in production, please consider [sponsoring the project](https://github.com/sponsors/node-opcua). Your support funds long-term maintenance, new features, and representation at the OPC Foundation.

## License

MIT — Copyright (c) 2014-2026 Etienne Rossignon / [Sterfive SAS](https://www.sterfive.com)

See [LICENSE](./LICENSE) for details.
