/**
 * @module node-opcua-binary-stream
 */
import { BinaryStream } from "./binaryStream";
import { BinaryStreamSizeCalculator } from "./binaryStreamSizeCalculator";
export type OutputBinaryStream = BinaryStream | BinaryStreamSizeCalculator;

export * from "./binaryStream";
export * from "./binaryStreamSizeCalculator";
