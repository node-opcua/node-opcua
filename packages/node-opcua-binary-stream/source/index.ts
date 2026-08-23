/**
 * @module node-opcua-binary-stream
 */
import type { BinaryStream } from "./binaryStream";
import type { BinaryStreamSizeCalculator } from "./binaryStreamSizeCalculator";
export type OutputBinaryStream = BinaryStream | BinaryStreamSizeCalculator;

export * from "./binaryStream";
export * from "./binaryStreamSizeCalculator";
