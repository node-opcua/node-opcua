/**
 * @module node-opcua-transport
 */
// tslint:disable:class-name
// system
import { types } from "util";
import chalk from "chalk";
import { assert } from "node-opcua-assert";

// opcua requires
import { checkDebugFlag, hexDump, make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";
import { BinaryStream } from "node-opcua-binary-stream";
import { verify_message_chunk } from "node-opcua-chunkmanager";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { ErrorCallback } from "node-opcua-status-code";

// this package requires
import { AcknowledgeMessage } from "./AcknowledgeMessage";
import { HelloMessage } from "./HelloMessage";
import { ISocketLike, TCP_transport } from "./tcp_transport";
import { decodeMessage, packTcpMessage } from "./tools";
import { doTraceHelloAck } from "./utils";
import { IHelloAckLimits } from "./i_hello_ack_limits";

const debugLog = make_debugLog("TRANSPORT");
const errorLog = make_errorLog("TRANSPORT");
const warningLog = make_warningLog("TRANSPORT");
const doDebug = checkDebugFlag("TRANSPORT");

function clamp_value(value: number, minVal: number, maxVal: number): number {
    assert(minVal <= maxVal);
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

export interface ITransportParameters {
    minBufferSize: number;
    maxBufferSize: number;
    minMaxMessageSize: number;
    defaultMaxMessageSize: number;
    maxMaxMessageSize: number;
    minMaxChunkCount: number;
    defaultMaxChunkCount: number;
    maxMaxChunkCount: number;
}
const defaultTransportParameters = {
    minBufferSize: 8192,
    maxBufferSize: 8 * 64 * 1024,
    minMaxMessageSize: 128 * 1024,
    defaultMaxMessageSize: 16 * 1024 * 1024,
    maxMaxMessageSize: 128 * 1024 * 1024,
    minMaxChunkCount: 1,
    defaultMaxChunkCount: Math.ceil((128 * 1024 * 1024) / (8 * 64 * 1024)),
    maxMaxChunkCount: 9000
};



export function adjustLimitsWithParameters(helloMessage: IHelloAckLimits, params: ITransportParameters): IHelloAckLimits {
    const defaultReceiveBufferSize = 64 * 1024;
    const defaultSendBufferSize = 64 * 1024;

    const receiveBufferSize = clamp_value(
        helloMessage.receiveBufferSize || defaultReceiveBufferSize,
        params.minBufferSize,
        params.maxBufferSize
    );
    const sendBufferSize = clamp_value(
        helloMessage.sendBufferSize || defaultSendBufferSize,
        params.minBufferSize,
        params.maxBufferSize
    );
    const maxMessageSize = clamp_value(
        helloMessage.maxMessageSize || params.defaultMaxMessageSize,
        params.minMaxMessageSize,
        params.maxMaxMessageSize
    );

    if (!helloMessage.maxChunkCount && sendBufferSize) {
        helloMessage.maxChunkCount = Math.ceil(helloMessage.maxMessageSize / Math.min(sendBufferSize, receiveBufferSize));
    }
    const maxChunkCount = clamp_value(
        helloMessage.maxChunkCount || params.defaultMaxChunkCount,
        params.minMaxChunkCount,
        params.maxMaxChunkCount
    );

    return {
        receiveBufferSize,
        sendBufferSize,
        maxMessageSize,
        maxChunkCount
    };
}


const defaultAdjustLimits = (hello: IHelloAckLimits) => adjustLimitsWithParameters(hello, defaultTransportParameters);
interface ServerTCP_transportOptions {
    adjustLimits?: (hello: IHelloAckLimits) => IHelloAckLimits;
}

/**
 * @private
 */
export class ServerTCP_transport extends TCP_transport {
    public static throttleTime = 1000;

    private _aborted: number;
    private _helloReceived: boolean;
    private adjustLimits: (hello: IHelloAckLimits) => IHelloAckLimits;

    constructor(options?: ServerTCP_transportOptions) {
        super();
        this._aborted = 0;
        this._helloReceived = false;

        // before HEL/ACK
        this.maxChunkCount = 1;
        this.maxMessageSize = 4 * 1024;
        this.receiveBufferSize = 4 * 1024;
        this.adjustLimits = options?.adjustLimits || defaultAdjustLimits;
    }

    public toString() {
        let str = super.toString();
        str += "helloReceived...... = " + this._helloReceived + "\n";
        str += "aborted............ = " + this._aborted + "\n";
        return str;
    }

    protected _write_chunk(messageChunk: Buffer): void {
        // istanbul ignore next
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
    public init(socket: ISocketLike, callback: ErrorCallback): void {
        // istanbul ignore next
        debugLog && debugLog(chalk.cyan("init socket"));

        assert(!this._socket, "init already called!");
        this._install_socket(socket);
        this._install_HEL_message_receiver(callback);
    }

    private _abortWithError(statusCode: StatusCode, extraErrorDescription: string, callback: ErrorCallback): void {
        // When a fatal error occurs, the Server shall send an Error Message to the Client and
        // closes the TransportConnection gracefully.
        doDebug && debugLog(this.name, chalk.cyan("_abortWithError", statusCode.toString(), extraErrorDescription));

        /* istanbul ignore next */
        if (this._aborted) {
            errorLog("Internal Er!ror: _abortWithError already called! Should not happen here");
            // already called
            return callback(new Error(statusCode.name));
        }
        this._aborted = 1;

        this._socket?.setTimeout(0);
        const err = new Error(extraErrorDescription + " StatusCode = " + statusCode.name);
        this._theCloseError = err;
        setTimeout(() => {
            // send the error message and close the connection
            this.sendErrorMessage(statusCode, statusCode.description);
            this.prematureTerminate(err, statusCode);
            this._emitClose(err);
            callback(err);
        }, ServerTCP_transport.throttleTime);
    }

    private _send_ACK_response(helloMessage: HelloMessage): void {
        assert(helloMessage.receiveBufferSize >= minimumBufferSize);
        assert(helloMessage.sendBufferSize >= minimumBufferSize);

        const limits = this.adjustLimits(helloMessage);

        this.setLimits(limits);

        // istanbul ignore next
        if (doTraceHelloAck) {
            warningLog(`received Hello \n${helloMessage.toString()}`);
            warningLog("Client accepts only message of size => ", this.maxMessageSize);
        }

        // istanbul ignore next
        doDebug && debugLog("Client accepts only message of size => ", this.maxMessageSize);

        const acknowledgeMessage = new AcknowledgeMessage({
            maxChunkCount: this.maxChunkCount,
            maxMessageSize: this.maxMessageSize,
            protocolVersion: this.protocolVersion,
            receiveBufferSize: this.receiveBufferSize,
            sendBufferSize: this.sendBufferSize
        });

        // istanbul ignore next
        doTraceHelloAck && warningLog(`sending Ack \n${acknowledgeMessage.toString()}`);

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

    private _install_HEL_message_receiver(callback: ErrorCallback): void {
        // istanbul ignore next
        doDebug && debugLog(chalk.cyan("_install_HEL_message_receiver "));

        this._install_one_time_message_receiver((err?: Error | null, data?: Buffer) => {
            if (err) {
                callback(err);
            } else {
                // pass to next stage handle the HEL message
                this._on_HEL_message(data!, callback);
            }
        });
    }

    private _on_HEL_message(data: Buffer, callback: ErrorCallback): void {
        // istanbul ignore next
        doDebug && debugLog(chalk.cyan("_on_HEL_message"));

        assert(!this._helloReceived);
        const stream = new BinaryStream(data);
        const msgType = data.subarray(0, 3).toString("utf-8");

        /* istanbul ignore next*/
        if (doDebug) {
            debugLog("SERVER received " + chalk.yellow(msgType));
            debugLog("SERVER received " + hexDump(data));
        }

        if (msgType === "HEL") {
            try {
                assert(data.length >= 24);
                const helloMessage = decodeMessage(stream, HelloMessage) as HelloMessage;

                // OPCUA Spec 1.03 part 6 - page 41
                // The Server shall always accept versions greater than what it supports.
                if (helloMessage.protocolVersion !== this.protocolVersion) {
                    // istanbul ignore next
                    doDebug &&
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
                callback(); // no Error
            } catch (err) {
                // connection rejected because of malformed message
                return this._abortWithError(
                    StatusCodes.BadConnectionRejected,
                    types.isNativeError(err) ? err.message : "",
                    callback
                );
            }
        } else {
            // invalid packet , expecting HEL
            /* istanbul ignore next*/
            doDebug && debugLog(chalk.red("BadCommunicationError ") + "Expecting 'HEL' message to initiate communication");
            this._abortWithError(StatusCodes.BadCommunicationError, "Expecting 'HEL' message to initiate communication", callback);
        }
    }
}
