# node-opcua-packet-assembler

A high-performance packet assembler for reassembling fragmented data from transport layers into complete message chunks. Features **zero-copy optimization** for maximum performance.

## Installation

```bash
npm install node-opcua-packet-assembler
```

## Quick Start

```typescript
import { PacketAssembler } from "node-opcua-packet-assembler";

// Create assembler
const assembler = new PacketAssembler({
    readChunkFunc: (data) => ({
        length: data.readUInt32LE(4),
        messageHeader: {
            msgType: data.toString("ascii", 0, 4),
            isFinal: "F",
            length: data.readUInt32LE(4)
        },
        extra: ""
    }),
    minimumSizeInBytes: 8,
    maxChunkSize: 65536
});

// Listen for complete chunks
assembler.on("chunk", (chunk) => {
    console.log("Complete chunk:", chunk.length, "bytes");
    processMessage(chunk);
});

// Feed data from transport
socket.on("data", (data) => assembler.feed(data));
```

## Key Features

### Zero-Copy Performance

- **Single-chunk messages**: Returns buffer views without copying (fast!)
- **Multi-chunk messages**: Concatenates fragments safely with `Buffer.concat()`
- Optimized for the common case where complete messages arrive in one buffer

### Event-Driven API

```typescript
// Track chunk assembly progress
assembler.on("startChunk", (packetInfo, partial) => {
    console.log(`Starting chunk: ${packetInfo.length} bytes`);
});

// Process complete chunks
assembler.on("chunk", (chunk) => {
    handleMessage(chunk);
});

// Handle errors
assembler.on("error", (error, errorCode) => {
    console.error("Assembly error:", error.message);
});
```

## Important: Buffer Lifetime

⚠️ **When using zero-copy buffers, YOU are responsible for buffer lifetime management.**

### ✅ Safe Usage

```typescript
assembler.on("chunk", (chunk) => {
    // Option 1: Process immediately
    const value = chunk.readUInt32LE(0);
    console.log("Value:", value);

    // Option 2: Make a copy if storing
    const copy = Buffer.from(chunk);
    messageQueue.push(copy);
});
```

### ❌ Unsafe Usage

```typescript
const storedChunks = [];

assembler.on("chunk", (chunk) => {
    // UNSAFE! Transport may reuse this buffer
    storedChunks.push(chunk);
});
```

**Rule of thumb**: If you store buffers beyond immediate processing or pass them to async handlers, create a copy with `Buffer.from(chunk)`.

## API Overview

For complete API documentation with TypeScript types and detailed examples, see the source code JSDoc comments.

### Constructor

```typescript
new PacketAssembler(options: PacketAssemblerOptions)
```

| Option               | Type                           | Description             |
| -------------------- | ------------------------------ | ----------------------- |
| `readChunkFunc`      | `(data: Buffer) => PacketInfo` | Extract packet metadata |
| `minimumSizeInBytes` | `number`                       | Minimum header size     |
| `maxChunkSize`       | `number`                       | Maximum chunk size      |

### Methods

- **`feed(data: Buffer)`**: Feed incoming data to the assembler

### Events

- **`"startChunk"`**: `(packetInfo, partial) => void` - New chunk detected
- **`"chunk"`**: `(chunk: Buffer) => void` - Complete chunk assembled
- **`"error"`**: `(error, errorCode) => void` - Assembly error occurred

## Common Patterns

### TCP Socket Integration

```typescript
import net from "net";

const server = net.createServer((socket) => {
    const assembler = new PacketAssembler({
        readChunkFunc: readHeader,
        minimumSizeInBytes: 8,
        maxChunkSize: 65536
    });

    assembler.on("chunk", handleMessage);
    assembler.on("error", (err) => socket.destroy());

    socket.on("data", (data) => assembler.feed(data));
});
```

### With Progress Tracking

```typescript
assembler.on("startChunk", (packetInfo) => {
    console.log(`📦 Expecting ${packetInfo.length} bytes`);
});

assembler.on("chunk", (chunk) => {
    console.log(`✅ Received ${chunk.length} bytes`);
});
```

## Error Handling

```typescript
import { PacketAssemblerErrorCode } from "node-opcua-packet-assembler";

assembler.on("error", (error, errorCode) => {
    if (errorCode === PacketAssemblerErrorCode.ChunkSizeExceeded) {
        console.error("Chunk too large:", error.message);
    }
});
```

## Performance Tips

1. **Avoid unnecessary copies**: The assembler already optimizes for zero-copy when possible
2. **Set appropriate limits**: Configure `maxChunkSize` based on your protocol needs
3. **Process immediately**: When safe, process chunks in the event handler for best performance
4. **Only copy when needed**: Create copies only when storing or passing to async handlers

## TypeScript Support

Full TypeScript definitions included. All interfaces, types, and methods are fully documented with JSDoc comments in the source code.

## Testing

```bash
npm test
```

## License

MIT

## Related Packages

- [node-opcua](https://github.com/node-opcua/node-opcua) - Main package
- `node-opcua-transport` - Transport layer
- `node-opcua-chunkmanager` - Message chunk management
