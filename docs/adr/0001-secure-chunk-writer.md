# ADR 0001: a SecureChunkWriter per token instead of event-driven chunk managers per message

- Status: proposed
- Date: 2026-10-13
- Packages: `node-opcua-secure-channel`, `node-opcua-chunkmanager`

## Context

Every message a secure channel sends goes through `MessageChunker.chunkSecureMessage`
(`node-opcua-secure-channel/source/message_chunker.ts`). For each message it:

1. builds a `SecureMessageChunkManager` (an `EventEmitter`), which builds a `ChunkManager` (another
   `EventEmitter`) and subscribes to its `"chunk"` event;
2. subscribes to the `"chunk"` and `"finished"` events of the outer manager;
3. encodes the message into a reusable stream, then copies it into the chunk manager with `write()`;
4. lets `ChunkManager` cut chunks, call back into the outer manager to write the message header,
   security header and sequence header, pad, sign and encrypt, and re-emit each chunk through both
   emitters to the transport callback.

Everything that stays constant during the life of a token (chunk size, header sizes, signature length,
block sizes, padding rules, keys, the sequence number generator) is set up again for every message. The
only per-message inputs are the message type, the request id and the body.

Two consequences have been measured or have caused bugs:

- **Cost.** On the benchmark mini PC (Celeron J4125, Node 24, o6 harness, open62541 C client, scalar Read,
  node-opcua 2.187.7), a profile attributes about 10 us per response (under the profiler) to this
  scaffolding: the two constructors, `addListener`, `write`, `end`, `#_push_pending_chunk`,
  `#_post_process_current_chunk`, and the copies and fills around them. That is as much as the AES work
  of the same response and about a sixth of all the extra cost of Basic256Sha256 over None. Messages
  without security already avoid it: `#chunkPlainMessage` writes one chunk with its headers in place and
  no chunk manager.
- **Fragility.** The order of work is implied by the order in which listeners were attached, an
  unhandled `"error"` becomes a throw at whichever `emit()` hits it, and listeners can be removed by
  unrelated code while a message is in flight. The re-entrant HEL fix (PR 1785) dealt with that pattern on
  the receive side: a limits change stripped the live packet assembler's listeners in the middle of a feed.

The event model brings nothing here. Chunking a message is synchronous, has exactly one consumer (the
transport callback, known before the first byte is written), and finishes within one call. The one
asynchronous case is the OpenSecureChannel request or response signed by a key held in a remote HSM or KMS
(`chunkSecureMessageAsync`), and it already has its own Promise-based path. MSG and CLO messages are signed
and encrypted with symmetric keys derived locally, so they are always synchronous.

## Decision

Symmetric messages (MSG, CLO) are chunked by a `SecureChunkWriter`: one object per channel and security
token, created when the token's derived keys become active, holding everything that does not change
between messages. Writing a message is one method call with no event, no listener and no per-message
object besides the chunks themselves.

```ts
interface SecureChunkWriterOptions {
    channelId: number;
    tokenId: number;
    securityMode: MessageSecurityMode;      // None, Sign, SignAndEncrypt
    derivedKeys: DerivedKeys | null;        // the sending side's keys; null for None
    chunkSize: number;                      // negotiated in HEL/ACK
    maxMessageSize: number;                 // 0 = unlimited
    maxChunkCount: number;                  // 0 = unlimited
    sequenceNumberGenerator: SequenceNumberGenerator; // shared with the channel
}

class SecureChunkWriter {
    constructor(options: SecureChunkWriterOptions);

    /** the largest body that fits one chunk: callers may encode straight into a chunk-sized buffer */
    readonly maxBodySizePerChunk: number;

    /**
     * encodes `message` once, writes it as one or more chunks (headers in place, padding, signature,
     * encryption) and hands each chunk to `send`, in order, before returning. Returns a bad status and
     * sends nothing when the message exceeds maxMessageSize or maxChunkCount.
     */
    writeMessage(msgType: "MSG" | "CLO", requestId: number, message: BaseUAObject, send: (chunk: Buffer) => void): StatusCode;
}
```

How it works:

- **Encoding in place.** The body is encoded after room reserved for the headers, as
  `#chunkPlainMessage` does today. When it fits one chunk, the headers are written into that room, padding
  and signature follow the body, and the chunk is encrypted in place: no copy of the body. When it does
  not, each chunk gets its own buffer (the transport keeps it), its headers, its slice of the body, its
  padding, signature and encryption. One chunk is the n = 1 case of the same loop, not a separate fast path.
- **Security None** goes through the same writer with no padding, signature or encryption, which replaces
  `#chunkPlainMessage`.
- **Crypto** uses `node-opcua-crypto`'s `*WithDerivedKeys` functions, which since 6.2.2 keep a cipher,
  a decipher and a keyed HMAC per derived key. A later in-place encryption API in `node-opcua-crypto`
  would remove the last copy.
- **Token renewal.** The channel holds the writer of the token it currently sends with and replaces it
  when it switches to a new token. The rule for when the sender switches is unchanged; the writer only
  makes the token's constants explicit.
- **Sequence numbers** come from the channel's existing generator, one per chunk, as today.
- **Errors** are return values (`StatusCode`) decided before the first chunk is sent, as the size and
  chunk count checks already allow.

What does not change:

- The public API of `MessageChunker` (`chunkSecureMessage`, `chunkSecureMessageAsync`) keeps its
  signatures; its symmetric path delegates to the writer.
- OpenSecureChannel messages (asymmetric, possibly asynchronous signing) stay on the existing chunk
  managers. They are a few per channel lifetime and need the Promise-based path.
- `ChunkManager` and `SecureMessageChunkManager` stay exported and working for any code outside
  `node-opcua-secure-channel` that uses them. They are marked deprecated for symmetric messages.
- The bytes on the wire: the writer must produce exactly what the chunk managers produce today.

## Consequences

- No allocation per message besides the chunks, no listener, no dynamic dispatch through emitters. The
  profile puts the gain at about 10 us per signed or encrypted response under the profiler on the mini PC;
  the benchmark gate below measures the real figure.
- One implementation for None, Sign and SignAndEncrypt replaces the chunk managers plus the plain fast
  path, so the padding and header layout rules live in one place.
- The control flow is a loop that can be read top to bottom and stepped through in a debugger.
- Two implementations of symmetric chunking coexist until the deprecated managers are removed in a major
  version: the equivalence test below keeps them in agreement.
- The receive side is not covered. `PacketAssembler` assembles chunks from TCP data that arrive in
  arbitrary pieces, so a callback interface fits it. `MessageBuilder` (also an `EventEmitter`, per channel)
  is a candidate for the same treatment in a later ADR.

## Plan

1. **Single-chunk fast path** for Sign and SignAndEncrypt in `MessageChunker` (branch
   `perf/single-chunk-secure-message`, in progress). It is small, measurable on its own, and its
   byte-equivalence test against the chunk managers becomes the reference for step 2.
2. **`SecureChunkWriter`** for MSG and CLO, None included, with `MessageChunker` delegating to it; the
   fast path of step 1 and `#chunkPlainMessage` fold into it.
3. **Deprecate** `ChunkManager` and `SecureMessageChunkManager` for symmetric messages in the changelog;
   remove that use in the next major version.

## Verification

- **Byte equivalence.** For every security policy (Basic128Rsa15, Basic256, Basic256Sha256,
  Aes128_Sha256_RsaOaep, Aes256_Sha256_RsaPss), each mode (None, Sign, SignAndEncrypt), and body sizes on
  both sides of the one-chunk and two-chunk limits, the writer's chunks equal the chunk managers' chunks
  for the same sequence numbers. Breaking the padding computation must fail this test.
- **Round trip** through `MessageBuilder` for the same matrix, plus the maxMessageSize and maxChunkCount
  refusals.
- **The existing suites:** secure-channel package tests and the end-to-end security, session and
  subscription tests.
- **Benchmark gate** on the mini PC with the o6 harness and its C client, single-thread server, None and
  Basic256Sha256: no regression on None, a gain on Basic256Sha256 reported with the numbers in the PR.
