import assert from 'better-assert';
import { BinaryStream } from 'lib/misc/binaryStream';
import s, { TCPErrorMessage } from 'lib/datamodel/structures';
import buffer_utils, { createFastUninitializedBuffer } from 'lib/misc/buffer_utils';
import { readMessageHeader } from 'lib/misc/message_header';

function is_valid_msg_type(msgType) {
  assert([
    "HEL", "ACK", "ERR",   // Connection Layer
    "OPN", "MSG", "CLO"    // OPC Unified Architecture, Part 6 page 36
  ].includes(msgType), `invalid message type  ${msgType}`);
  return true;
}

function decodeMessage(stream, ClassName) {
  assert(stream instanceof BinaryStream);
  assert(ClassName instanceof Function, ` expecting a function for ${ClassName}`);

  const header = readMessageHeader(stream);
  assert(stream.length === 8);

  let obj;
  if (header.msgType === "ERR") {
    obj = new TCPErrorMessage();
  } else {
    obj = new ClassName();
  }
  obj.decode(stream);
  return obj;
}

/**
 * @method encodeMessage
 * @type {{
 *     msgType: String,
 *     messageContent: Object,
 *     binaryStream: BinaryStream
 * }}
 */
const writeTCPMessageHeader = (msgType, chunkType, total_length, stream) => {
  if (stream instanceof Buffer) {
    stream = new BinaryStream(stream); // eslint-disable-line no-param-reassign
  }
  assert(is_valid_msg_type(msgType));
  assert(["A", "F", "C"].includes(chunkType));

  stream.writeUInt8(msgType.charCodeAt(0));
  stream.writeUInt8(msgType.charCodeAt(1));
  stream.writeUInt8(msgType.charCodeAt(2));
  // Chunk type
  stream.writeUInt8(chunkType.charCodeAt(0)); // reserved

  stream.writeUInt32(total_length);
};

const encodeMessage = (msgType, messageContent, stream) => {
  // the length of the message, in bytes. (includes the 8 bytes of the message header)
  const total_length = messageContent.binaryStoreSize() + 8;
  writeTCPMessageHeader(msgType, "F", total_length, stream);
  messageContent.encode(stream);
  assert(total_length === stream.length, "invalid message size");
};

function packTcpMessage(msgType, encodableObject) {
  assert(is_valid_msg_type(msgType));
  const messageChunk = createFastUninitializedBuffer(encodableObject.binaryStoreSize() + 8);
  // encode encodeableObject in a packet
  const stream = new BinaryStream(messageChunk);
  encodeMessage(msgType, encodableObject, stream);
  return messageChunk;
}

// opc.tcp://xleuri11022:51210/UA/SampleServer
function parseEndpointUrl(endpoint_url) {
  const r = /^([a-z.]*):\/\/([a-zA-Z_\-.-0-9]*):([0-9]*)(\/.*){0,1}/;
  const matches = r.exec(endpoint_url);
  if (!matches) {
    throw new Error("Invalid endpoint url ", endpoint_url);
  }
  return {
    protocol: matches[1],
    hostname: matches[2],
    port: parseInt(matches[3], 10),
    address: matches[4] || ""
  };
}

function is_valid_endpointUrl(endpointUrl) {
  const e = parseEndpointUrl(endpointUrl);
  return Object.prototype.hasOwnProperty.call(e, "hostname");
}

export { writeTCPMessageHeader };
export { TCPErrorMessage };
export { decodeMessage };
export { packTcpMessage };
export { parseEndpointUrl };
export { is_valid_endpointUrl };
