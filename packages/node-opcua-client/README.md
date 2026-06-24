# node-opcua-client

[![NPM version](https://img.shields.io/npm/v/node-opcua-client)](https://www.npmjs.com/package/node-opcua-client)
[![NPM downloads](https://img.shields.io/npm/dm/node-opcua-client.svg)](https://www.npmjs.com/package/node-opcua-client)
[![CI](https://github.com/node-opcua/node-opcua/actions/workflows/workflow.yml/badge.svg)](https://github.com/node-opcua/node-opcua/actions/workflows/workflow.yml)

**Lightweight OPC UA client for Node.js** — connect to any OPC UA server, browse, read, write, and subscribe to data changes.

Part of the [node-opcua](https://github.com/node-opcua/node-opcua) project — the most popular OPC UA stack for Node.js.

## When to use this package

| Package | Use case |
|---|---|
| **`node-opcua-client`** | You only need **client** capabilities (smaller install, faster startup) |
| **`node-opcua`** | You need **both** client and server in the same project |

## Quick Start

```bash
npm install node-opcua-client
```

> **Requires Node.js 20 or later.**

### Connect, read, and disconnect

```typescript
import {
  OPCUAClient,
  AttributeIds,
  DataValue,
} from "node-opcua-client";

(async () => {
  // 1. Create a client and connect to an OPC UA server
  const client = OPCUAClient.create({ endpointMustExist: false });
  await client.connect("opc.tcp://opcuademo.sterfive.com:26543");

  // 2. Create a session
  const session = await client.createSession();

  // 3. Read the server's current time (ns=0;i=2258)
  const dataValue: DataValue = await session.read({
    nodeId: "ns=0;i=2258",
    attributeId: AttributeIds.Value,
  });
  console.log("Server time:", dataValue.value.value);

  // 4. Clean up
  await session.close();
  await client.disconnect();
})();
```

## 📖 Documentation

- 📘 [**NodeOPCUA by Example**](https://leanpub.com/node-opcuabyexample-edition2024) — The best starting point: practical, ready-to-use examples with full explanations.
- 📚 [**API Reference**](https://node-opcua.github.io/api_doc/index.html) — Complete API documentation.
- 🛠️ [**Client Tutorial**](https://github.com/node-opcua/node-opcua/blob/master/documentation/creating_a_client_typescript.md) — Step-by-step guide to building an OPC UA client in TypeScript.

## 🏢 Professional Support

| Feature | Community (GitHub) | Professional ([Sterfive](https://support.sterfive.com)) |
|---|:---:|:---:|
| Bug reports via GitHub Issues | ✅ | ✅ |
| CVE security advisories | After disclosure | **Early access — patch before public disclosure** |
| Priority response time | — | ✅ |
| Private support channel | — | ✅ |
| Architecture & code review | — | ✅ |
| Dedicated consulting hours | — | ✅ |
| Certifiable version | — | ✅ |

[![Professional Support](https://img.shields.io/static/v1?style=for-the-badge&label=Professional&message=Support&labelColor=blue&color=green&logo=data:image/svg%2bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2ZXJzaW9uPSIxLjEiIGlkPSJMYXllcl8xIiB4PSIwcHgiIHk9IjBweCIgdmlld0JveD0iMCAwIDQ5MS41MiA0OTEuNTIiIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgMCAwIDQ5MS41MiA0OTEuNTI7IiB4bWw6c3BhY2U9InByZXNlcnZlIj4NCjxnPg0KCTxnPg0KCQk8cGF0aCBkPSJNNDg3Ljk4OSwzODkuNzU1bC05My4xMDktOTIuOTc2Yy00LjgxMy00LjgwNi0xMi42NDItNC42Sinaptik-AI/pandas-aiNzQtMTcuMjczLDAuMzA3Yy03LjE0OCw3LjY4OS0xNC42NCwxNS41NTQtMjEuNzMsMjIuNjM0ICAgIGMtMC4yNzEsMC4yNy0wLjUwMSwwLjQ5My0wLjc2MywwLjc1NUw0NjcuMyw0MzIuNTA0YzguOTEtMTAuNjE0LDE2LjY1Ny0yMC40MSwyMS43My0yNi45NyAgICBDNDkyLjcyLDQwMC43NjIsNDkyLjI1NywzOTQuMDE5LDQ4Ny45ODksMzg5Ljc1NXoiLz4NCgk8L2c+DQo8L2c+DQo8Zz4NCgk8Zz4NCgkJPHBhdGggZD0iTTMzNC4zLDMzNy42NjFjLTM0LjMwNCwxMS4zNzktNzcuNTYsMC40MTMtMTE0LjU1NC0yOS41NDJjLTQ5LjAyMS0zOS42OTMtNzUuOTcyLTEwMi42NDItNjUuODM4LTE1MC41OTNMMzcuNjM0LDQxLjQxOCAgICBDMTcuNjUzLDU5LjQyNCwwLDc4LjU0NSwwLDkwYzAsMTQxLjc1MSwyNjAuMzQ0LDQxNS44OTYsNDAxLjUwMyw0MDAuOTMxYzExLjI5Ni0xLjE5OCwzMC4xNzYtMTguNjUxLDQ4LjA2Mi0zOC4xNjdMMzM0LjMsMzM3LjY2MSAgICB6Ii8+DQoJPC9nPg0KPC9nPg0KPGc+DQoJPGc+DQoJCTxwYXRoIGQ9Ik0xOTMuODU0LDk2LjA0MUwxMDEuMjEzLDMuNTNjLTQuMjI1LTQuMjItMTAuODgyLTQuNzI0LTE1LjY2NC0xLjE0NWMtNi42NTQsNC45ODMtMTYuNjQ4LDEyLjY1MS0yNy40NTMsMjEuNDk4ICAgIGwxMTEuOTQ1LDExMS43ODVjMC4wNjEtMC4wNiwwLjExMS0wLjExMywwLjE3Mi0wLjE3NGM3LjIzOC03LjIyOCwxNS4zNTUtMTQuODg1LDIzLjI5MS0yMi4xNjcgICAgQzE5OC41MzQsMTA4LjcxMywxOTguNjg0LDEwMC44NjMsMTkzLjg1NCw5Ni4wNDF6Ii8+DQoJPC9nPg0KPC9nPg0KPGc+DQo8L2c+DQo8Zz4NCjwvZz4NCjxnPg0KPC9nPg0KPGc+DQo8L2c+DQo8Zz4NCjwvZz4NCjxnPg0KPC9nPg0KPGc+DQo8L2c+DQo8Zz4NCjwvZz4NCjxnPg0KPC9nPg0KPGc+DQo8L2c+DQo8Zz4NCjwvZz4NCjxnPg0KPC9nPg0KPGc+DQo8L2c+DQo8Zz4NCjwvZz4NCjxnPg0KPC9nPg0KPC9zdmc+)](https://support.sterfive.com)

📧 Contact: [contact@sterfive.com](mailto:contact@sterfive.com)

## :heart: Sponsors

If you find this package valuable, please consider supporting the project:

- [**Become a sponsor on GitHub**](https://github.com/sponsors/node-opcua)

Your sponsorship ensures long-term maintenance, new features, and continued OPC Foundation representation.

## License

MIT — Copyright © 2014-2026 [Etienne Rossignon](https://github.com/erossignon) / [Sterfive SAS](https://www.sterfive.com)
