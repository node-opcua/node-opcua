 /**
  * @module opcua.transport
  */

 // system requires
 import assert from "better-assert";

 import _ from "underscore";
 import util from "util";

 // opcua requires
 import { StatusCode, StatusCodes } from "lib/datamodel/opcua_status_code";
 import { BinaryStream } from "lib/misc/binaryStream";
 import { verify_message_chunk } from "lib/misc/chunk_manager";
 import { TCPErrorMessage } from "_generated_/_auto_generated_TCPErrorMessage";
 import { 
   packTcpMessage, 
   decodeMessage 
  } from "lib/nodeopcua";
 import { HelloMessage } from "_generated_/_auto_generated_HelloMessage";
 import { AcknowledgeMessage } from "_generated_/_auto_generated_AcknowledgeMessage";
 import utils from "lib/misc/utils";

 import { TCP_transport } from "lib/transport/tcp_transport";


 const hexDump = utils.hexDump;
 const debugLog = utils.make_debugLog(__filename);
 const doDebug = utils.checkDebugFlag(__filename);


 require("requirish")._(module);


 /**
  * @class ServerTCP_transport
  * @extends TCP_transport
  * @constructor
  *
  */
 class ServerTCP_transport extends TCP_transport {
   _abortWithError(statusCode, extraErrorDescription, callback) {
     assert(statusCode instanceof StatusCode);
     assert(_.isFunction(callback), "expecting a callback");

     const self = this;

       /* istanbul ignore else */
     if (!self.__aborted) {
       self.__aborted = 1;
           // send the error message and close the connection
       assert(Object.keys(StatusCodes).includes(statusCode.name));

       debugLog(" Server aborting because ".red + statusCode.name.cyan);
       debugLog(" extraErrorDescription   ".red + extraErrorDescription.cyan);
       const errorResponse = new TCPErrorMessage({ statusCode, reason: statusCode.description });
       const messageChunk = packTcpMessage("ERR", errorResponse);

       self.write(messageChunk);
       self.disconnect(() => {
         self.__aborted = 2;
         callback(new Error(`${extraErrorDescription} StatusCode = ${statusCode.name}`));
       });
     } else {
       console.log("xxx ignoring ", statusCode.name);
       callback(new Error(statusCode.name));
     }
   }

   _send_ACK_response(helloMessage) {
     const self = this;

     self.receiveBufferSize = clamp_value(helloMessage.receiveBufferSize, 8196, 512 * 1024);
     self.sendBufferSize    = clamp_value(helloMessage.sendBufferSize,    8196, 512 * 1024);
     self.maxMessageSize    = clamp_value(helloMessage.maxMessageSize,  100000, 16 * 1024 * 1024);
     self.maxChunkCount     = clamp_value(helloMessage.maxChunkCount,        0, 65535);

     const acknowledgeMessage = new AcknowledgeMessage({
       protocolVersion:   self.protocolVersion,
       receiveBufferSize: self.receiveBufferSize,
       sendBufferSize:    self.sendBufferSize,
       maxMessageSize:    self.maxMessageSize,
       maxChunkCount:     self.maxChunkCount
     });

     const messageChunk = packTcpMessage("ACK", acknowledgeMessage);

       /* istanbul ignore next*/
     if (doDebug) {
       verify_message_chunk(messageChunk);
       debugLog(`server send: ${"ACK".yellow}`);
       debugLog(`server send: ${hexDump(messageChunk)}`);
       debugLog("acknowledgeMessage=", acknowledgeMessage);
     }

       // send the ACK reply
     self.write(messageChunk);
   }

   _install_HEL_message_receiver(callback) {
     const self = this;

     self._install_one_time_message_receiver((err, data) => {
       if (err) {
               // err is either a timeout or connection aborted ...
         self._abortWithError(StatusCodes.BadConnectionRejected, err.message, callback);
       } else {
               // handle the HEL message
         self._on_HEL_message(data, callback);
       }
     });
   }

   _on_HEL_message(data, callback) {
     const self = this;

     assert(data instanceof Buffer);
     assert(!self._helloreceived);

     const stream = new BinaryStream(data);
     const msgType = data.slice(0, 3).toString("ascii");

       /* istanbul ignore next*/
     if (doDebug) {
       debugLog(`SERVER received ${msgType.yellow}`);
       debugLog(`SERVER received ${hexDump(data)}`);
     }

     if (msgType === "HEL") {
       assert(data.length >= 24);

       const helloMessage = decodeMessage(stream, HelloMessage);
       assert(_.isFinite(self.protocolVersion));

           // OPCUA Spec 1.03 part 6 - page 41
           // The Server shall always accept versions greater than what it supports.
       if (helloMessage.protocolVersion !== self.protocolVersion) {
         console.log(`warning ! client sent helloMessage.protocolVersion = 0x${helloMessage.protocolVersion.toString(16)}`,` whereas server protocolVersion is 0x${self.protocolVersion.toString(16)}`);
       }
       if (helloMessage.protocolVersion === 0xDEADBEEF 
        || helloMessage.protocolVersion < self.protocolVersion) {
               // Note: 0xDEADBEEF is our special version number 
               //   to simulate BadProtocolVersionUnsupported in tests
               // invalid protocol version requested by client
         self._abortWithError(StatusCodes.BadProtocolVersionUnsupported, `Protocol Version Error${self.protocolVersion}`, callback);
       } else {
               // the helloMessage shall only be received once.
         self._helloreceived = true;

         self._send_ACK_response(helloMessage);

         callback(null); // no Error
       }
     } else {
           // invalid packet , expecting HEL
       console.log("BadCommunicationError ".red, "Expecting 'HEL' message to initiate communication");
       self._abortWithError(StatusCodes.BadCommunicationError, "Expecting 'HEL' message to initiate communication", callback);
     }
   }

   /**
    * Initialize the server transport.
    *
    *
    *  The ServerTCP_transport initialisation process starts by 
    *   waiting for the client to send a "HEL" message.
    *
    *  The  ServerTCP_transport replies with a "ACK" message and then 
    *   start waiting for further messages of any size.
    *
    *  The callback function received an error:
    *   - if no message from the client is received within the ```self.timeout``` period,
    *   - or, if the connection has dropped within the same interval.
    *   - if the protocol version specified within 
    *    the HEL message is invalid or is greater than ```self.protocolVersion```
    *
    * @method init
    * @param socket {Socket}
    * @param callback {Function}
    * @param callback.err {Error||null} err = null if init succeeded
    *
    */
   init(socket, callback) {
     assert(!this.socket, "init already called!");
     assert(_.isFunction(callback), "expecting a valid callback ");

     const self = this;

     self._install_socket(socket);

     self._install_HEL_message_receiver(callback);
   }
 }

 ServerTCP_transport.prototype.end = "DEPRECATED";

 function clamp_value(value, min_val, max_val) {
   assert(min_val < max_val);
   if (value === 0) {
     return max_val;
   }
   if (value < min_val) {
     return min_val;
   }
     /* istanbul ignore next*/
   if (value >= max_val) {
     return max_val;
   }
   return value;
 }

 export { ServerTCP_transport };
