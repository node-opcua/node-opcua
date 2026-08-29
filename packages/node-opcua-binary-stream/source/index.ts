/**
 * @module node-opcua-binary-stream
 */
import type { BinaryStream } from "./binaryStream.js";
import type { BinaryStreamSizeCalculator } from "./binaryStreamSizeCalculator.js";
export type OutputBinaryStream = BinaryStream | BinaryStreamSizeCalculator;

export * from "./binaryStream.js";
export * from "./binaryStreamSizeCalculator.js";
