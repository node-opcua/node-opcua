# node-opcua

The most complete OPC UA stack for Node.js and the browser, written in TypeScript.

[![NPM version](https://img.shields.io/npm/v/node-opcua)](https://www.npmjs.com/package/node-opcua)
[![Node.js CI](https://github.com/node-opcua/node-opcua/actions/workflows/workflow.yml/badge.svg)](https://github.com/node-opcua/node-opcua/actions/workflows/workflow.yml)
[![Coverage Status](https://img.shields.io/coverallsCoverage/github/node-opcua/node-opcua)](https://coveralls.io/r/node-opcua/node-opcua)
[![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lernajs.io/)
[![The Book](https://img.shields.io/static/v1?label=the%20book&message=NodeOPCUA%20by%20example&color=blueviolet&logo=leanpub)](https://leanpub.com/node-opcuabyexample-edition2024)

[![NPM download - server](https://img.shields.io/npm/dm/node-opcua.svg?logo=npm&label=node-opcua-server)](https://www.npmtrends.com/node-opcua-server)
[![NPM download - server -total](https://img.shields.io/npm/dt/node-opcua.svg?label=total)](https://www.npmtrends.com/node-opcua-server)
 
[![NPM download - client](https://img.shields.io/npm/dm/node-opcua-client.svg?logo=npm&label=node-opcua-client)](https://www.npmtrends.com/node-opcua-client)
[![NPM download - client -total](https://img.shields.io/npm/dt/node-opcua-client.svg?label=total)](https://www.npmtrends.com/node-opcua-client)

---

## Why node-opcua?

- **Full OPC UA stack** — Client, Server, Discovery, and Aggregation in a single toolkit
- **Security first** — Supports all OPC UA security policies, encrypted communication, and certificate management out of the box
- **Cross-platform** — Runs on Windows, Linux, macOS, and in the browser
- **Modular architecture** — Use only the packages you need, from a lightweight client to a full-featured server
- **Battle-tested** — Trusted in production by industrial companies worldwide
- **Well documented** — Comprehensive book, API reference, tutorials, and guided examples

## Quick Start

### Install node-opcua as an npm package

```shell
$ mkdir myproject
$ cd myproject
$ npm init
$ npm install node-opcua
```

### Try the sample server & client

```shell
$ npm install node-opcua-samples
$ ./node_modules/.bin/simple_server
```

```shell
$ ./node_modules/.bin/simple_client -e "opc.tcp://opcuademo.sterfive.com:26543"
```

## Node.js Requirement

- **Node.js 20** or above is required.

## Documentation

[![The Book](https://img.shields.io/static/v1?label=the%20book&message=NodeOPCUA%20by%20example&color=blueviolet&logo=leanpub)](https://leanpub.com/node-opcuabyexample-edition2024)

**[NodeOPCUA by Example](https://leanpub.com/node-opcuabyexample-edition2024)** — The best starting point. Dozens of practical, ready-to-use, and fully documented examples.

### Tutorials

- [Create a Server](https://github.com/node-opcua/node-opcua/blob/master/documentation/creating_a_server.md)
- [Create a Client in TypeScript](https://github.com/node-opcua/node-opcua/blob/master/documentation/creating_a_client_typescript.md)
- [Role-Based Security & User Management (OPC 10000-18)](https://github.com/node-opcua/node-opcua/blob/master/documentation/role_based_security.md)
- More advanced examples and training material are available for [NodeOPCUA Subscription members](https://support.sterfive.com)

### API Reference

- [API Documentation](https://node-opcua.github.io/api_doc/index.html)

---

## 🏢 Professional Support

Need help with your OPC UA project? Sterfive offers professional support and consulting for node-opcua.

|                           | **Community** (GitHub)    | **Professional** (Sterfive) |
|---------------------------|:------------------------:|:--------------------------:|
| GitHub Issues             | ✅                       | ✅                         |
| CVE security advisories   | After disclosure         | **Early access — patch before public disclosure** |
| Private support channel   | —                        | ✅                         |
| Extended documentation    | —                        | ✅                         |
| Guaranteed response time  | —                        | ✅                         |
| Consulting & training     | —                        | ✅                         |
| Certifiable builds        | —                        | ✅                         |

[![Professional Support](https://img.shields.io/static/v1?style=for-the-badge&label=Professional&message=Support&labelColor=blue&color=green&logo=data:image/svg%2bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2ZXJzaW9uPSIxLjEiIGlkPSJMYXllcl8xIiB4PSIwcHgiIHk9IjBweCIgdmlld0JveD0iMCAwIDQ5MS41MiA0OTEuNTIiIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgMCAwIDQ5MS41MiA0OTEuNTI7IiB4bWw6c3BhY2U9InByZXNlcnZlIj4NCjxnPg0KCTxnPg0KCQk8cGF0aCBkPSJNNDg3Ljk4OSwzODkuNzU1bC05My4xMDktOTIuOTc2Yy00LjgxMy00LjgwNi0xMi42NDItNC42NzQtMTcuMjczLDAuMzA3Yy03LjE0OCw3LjY4OS0xNC42NCwxNS41NTQtMjEuNzMsMjIuNjM0ICAgIGMtMC4yNzEsMC4yNy0wLjUwMSwwLjQ5My0wLjc2MywwLjc1NUw0NjcuMyw0MzIuNTA0YzguOTEtMTAuNjE0LDE2LjY1Ny0yMC40MSwyMS43My0yNi45NyAgICBDNDkyLjcyLDQwMC43NjIsNDkyLjI1NywzOTQuMDE5LDQ4Ny45ODksMzg5Ljc1NXoiLz4NCgk8L2c+DQo8L2c+DQo8Zz4NCgk8Zz4NCgkJPHBhdGggZD0iTTMzNC4zLDMzNy42NjFjLTM0LjMwNCwxMS4zNzktNzcuNTYsMC40MTMtMTE0LjU1NC0yOS41NDJjLTQ5LjAyMS0zOS42OTMtNzUuOTcyLTEwMi42NDItNjUuODM4LTE1MC41OTNMMzcuNjM0LDQxLjQxOCAgICBDMTcuNjUzLDU5LjQyNCwwLDc4LjU0NSwwLDkwYzAsMTQxLjc1MSwyNjAuMzQ0LDQxNS44OTYsNDAxLjUwMyw0MDAuOTMxYzExLjI5Ni0xLjE5OCwzMC4xNzYtMTguNjUxLDQ4LjA2Mi0zOC4xNjdMMzM0LjMsMzM3LjY2MSAgICB6Ii8+DQoJPC9nPg0KPC9nPg0KPGc+DQoJPGc+DQoJCTxwYXRoIGQ9Ik0xOTMuODU0LDk2LjA0MUwxMDEuMjEzLDMuNTNjLTQuMjI1LTQuMjItMTAuODgyLTQuNzI0LTE1LjY2NC0xLjE0NWMtNi42NTQsNC45ODMtMTYuNjQ4LDEyLjY1MS0yNy40NTMsMjEuNDk4ICAgIGwxMTEuOTQ1LDExMS43ODVjMC4wNjEtMC4wNiwwLjExMS0wLjExMywwLjE3Mi0wLjE3NGM3LjIzOC03LjIyOCwxNS4zNTUtMTQuODg1LDIzLjI5MS0yMi4xNjcgICAgQzE5OC41MzQsMTA4LjcxMywxOTguNjg0LDEwMC44NjMsMTkzLjg1NCw5Ni4wNDF6Ii8+DQoJPC9nPg0KPC9nPg0KPGc+DQo8L2c+DQo8Zz4NCjwvZz4NCjxnPg0KPC9nPg0KPGc+DQo8L2c+DQo8Zz4NCjwvZz4NCjxnPg0KPC9nPg0KPGc+DQo8L2c+DQo8Zz4NCjwvZz4NCjxnPg0KPC9nPg0KPGc+DQo8L2c+DQo8Zz4NCjwvZz4NCjxnPg0KPC9nPg0KPGc+DQo8L2c+DQo8Zz4NCjwvZz4NCjxnPg0KPC9nPg0KPC9zdmc+)](https://support.sterfive.com)

📧 Contact: [contact@sterfive.com](mailto:contact@sterfive.com) · 🌐 [sterfive.com](https://www.sterfive.com)

---

## Ecosystem

### AI-Powered Modeling with MCP

**[node-opcua-modeler-mcp-server](https://www.npmjs.com/package/node-opcua-modeler-mcp-server)** — An [MCP server](https://modelcontextprotocol.io) that gives AI agents access to the OPC UA companion specification type system. Discover types, resolve namespace dependencies, and look up engineering units — all from your AI coding assistant.

```bash
npx node-opcua-modeler-mcp-server
```

### OPC UA Modeler

**[OPC UA Modeler](https://opcua-modeler.sterfive.com)** — Create, validate, and generate OPC UA information models using a YAML-first workflow with full companion spec support.

## Supported Features

node-opcua implements a comprehensive set of OPC UA services, transport protocols, security policies, and server/client profiles.

👉 **[View the full supported features matrix](./supported_features.md)**

---


## Roadmap

- Improved documentation and more tutorials
- Compliance testing and certification (CTT)
- Support for redundancy
- Session-less transactions
- JTokens and OAuth

Want to influence the roadmap? [Contact Sterfive](mailto:contact@sterfive.com).

---

## :heart: Sponsors

node-opcua is funded entirely by its users. If you use node-opcua in your project, please consider supporting its continued development:

- 🌟 [**Become a sponsor on GitHub**](https://github.com/sponsors/node-opcua)

Your sponsorship ensures long-term maintenance, new features, bug fixes, and representation of the node-opcua community at the OPC Foundation.

---

## Contributors

This project exists thanks to all the people who contribute.

<a href = "https://github.com/node-opcua/node-opcua/graphs/contributors">
  <img src = "https://contrib.rocks/image?repo=node-opcua/node-opcua"/>
</a>

## Contributing

We welcome contributions! Here's how to get started with the source:

```shell
$ git clone git://github.com/node-opcua/node-opcua.git
$ cd node-opcua
$ npm install -g pnpm
$ pnpm install
$ pnpm recursive install
$ pnpm build
```

### Running the demo server from source

```shell
$ node packages/node-opcua-samples/bin/simple_server
```

### Running the demo client from source

```shell
$ node packages/node-opcua-samples/bin/simple_client.js -e "opc.tcp://opcuademo.sterfive.com:26543"
```

---

## License

node-opcua is [MIT licensed](./LICENSE).

- You can freely use it in open-source and commercial applications.
- You must include the copyright notice in all copies or substantial portions of the software.
- node-opcua comes without any warranty of any kind.

You are strongly encouraged to join the [NodeOPCUA Membership](https://support.sterfive.com) for additional benefits and support.

## Copyright

Copyright © 2014-2026 Sterfive SAS — 833264583 RCS ORLEANS — France ([sterfive.com](https://www.sterfive.com))
