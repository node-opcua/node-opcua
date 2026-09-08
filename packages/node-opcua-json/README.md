# node-opcua-json

The **OPC UA JSON encoding**, OPC 10000-6 clause 5.4: encoders and decoders for every built-in
type, for `Variant`, `DataValue` and `ExtensionObject`, across all four encoding schemes the
specification has defined.

see http://node-opcua.github.io/

```bash
npm install node-opcua-json
```

## Why

JSON is how OPC UA data leaves the OPC UA world. It is the wire form of PubSub over MQTT and
AMQP (OPC 10000-14), the form a `PubSubConfigurationDataType` is exchanged in, and the form a
`Variant` takes inside an Annex I JSON nodeset. Anywhere a value has to survive a hop through a
broker, a database or another vendor's stack, this is the encoding it travels in.

The details are easy to get subtly wrong: a `UInt64` is a string, not a number; a NodeId carries
a namespace **URI**, not the index it had in the source document; and the field names changed
between 1.04 and 1.05. This package is the single place the SDK implements clause 5.4, so every
consumer agrees on those answers.

## Quick start

```ts
import { DataType, Variant } from "node-opcua-variant";
import { JsonEncodingScheme, opcuaJsonEncodeVariant } from "node-opcua-json";

const namespaceArray = ["http://opcfoundation.org/UA/"];
const v = new Variant({ dataType: DataType.Byte, value: 42 });

opcuaJsonEncodeVariant(v, JsonEncodingScheme.Compact, namespaceArray);
// { UaType: 3, Value: 42 }

opcuaJsonEncodeVariant(v, JsonEncodingScheme.DeprecatedReversible, namespaceArray);
// { Type: 3, Body: 42 }

opcuaJsonEncodeVariant(v, JsonEncodingScheme.DeprecatedNonReversible, namespaceArray);
// 42
```

The `namespaceArray` is not decoration. NodeIds and QualifiedNames encode with their namespace
URI, so both directions need the document's namespace table to map an index to a URI and back.
Pass the array the document declares, not the one your address space happens to have.

## The four schemes

Part 6 has changed JSON encoding once, and both generations are in the field, so both are here.

| `JsonEncodingScheme` | version | a `Variant` looks like |
|---|---|---|
| `DeprecatedNonReversible` | 1.04 | the bare value, with no type at all |
| `DeprecatedReversible` | 1.04 | `{ Type, Body, Dimensions? }` |
| `Verbose` | 1.05 | `{ UaType, Value, UaDimensions? }`, every field written |
| `Compact` | 1.05 | the same, with every field equal to its type's default omitted |

`JsonEncoderMode104` (`Reversible` / `NonReversible`) and `JsonEncoderMode105` (`Verbose` /
`Compact`) are aliases into that same enum, so a 1.05-only API can take a parameter that cannot
express a 1.04 mode. `toJsonEncodingScheme()` widens either back.

Two consequences worth knowing before you diff output against another stack:

- The 1.05 field names are `UaType` / `Value` / `UaDimensions`. They changed with the encoding,
  so a 1.05 reader will not find `Type` or `Body`.
- `Compact` omits defaults, so a `Byte` of `0` encodes as `{ UaType: 3 }` with no `Value` at all,
  while `Verbose` writes `{ UaType: 3, Value: 0 }`. Decoding is unaffected; byte-for-byte
  comparison against a Verbose writer is not.

When a PubSub subscriber has to work out which scheme it is being sent,
`JsonDataSetMessageContentMaskToJsonEncodingScheme` reads the two `FieldEncoding` bits of
OPC 10000-14 Table 112, and `JsonEncodingSchemeToJsonDataSetMessageContentMask` writes them.

## One edition only: `node-opcua-json/104` and `node-opcua-json/105`

The root entry point is deliberately flexible: it takes a `JsonEncodingScheme` and dispatches
to whichever edition it names. Code that speaks a single edition, such as a PubSub publisher
pinned to 1.05 or a bridge to a 1.04-only stack, is better off importing that edition directly.

```ts
import { opcuaJsonEncodeDataValue, JsonEncoderMode, type DataValueJSON } from "node-opcua-json/105";

const pojo: DataValueJSON = opcuaJsonEncodeDataValue(dataValue, JsonEncoderMode.Compact, namespaceArray);
// { UaType: 11, Value: 3.5, ... } and nothing else can come out
```

Each subpath exposes the whole API under **version-free names**: `opcuaJsonEncodeDataValue`,
`opcuaJsonDecodeVariant`, `opcuaJsonEncodeStatusCode`, `opcuaJsonEncodeNodeId`,
`opcuaJsonEncodeExtensionObject`, the `DataValueJSON` / `VariantJSON` / `NodeIdJSON` /
`ExtensionObjectJSON` types and a `JsonEncoderMode` enum, every one bound to that edition alone.
The mode parameter is the edition's own two-value enum, so a 1.04 mode is a type error in the
1.05 realm and vice versa, and the JSON types are the edition's exact shapes rather than a union.
Version-agnostic scalars (`Int64`, `ByteString`, `DateTime`, ...) are the same functions in both.

Switching an existing file from one edition to the other is a one-line change of the import
path. The root package keeps the suffixed names (`opcuaJsonEncodeDataValue104`,
`opcuaJsonEncodeVariant105`, ...) and also exposes both realms as the `v104` and `v105`
namespaces for code that has to handle both in one place.

## Decoding structures

Decoding a `Variant` that contains a structure means constructing that structure, and only the
caller knows how to find its class. That is the whole of the `ExtensionObjectBuilder` interface:

```ts
interface ExtensionObjectBuilder {
    getExtensionObjectConstructor(dataTypeNodeId: NodeId): ExtensionObjectConstructorFuncWithSchema;
}
```

```ts
import { opcuaJsonDecodeVariant, type VariantJSON105 } from "node-opcua-json";

const variant = opcuaJsonDecodeVariant(json as VariantJSON105, builder, namespaceArray);
```

For a model with custom structures, `builder` resolves the DataType NodeId against a live
address space or a dynamically built factory. For a model with only built-in types, a builder
that throws is enough, because it is never reached.

Handing the whole thing over at once, when you already know the type:

```ts
import { PubSubConnectionDataType } from "node-opcua-types";
import { decodeOPCUA_JSON } from "node-opcua-json";

const config = decodeOPCUA_JSON(PubSubConnectionDataType, JSON.parse(text));
config.address; // a NetworkAddressUrlDataType, reconstructed from its UaTypeId
```

The test suite reads configuration files produced by the .NET stack, so this path is checked
against another implementation rather than only against itself.

## API

Every built-in type has an `opcuaJsonEncodeX` / `opcuaJsonDecodeX` pair, and each takes the
scheme, so one call site serves all four.

| area | exports |
|---|---|
| Variant | `opcuaJsonEncodeVariant`, `opcuaJsonDecodeVariant`, the `104` / `105` pairs, `VariantJSON`, `VariantJSON104`, `VariantJSON105` |
| DataValue | `opcuaJsonEncodeDataValue`, `opcuaJsonDecodeDataValue`, `opcuaJsonEncodeDataValueMQTT`, the `104` / `105` variants of all three, `DataValueJSON`, `DataValueJSON104`, `DataValueJSON105` |
| ExtensionObject | `opcuaJsonEncodeExtensionObject`, `opcuaJsonDecodeExtensionObject`, the `...Body` pair, `makeBody`, `ExtensionObjectJSON104`, `ExtensionObjectJSON105` |
| NodeId | `opcuaJsonEncodeNodeId`, `opcuaJsonDecodeNodeId`, the `ExpandedNodeId` pair, the `104` / `105` encoders, `opcuaJsonEncodeNodeIdAsString` |
| realms | `node-opcua-json/104`, `node-opcua-json/105`, and the `v104` / `v105` namespaces on the root |
| scalars | `Int64`, `UInt64`, `ByteString`, `DateTime`, `LocalizedText`, `QualifiedName`, `StatusCode` |
| structures | `decodeOPCUA_JSON`, `decodeOPCUA_JSONOld` |
| schemes | `JsonEncodingScheme`, `JsonEncoderMode104`, `JsonEncoderMode105`, `toJsonEncodingScheme`, `makeDataValueEncodingEnum`, the two `JsonDataSetMessageContentMask` converters |
| dispatch | `bodyEncodeFunctor(dataType)`, `bodyDecodeFunctor(dataType)`, `EncoderFunc`, `DecoderFunc`, `ExtensionObjectBuilder` |

`opcuaJsonEncodeVariant` and `opcuaJsonDecodeVariant` are overloaded across all four schemes and
so cannot express the 1.05 object shape for Verbose alone. Where you need that exact type, reach
for the explicit `opcuaJsonEncodeVariant105` / `opcuaJsonDecodeVariant105`, or the matching
`...104` pair.

## Position in the SDK

This package sits **low in the dependency graph**, on the type and factory packages and nothing
else. It does not depend on `node-opcua-address-space`, which is what allows the address space to
depend on it, and in turn lets
[`node-opcua-uanodeset-json`](../node-opcua-uanodeset-json) encode nodeset values with the same
codec the PubSub layer uses.

The `ExtensionObjectBuilder` parameter is the price of that position: rather than reaching for an
address space itself, the package asks the caller to resolve structures.

## Provenance and licence

This code was written for `@sterfive/node-opcua-json`, part of the node-opcua-pubsub work, and is
contributed here by its copyright holder under **MIT**, so that JSON encoding is not a licensing
question for anyone building on the SDK.

MIT
