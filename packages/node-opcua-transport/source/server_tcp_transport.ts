/**
 * @module node-opcua-transport
 */
// tslint:disable:class-name
// system
import * as chalk from "chalk";
import { Socket } from "net";
import { assert } from "node-opcua-assert";

// opcua requires
import { BinaryStream } from "node-opcua-binary-stream";
import { verify_message_chunk } from "node-opcua-chunkmanager";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { ErrorCallback } from "node-opcua-status-code";

// this package requires
import { AcknowledgeMessage } from "./AcknowledgeMessage";
import { HelloMessage } from "./HelloMessage";
import { TCP_transport } from "./tcp_transport";
import { TCPErrorMessage } from "./TCPErrorMessage";
import { decodeMessage, packTcpMessage } from "./tools";

import * as debug from "node-opcua-debug";
import { doTraceHelloAck } from "./utils";

const hexDump = debug.hexDump;
const debugLog = debug.make_debugLog(__filename);
const errorLog = debug.make_errorLog(__filename);
const doDebug = debug.checkDebugFlag(__filename);

type CallbackFunc = (err: null | Error) => void;

function clamp_value(value: number, minVal: number, maxVal: number): number {
    assert(minVal < maxVal);
    if (value === 0) {
        return maxVal;
    }
    if (value < minVal) {
        return minVal;
    }
    /* istanbul ignore next*/
    if (value >= maxVal) {
        return maxVal;
    }
    return value;
}

const minimumBufferSize = 8192;

/**
 * @class ServerTCP_transport
 * @extends TCP_transport
 * @constructor
 *
 */
export class ServerTCP_transport extends TCP_transport {
    public static throttleTime: number = 1000;

    public receiveBufferSize: number;
    public sendBufferSize: number;
    public maxMessageSize: number;
    public maxChunkCount: number;
    public protocolVersion: number;

    private _aborted: number;
    private _helloReceived: boolean;

    constructor() {
        super();
        this._aborted = 0;
        this._helloReceived = false;
        this.receiveBufferSize = 0;
        this.sendBufferSize = 0;
        this.maxMessageSize = 0;
        this.maxChunkCount = 0;
        this.protocolVersion = 0;
    }

    protected _write_chunk(messageChunk: Buffer): void {
        if (this.sendBufferSize > 0 && messageChunk.length > this.sendBufferSize) {
            errorLog(
                "write chunk exceed sendBufferSize messageChunk length = ",
                messageChunk.length,
                "sendBufferSize = ",
                this.sendBufferSize
            );
        }
        super._write_chunk(messageChunk);
    }
    /**
     * Initialize the server transport.
     *
     *
     *  The ServerTCP_transport initialization process starts by waiting for the client to send a "HEL" message.
     *
     *  The  ServerTCP_transport replies with a "ACK" message and then start waiting for further messages of any size.
     *
     *  The callback function received an error:
     *   - if no message from the client is received within the ```self.timeout``` period,
     *   - or, if the connection has dropped within the same interval.
     *   - if the protocol version specified within the HEL message is invalid or is greater
     *     than ```self.protocolVersion```
     *
     *
     */
    public init(socket: Socket, callback: ErrorCallback) {
        if (debugLog) {
            debugLog(chalk.cyan("init socket"));
        }
        assert(!this._socket, "init already called!");
        assert(typeof callback === "function", "expecting a valid callback ");
        this._install_socket(socket);
        this._install_HEL_message_receiver(callback);
    }

    public abortWithError(statusCode: StatusCode, extraErrorDescription: string, callback: ErrorCallback) {
        return this._abortWithError(statusCode, extraErrorDescription, callback);
    }
    private _abortWithError(statusCode: StatusCode, extraErrorDescription: string, callback: ErrorCallback) {
        if (debugLog) {
            debugLog(chalk.cyan("_abortWithError"));
        }

        assert(typeof callback === "function", "expecting a callback");

        /* istanbul ignore else */
        if (!this._aborted) {
            this._aborted = 1;
            setTimeout(() => {
                // send the error message and close the connection
                assert(StatusCodes.hasOwnProperty(statusCode.name));

                /* istanbul ignore next*/
                if (doDebug) {
                    debugLog(chalk.red(" Server aborting because ") + chalk.cyan(statusCode.name));
                    debugLog(chalk.red(" extraErrorDescription   ") + chalk.cyan(extraErrorDescription));
                }

                const errorResponse = new TCPErrorMessage({
                    reason: statusCode.description,
                    statusCode
                });

                const messageChunk = packTcpMessage("ERR", errorResponse);

                this.write(messageChunk);

                this.disconnect(() => {
                    this._aborted = 2;
                    callback(new Error(extraErrorDescription + " StatusCode = " + statusCode.name));
                });
            }, ServerTCP_transport.throttleTime);
        } else {
            callback(new Error(statusCode.name));
        }
    }

    private _send_ACK_response(helloMessage: HelloMessage) {
        assert(helloMessage.receiveBufferSize >= minimumBufferSize);
        assert(helloMessage.sendBufferSize >= minimumBufferSize);

        this.receiveBufferSize = clamp_value(helloMessage.receiveBufferSize, 8192, 512 * 1024);
        this.sendBufferSize = clamp_value(helloMessage.sendBufferSize, 8192, 512 * 1024);
        this.maxMessageSize = clamp_value(helloMessage.maxMessageSize, 100000, 64 * 1024 * 1024);
        this.maxChunkCount = clamp_value(helloMessage.maxChunkCount, 0, 65535);

        // istanbul ignore next
        if (doTraceHelloAck) {
            console.log(`received Hello \n${helloMessage.toString()}`);
        }

        debugLog("Client accepts only message of size => ", this.maxMessageSize);

        const acknowledgeMessage = new AcknowledgeMessage({
            maxChunkCount: this.maxChunkCount,
            maxMessageSize: this.maxMessageSize,
            protocolVersion: this.protocolVersion,
            receiveBufferSize: this.receiveBufferSize,
            sendBufferSize: this.sendBufferSize
        });

        // istanbul ignore next
        if (doTraceHelloAck) {
            console.log(`sending Ack \n${acknowledgeMessage.toString()}`);
        }

        const messageChunk = packTcpMessage("ACK", acknowledgeMessage);

        /* istanbul ignore next*/
        if (doDebug) {
            verify_message_chunk(messageChunk);
            debugLog("server send: " + chalk.yellow("ACK"));
            debugLog("server send: " + hexDump(messageChunk));
            debugLog("acknowledgeMessage=", acknowledgeMessage);
        }

        // send the ACK reply
        this.write(messageChunk);
    }

    private _install_HEL_message_receiver(callback: ErrorCallback) {
        if (debugLog) {
            debugLog(chalk.cyan("_install_HEL_message_receiver "));
        }
        this._install_one_time_message_receiver((err?: Error | null, data?: Buffer) => {
            if (err) {
                this._abortWithError(StatusCodes.BadConnectionRejected, err.message, callback);
            } else {
                // handle the HEL message
                this._on_HEL_message(data!, callback);
            }
        });
    }

    private _on_HEL_message(data: Buffer, callback: ErrorCallback) {
        if (debugLog) {
            debugLog(chalk.cyan("_on_HEL_message"));
        }
        assert(!this._helloReceived);
        const stream = new BinaryStream(data);
        const msgType = data.slice(0, 3).toString("ascii");

        /* istanbul ignore next*/
        if (doDebug) {
            debugLog("SERVER received " + chalk.yellow(msgType));
            debugLog("SERVER received " + hexDump(data));
        }

        if (msgType === "HEL") {
            try {
                assert(data.length >= 24);
                const helloMessage = decodeMessage(stream, HelloMessage) as HelloMessage;
                assert(isFinite(this.protocolVersion));

                // OPCUA Spec 1.03 part 6 - page 41
                // The Server shall always accept versions greater than what it supports.
                if (helloMessage.protocolVersion !== this.protocolVersion) {
                    debugLog(
                        `warning ! client sent helloMessage.protocolVersion = ` +
                            ` 0x${helloMessage.protocolVersion.toString(16)} ` +
                            `whereas server protocolVersion is 0x${this.protocolVersion.toString(16)}`
                    );
                }

                if (helloMessage.protocolVersion === 0xdeadbeef || helloMessage.protocolVersion < this.protocolVersion) {
                    // Note: 0xDEADBEEF is our special version number to simulate BadProtocolVersionUnsupported in tests
                    // invalid protocol version requested by client
                    return this._abortWithError(
                        StatusCodes.BadProtocolVersionUnsupported,
                        "Protocol Version Error" + this.protocolVersion,
                        callback
                    );
                }

                // OPCUA Spec 1.04 part 6 - page 45
                // UASC is designed to operate with different TransportProtocols that may have limited buffer
                // sizes. For this reason, OPC UA Secure Conversation will break OPC UA Messages into several
                // pieces (called ‘MessageChunks’) that are smaller than the buffer size allowed by the
                // TransportProtocol. UASC requires a TransportProtocol buffer size that is at least 8 192 bytes
                if (helloMessage.receiveBufferSize < minimumBufferSize || helloMessage.sendBufferSize < minimumBufferSize) {
                    return this._abortWithError(
                        StatusCodes.BadConnectionRejected,
                        "Buffer size too small (should be at least " + minimumBufferSize,
                        callback
                    );
                }
                // the helloMessage shall only be received once.
                this._helloReceived = true;
                this._send_ACK_response(helloMessage);
            } catch (err) {
                // connection rejected because of malformed message
                return this._abortWithError(StatusCodes.BadConnectionRejected, err.message, callback);
            }
            callback(); // no Error
        } else {
            // invalid packet , expecting HEL
            /* istanbul ignore next*/
            if (doDebug) {
                debugLog(chalk.red("BadCommunicationError ") + "Expecting 'HEL' message to initiate communication");
            }
            this._abortWithError(StatusCodes.BadCommunicationError, "Expecting 'HEL' message to initiate communication", callback);
        }
    }
}
