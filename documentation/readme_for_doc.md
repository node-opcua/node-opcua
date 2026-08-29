# NodeOPCUA

**NodeOPCUA** is the most complete OPC UA stack for Node.js — build
industrial-grade OPC UA servers and clients in TypeScript.

## Quick Start

```typescript
import { OPCUAClient, AttributeIds, DataType } from "node-opcua";

const client = OPCUAClient.create({ endpointMustExist: false });
await client.connect("opc.tcp://localhost:26543");
const session = await client.createSession();

// Read the server's current time
const dataValue = await session.read({
    nodeId: "ns=0;i=2258",
    attributeId: AttributeIds.Value,
});
console.log("Server time:", dataValue.value.value);

await session.close();
await client.disconnect();
```

## Core Concepts

| Concept | Description |
|---------|-------------|
| {@link node-opcua!OPCUAClient | OPCUAClient} | Connect to OPC UA servers, create sessions, and subscribe to data |
| {@link node-opcua-server!OPCUAServer | OPCUAServer} | Create OPC UA servers with custom address spaces |
| {@link node-opcua-address-space!AddressSpace | AddressSpace} | The server's information model — add variables, objects, and methods |
| {@link node-opcua!ClientSession | ClientSession} | Read, write, browse, call methods, and manage subscriptions |
| {@link node-opcua-nodeid!NodeId | NodeId} | Unique identifier for every node in an OPC UA address space |
| {@link node-opcua-variant!Variant | Variant} | Container for typed OPC UA values |
| {@link node-opcua-data-value!DataValue | DataValue} | Value + status code + timestamps |

## Security Guides

- 🔐 [**Using an HSM/KMS-held application key**](https://github.com/node-opcua/node-opcua/blob/master/documentation/using_hsm_kms_keys.md) —
  Run node-opcua with a non-exportable private key held in an HSM, cloud KMS, or TPM.
- 🧭 [**Migrating to key operations**](https://github.com/node-opcua/node-opcua/blob/master/documentation/migrating_to_key_operations.md) —
  Before/after mapping for every deprecated or removed raw-private-key pattern.

## Learn More

- 📘 [**NodeOPCUA by Example**](https://leanpub.com/node-opcuabyexample-edition2024) —
  The best starting point: practical, ready-to-use examples with full explanations.
- 🛠️ [**GitHub Repository**](https://github.com/node-opcua/node-opcua) —
  Source code, issues, and community discussions.
- 🏢 [**Professional Support**](https://support.sterfive.com) —
  Priority support, architecture review, and consulting from [Sterfive](https://www.sterfive.com).
