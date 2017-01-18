/**
 * @module opcua.miscellaneous
 */
require("requirish")._(module);

import { BinaryStream } from "lib/misc/binaryStream";
import { 
  decodeNodeId, 
  decodeByte, 
  decodeUInt32, 
  decodeExpandedNodeId } from "lib/misc/encode_decode";
import { constructObject } from "lib/misc/factories_factories";
import { buffer_ellipsis } from "lib/misc/utils";
import { hexDump } from "lib/misc/utils";
import assert from "better-assert";
import util from "util";
import _ from "underscore";
import Enum from "lib/misc/enum";

const spaces = "                                                                                                                                                                             ";


function f(n, width) {
  const s = n.toString();
  return (`${s}      `).substr(0, Math.max(s.length, width));
}

function display_encoding_mask(padding, encoding_mask, encoding_info) {
  assert(encoding_info instanceof Enum);
  let bits = [];
  encoding_info.enums.forEach((enumValue) => {
    const mask = enumValue.value;
    const bit = Math.log(mask) / Math.log(2);
    bits = ['.', '.', '.', '.', '.', '.', '.', '.', '.'];
    bits[bit] = ((encoding_mask & mask) === mask) ? "Y" : "n";

    console.log(`${padding} `, bits.join(""), ` <- has ${enumValue.key}`);
  });
    // DataValueEncodingByte
}

function hex_block(start, end, buffer) {
  const n = end - start;
  const strBuf = buffer_ellipsis(buffer);
  return `${"s:".cyan + f(start, 4) + " e:".cyan + f(end, 4) + " n:".cyan + f(n, 4)} ${strBuf.yellow}`;
}


function make_tracer(buffer, padding, offset) {
  padding = padding || 0;
  offset = offset || 0;

  const pad = () => "                                                       ".substr(0, padding);

  function display(str, hex_info) {
    hex_info = hex_info || "";

        // account for ESC codes for colors
    const nbColorAttributes = _.filter(str, c => c === '\u001b').length;
    const extra = nbColorAttributes * 5;
    console.log(`${(pad() + str + spaces).substr(0, 132 + extra)}|${hex_info}`);
  }

  function display_encodeable(value, buffer, start, end) {
    const ext_buf = buffer.slice(start, end);
    const stream = new BinaryStream(ext_buf);
    const nodeId = decodeNodeId(stream);
    const encodingMask = decodeByte(stream); // 1 bin 2: xml
    const length = decodeUInt32(stream);

    display(`${"     ExpandedNodId =".green} ${nodeId}`);
    display(`${"     encoding mask =".green} ${encodingMask}`);
    display(`${"            length =".green} ${length}`);
    packet_analyzer(ext_buf.slice(stream.length), value.encodingDefaultBinary, padding + 2, start + stream.length);
  }

  const options = {

    tracer: {

      dump(title, value) {
        display(`${title}  ${value.toString().green}`);
      },

      encoding_byte(encoding_mask, valueEnum, start, end) {
        const b = buffer.slice(start, end);
        display("  012345678", hex_block(start, end, b));
        display_encoding_mask(pad(), encoding_mask, valueEnum);
      },

      trace(operation, name, value, start, end, fieldType) {
        const b = buffer.slice(start, end);
        const str = "";

        switch (operation) {

          case "start":
            padding += 2;
            display(name.toString());
            break;

          case "end":
            padding -= 2;
            break;

          case "start_array":
            display(`.${name} (length = ${value}) [`, hex_block(start, end, b));
            padding += 2;
            break;

          case "end_array":
            padding -= 2;
            display(`] // ${name}`);
            break;

          case "start_element":
            display(` #${value} {`);
            padding += 2;
            break;

          case "end_element":
            padding -= 2;
            display(` } // # ${value}`);
            break;


          case "member":
            display(`.${name} : ${fieldType}`);

            let _hexDump = "";
            if (value instanceof Buffer) {
              _hexDump = hexDump(value);
              console.log(_hexDump);
              value = "<BUFFER>";
            }
            display((` ${value}`).green, hex_block(start, end, b));

            if (value && value.encode) {
              if (fieldType === "ExtensionObject") {
                display_encodeable(value, buffer, start, end);
              } else {
                display(value.toString().green);
              }
            }
            break;
        }
      }
    }
  };

  return options;
}

/**
 * @method packet_analyzer
 * @param {Buffer} buffer
 * @param id
 * @param {Integer} padding
 * @param {Integer} offset
 * @param {Object} custom_options
 */
function packet_analyzer(buffer, id, padding, offset, custom_options) {
  const stream = new BinaryStream(buffer);

  let objMessage;
  if (!id) {
    id = decodeExpandedNodeId(stream);
  } else if (typeof id === "object" && id._schema) {
    objMessage = id;
  }

  try {
    objMessage = objMessage || constructObject(id);
  }  catch (err) {
    console.log(id);
    console.log(err);
    console.log(`Cannot read decodeExpandedNodeId  on stream ${stream._buffer.toString("hex")}`);
  }

  let options = make_tracer(buffer, padding, offset);
  options.name = "message";

  options = _.extend(options, custom_options);
  try {
    objMessage.decode_debug(stream, options);
  }  catch (err) {
    console.log(" Error in ", err);
    console.log(" Error in ", err.stack);
    console.log(" objMessage ", util.inspect(objMessage, { color: true }));
  }
}


function analyze_object_binary_encoding(obj) {
  assert(obj);

  const size = obj.binaryStoreSize();
  console.log("-------------------------------------------------");
  console.log(" size = ", size);
  const stream = new BinaryStream(size);
  obj.encode(stream);
  stream.rewind();
  console.log("-------------------------------------------------");
  if (stream._buffer.length < 256) {
    console.log(hexDump(stream._buffer));
  }
  packet_analyzer(stream._buffer, obj.encodingDefaultBinary);
}
export { analyze_object_binary_encoding };
export { packet_analyzer };

