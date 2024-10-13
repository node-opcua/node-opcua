/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
/**
 * @module node-opcua-secure-channel
 */
// tslint:disable:variable-name
// tslint:disable:max-line-length
import { types } from "util";
import chalk from "chalk";

import { assert } from "node-opcua-assert";
import { decodeExpandedNodeId, decodeString } from "node-opcua-basic-types";
import { BinaryStream } from "node-opcua-binary-stream";
import {
    decryptBufferWithDerivedKeys,
    makeSHA1Thumbprint,
    PrivateKey,
    reduceLength,
    removePadding,
    verifyChunkSignatureWithDerivedKeys
} from "node-opcua-crypto/web";
import { checkDebugFlag, hexDump, make_debugLog, make_warningLog } from "node-opcua-debug";
import { BaseUAObject, getStandardDataTypeFactory } from "node-opcua-factory";
import { ExpandedNodeId, NodeId } from "node-opcua-nodeid";
import { analyseExtensionObject } from "node-opcua-packet-analyzer";
import {
    AsymmetricAlgorithmSecurityHeader,
    coerceMessageSecurityMode,
    MessageSecurityMode,
    CloseSecureChannelRequest
} from "node-opcua-service-secure-channel";
import { decodeStatusCode, StatusCodes, StatusCode } from "node-opcua-status-code";
import { MessageBuilderBase, MessageBuilderBaseOptions, StatusCodes2 } from "node-opcua-transport";
import { timestamp } from "node-opcua-utils";
import { SequenceHeader } from "node-opcua-chunkmanager";
import { doTraceChunk } from "node-opcua-transport";

import { SymmetricAlgorithmSecurityHeader } from "./secure_channel_service";
import { chooseSecurityHeader, SecurityHeader } from "./secure_message_chunk_manager";
import { asymmetricVerifyChunk, coerceSecurityPolicy, getCryptoFactory, SecurityPolicy } from "./security_policy";
import { IDerivedKeyProvider } from "./token_stack";

const debugLog = make_debugLog("SecureChannel");
const doDebug = checkDebugFlag("SecureChannel");
const warningLog = make_warningLog("SecureChannel");

const defaultObjectFactory = {
    constructObject(binaryEncodingNodeId: NodeId): BaseUAObject {
        return getStandardDataTypeFactory().constructObject(binaryEncodingNodeId);
    },
    hasConstructor(binaryEncodingNodeId: ExpandedNodeId): boolean {
        return getStandardDataTypeFactory().hasConstructor(binaryEncodingNodeId);
    }
};

export interface ObjectFactory {
    constructObject: (binaryEncodingNodeId: ExpandedNodeId) => BaseUAObject;
    hasConstructor: (binaryEncodingNodeId: ExpandedNodeId) => boolean;
}

export interface MessageBuilderOptions extends MessageBuilderBaseOptions {
    securityMode?: MessageSecurityMode;
    privateKey?: PrivateKey;
    objectFactory?: ObjectFactory;
    signatureLength?: number;
    name: string;
}

export const invalidPrivateKey = null as any as PrivateKey;

let counter = 0;

type PacketInfo = any;

export interface MessageBuilder extends MessageBuilderBase {
    on(eventName: "startChunk", eventHandler: (info: PacketInfo, data: Buffer) => void): this;
    on(eventName: "chunk", eventHandler: (chunk: Buffer) => void): this;
    on(eventName: "error", eventHandler: (err: Error, statusCode: StatusCode, requestId: number | null) => void): this;
    on(eventName: "full_message_body", eventHandler: (fullMessageBody: Buffer) => void): this;
    on(
        eventName: "message",
        eventHandler: (
            obj: BaseUAObject,
            msgType: string,
            securityHeader: SecurityHeader,
            requestId: number,
            channelId: number
        ) => void
    ): this;
    on(eventName: "abandon", eventHandler: (requestId: number) => void): this;

    on(eventName: "invalid_message", eventHandler: (obj: BaseUAObject) => void): this;
    on(eventName: "invalid_sequence_number", eventHandler: (expectedSequenceNumber: number, sequenceNumber: number) => void): this;
    on(eventName: "new_token", eventHandler: (tokenId: number) => void): this;

    once(eventName: "startChunk", eventHandler: (info: PacketInfo, data: Buffer) => void): this;
    once(eventName: "chunk", eventHandler: (chunk: Buffer) => void): this;
    once(eventName: "error", eventHandler: (err: Error, statusCode: StatusCode, requestId: number | null) => void): this;
    once(eventName: "full_message_body", eventHandler: (fullMessageBody: Buffer) => void): this;
    once(
        eventName: "message",
        eventHandler: (
            obj: BaseUAObject,
            msgType: string,
            securityHeader: SecurityHeader,
            requestId: number,
            channelId: number
        ) => void
    ): this;
    once(eventName: "abandon", eventHandler: (requestId: number) => void): this;

    once(eventName: "invalid_message", eventHandler: (obj: BaseUAObject) => void): this;
    once(
        eventName: "invalid_sequence_number",
        eventHandler: (expectedSequenceNumber: number, sequenceNumber: number) => void
    ): this;
    once(eventName: "new_token", eventHandler: (tokenId: number) => void): this;

    prependListener(eventName: "startChunk", eventHandler: (info: PacketInfo, data: Buffer) => void): this;
    prependListener(eventName: "chunk", eventHandler: (chunk: Buffer) => void): this;
    prependListener(eventName: "error", eventHandler: (err: Error, statusCode: StatusCode, requestId: number | null) => void): this;
    prependListener(eventName: "full_message_body", eventHandler: (fullMessageBody: Buffer) => void): this;
    prependListener(
        eventName: "message",
        eventHandler: (
            obj: BaseUAObject,
            msgType: string,
            securityHeader: SecurityHeader,
            requestId: number,
            channelId: number
        ) => void
    ): this;
    prependListener(eventName: "abandon", eventHandler: (requestId: number) => void): this;

    prependListener(eventName: "invalid_message", eventHandler: (obj: BaseUAObject) => void): this;
    prependListener(
        eventName: "invalid_sequence_number",
        eventHandler: (expectedSequenceNumber: number, sequenceNumber: number) => void
    ): this;
    prependListener(eventName: "new_token", eventHandler: (tokenId: number) => void): this;

    prependOnceListener(eventName: "startChunk", eventHandler: (info: PacketInfo, data: Buffer) => void): this;
    prependOnceListener(eventName: "chunk", eventHandler: (chunk: Buffer) => void): this;
    prependOnceListener(
        eventName: "error",
        eventHandler: (err: Error, statusCode: StatusCode, requestId: number | null) => void
    ): this;
    prependOnceListener(eventName: "full_message_body", eventHandler: (fullMessageBody: Buffer) => void): this;
    prependOnceListener(
        eventName: "message",
        eventHandler: (
            obj: BaseUAObject,
            msgType: string,
            securityHeader: SecurityHeader,
            requestId: number,
            channelId: number
        ) => void
    ): this;
    prependOnceListener(eventName: "abandon", eventHandler: (requestId: number) => void): this;

    prependOnceListener(eventName: "invalid_message", eventHandler: (obj: BaseUAObject) => void): this;
    prependOnceListener(
        eventName: "invalid_sequence_number",
        eventHandler: (expectedSequenceNumber: number, sequenceNumber: number) => void
    ): this;
    prependOnceListener(eventName: "new_token", eventHandler: (tokenId: number) => void): this;

    emit(eventName: "startChunk", info: PacketInfo, data: Buffer): boolean;
    emit(eventName: "chunk", chunk: Buffer): boolean;
    emit(eventName: "error", err: Error, statusCode: StatusCode, requestId: number | null): boolean;
    emit(eventName: "full_message_body", fullMessageBody: Buffer): boolean;
    emit(
        eventName: "message",
        obj: BaseUAObject,
        msgType: string,
        securityHeader: SecurityHeader,
        requestId: number,
        channelId: number
    ): boolean;
    emit(eventName: "invalid_message", object: BaseUAObject): boolean;
    emit(eventName: "invalid_sequence_number", expectedSequenceNumber: number, sequenceNumber: number): boolean;
    emit(eventName: "new_token", tokenId: number): boolean;
    emit(eventName: "abandon"): boolean;
}

/**
 */
export class MessageBuilder extends MessageBuilderBase {
    public securityPolicy: SecurityPolicy;
    public securityMode: MessageSecurityMode;
    public securityHeader?: SecurityHeader;

    protected id: string;
    readonly #objectFactory: ObjectFactory;
    #previousSequenceNumber: number;
    readonly #derivedKeyProvider: IDerivedKeyProvider;
    #privateKey: PrivateKey;

    /**
     * 
     * @param derivedKeyProvider the key for client signing verification
     * @param options 
     */
    constructor(derivedKeyProvider: IDerivedKeyProvider, options: MessageBuilderOptions) {
        super(options);

        this.#derivedKeyProvider = derivedKeyProvider;

        options = options || {};

        this.id = (options.name ? options.name : "Id") + counter++;

        this.#privateKey = options.privateKey || invalidPrivateKey;
        this.securityPolicy = SecurityPolicy.Invalid; // not known yet, we will need to call setSecurity
        this.securityMode = options.securityMode || MessageSecurityMode.Invalid; // not known yet
        this.#objectFactory = options.objectFactory || defaultObjectFactory;
        assert(
            typeof this.#objectFactory.constructObject === "function",
            " the objectFactory must provide a constructObject method"
        );
        this.#previousSequenceNumber = -1; // means unknown
        assert(isFinite(this.#previousSequenceNumber));
    }

    public setSecurity(securityMode: MessageSecurityMode, securityPolicy: SecurityPolicy): void {
        // can only be called once
        assert(this.securityMode === MessageSecurityMode.Invalid, "security already set");
        this.securityPolicy = coerceSecurityPolicy(securityPolicy);
        this.securityMode = coerceMessageSecurityMode(securityMode);
        assert(this.securityPolicy !== SecurityPolicy.Invalid);
        assert(this.securityMode !== MessageSecurityMode.Invalid);
    }

    public dispose(): void {
        super.dispose();
        this.securityHeader = undefined;
        this.#privateKey = invalidPrivateKey;
    }

    protected _read_headers(binaryStream: BinaryStream): boolean {
        if (!super._read_headers(binaryStream)) {
            return false;
        }

        // istanbul ignore next
        if (!this.messageHeader) {
            throw new Error("internal error");
        }

        try {
            const msgType = this.messageHeader.msgType;

            if (msgType === "HEL" || msgType === "ACK") {
                this.securityPolicy = SecurityPolicy.None;
            } else if (msgType === "ERR") {
                // extract Error StatusCode and additional message
                binaryStream.length = 8;
                const errorCode = decodeStatusCode(binaryStream);
                const message = decodeString(binaryStream);

                /* istanbul ignore next */
                if (doDebug) {
                    debugLog(chalk.red.bold(" ERROR RECEIVED FROM SENDER"), chalk.cyan(errorCode.toString()), message);
                    debugLog(hexDump(binaryStream.buffer));
                }
                if (doTraceChunk) {
                    warningLog(
                        timestamp(),
                        chalk.red("   >$$ "),
                        chalk.red(this.messageHeader.msgType),
                        chalk.red("nbChunk = " + this.messageChunks.length.toString().padStart(3)),
                        chalk.red("totalLength = " + this.totalMessageSize.toString().padStart(8)),
                        "l=",
                        this.messageHeader.length.toString().padStart(6),
                        errorCode.toString(),
                        message
                    );
                }
                return true;
            } else {
                this.securityHeader = chooseSecurityHeader(msgType);
                this.securityHeader.decode(binaryStream);

                if (msgType === "OPN") {
                    const asymmetricAlgorithmSecurityHeader = this.securityHeader as AsymmetricAlgorithmSecurityHeader;

                    const securityPolicyFromResponse = coerceSecurityPolicy(asymmetricAlgorithmSecurityHeader.securityPolicyUri);
                    if (securityPolicyFromResponse === SecurityPolicy.Invalid) {
                        warningLog("Invalid Security Policy", this.securityPolicy);
                        return this._report_error(StatusCodes2.BadSecurityChecksFailed, "Invalid Security Policy (1)");
                    }
                    if (this.securityPolicy === SecurityPolicy.Invalid) {
                        this.securityPolicy = securityPolicyFromResponse!;
                    }
                    if (securityPolicyFromResponse !== this.securityPolicy) {
                        warningLog("Invalid Security Policy", this.securityPolicy);
                        return this._report_error(StatusCodes2.BadSecurityChecksFailed, "Invalid Security Policy (2)");
                    }
                }

                if (!this.#_decrypt(binaryStream)) {
                    return false;
                }
                this.sequenceHeader = new SequenceHeader();
                this.sequenceHeader.decode(binaryStream);

                /* istanbul ignore next */
                if (doDebug) {
                    debugLog(" Sequence Header", this.sequenceHeader);
                }
                /* istanbul ignore next */
                if (doTraceChunk) {
                    console.log(
                        chalk.cyan(timestamp()),
                        chalk.green("   >$$ "),
                        chalk.green(this.messageHeader.msgType),
                        chalk.green("nbChunk = " + this.messageChunks.length.toString().padStart(3)),
                        chalk.green("totalLength = " + this.totalMessageSize.toString().padStart(8)),
                        "l=",
                        this.messageHeader.length.toString().padStart(6),
                        "s=",
                        this.sequenceHeader.sequenceNumber.toString().padEnd(4),
                        "r=",
                        this.sequenceHeader.requestId.toString().padEnd(4)
                    );
                }
                if (!this.#_validateSequenceNumber(this.sequenceHeader.sequenceNumber)) {
                    return false;
                }
            }
            return true;
        } catch (err) {
            warningLog(chalk.red("Error"), (err as Error).message);
            return this._report_error(StatusCodes2.BadTcpInternalError, "Internal Error " + (err as Error).message);
        }
    }

    protected override _decodeMessageBody(fullMessageBody: Buffer): boolean {
        // istanbul ignore next
        if (!this.messageHeader || !this.securityHeader) {
            return this._report_error(StatusCodes2.BadTcpInternalError, "internal error");
        }

        const msgType = this.messageHeader.msgType;
        /* istanbul ignore next */
        if (msgType === "HEL" || msgType === "ACK" || msgType === "ERR") {
            // invalid message type
            return this._report_error(StatusCodes2.BadTcpMessageTypeInvalid, "Invalid message type ( HEL/ACK/ERR )");
        }

        if (msgType === "CLO" && fullMessageBody.length === 0 && this.sequenceHeader) {
            // The Client closes the connection by sending a CloseSecureChannel request and closing the
            // socket gracefully. When the Server receives this Message, it shall release all resources
            // allocated for the channel. The body of the CloseSecureChannel request is empty. The Server
            // does not send a CloseSecureChannel response.
            const objMessage1 = new CloseSecureChannelRequest();
            this.emit("message", objMessage1, msgType, this.securityHeader, this.sequenceHeader.requestId, this.channelId);
            return true;
        }

        const binaryStream = new BinaryStream(fullMessageBody);

        // read expandedNodeId:
        let id: ExpandedNodeId;
        try {
            id = decodeExpandedNodeId(binaryStream);
        } catch (err) {
            // this may happen if the message is not well formed or has been altered
            // we better off reporting an error and abort the communication
            return this._report_error(
                StatusCodes2.BadTcpInternalError,
                "decodeExpandedNodeId " + (types.isNativeError(err) ? err.message : "")
            );
        }

        if (!this.#objectFactory.hasConstructor(id)) {
            // the datatype NodeId is not supported by the server and unknown in the factory
            // we better off reporting an error and abort the communication
            return this._report_error(StatusCodes.BadNotSupported, "cannot construct object with nodeID " + id.toString());
        }

        // construct the object
        const objMessage = this.#objectFactory.constructObject(id);

        if (!objMessage) {
            return this._report_error(StatusCodes.BadNotSupported, "cannot construct object with nodeID " + id);
        } else {
            if (this.#_safe_decode_message_body(fullMessageBody, objMessage, binaryStream)) {
                /* istanbul ignore next */
                if (doDebug) {
                    const o = objMessage as any;
                    const requestHandle = o.responseHeader
                        ? o.responseHeader.requestHandle
                        : o.requestHeader
                          ? o.requestHeader.requestHandle
                          : "";

                    debugLog(
                        this.id,
                        "message size =",
                        ("" + this.totalMessageSize).padEnd(8),
                        " body size   =",
                        ("" + this.totalBodySize).padEnd(8),
                        " requestHandle = ",
                        requestHandle,
                        objMessage.constructor.name
                    );
                }
                try {
                    /**
                     * notify the observers that a full message has been received
                     * @event message
                     * @param  objMessage the decoded message object
                     * @param  msgType the message type ( "HEL","ACK","OPN","CLO" or "MSG" )
                     * @param  the request Id
                     */
                    this.emit("message", objMessage, msgType, this.securityHeader, this.sequenceHeader!.requestId, this.channelId);
                } catch (err) {
                    // this code catches a uncaught exception somewhere in one of the event handler
                    // this indicates a bug in the code that uses this class
                    // please check the stack trace to find the problem

                    /* istanbul ignore next */
                    if (doDebug) {
                        debugLog(err);
                    }
                    warningLog(chalk.red("MessageBuilder : ERROR DETECTED IN 'message' event handler"), (err as Error).message);
                    if (types.isNativeError(err)) {
                        warningLog(err.message);
                        // warningLog(err.stack);
                    }
                }
            } else {
                warningLog("cannot decode message  for valid object of type " + id.toString() + " " + objMessage.constructor.name);
                this.emit("invalid_message", objMessage);
                debugLog(
                    this.id,
                    "message size =",
                    ("" + this.totalMessageSize).padEnd(8),
                    " body size   =",
                    ("" + this.totalBodySize).padEnd(8),
                    objMessage.constructor.name
                );
                warningLog(objMessage.toString());

                // we don't report an error here, we just ignore the message
                return false; // this._report_error(message);
            }
        }
        return true;
    }

    #_validateSequenceNumber(sequenceNumber: number): boolean {
        // checking that sequenceNumber is increasing
        assert(isFinite(this.#previousSequenceNumber));
        assert(isFinite(sequenceNumber) && sequenceNumber >= 0);

        let expectedSequenceNumber;
        if (this.#previousSequenceNumber !== -1) {
            expectedSequenceNumber = this.#previousSequenceNumber + 1;

            if (expectedSequenceNumber !== sequenceNumber) {
                const errMessage =
                    "Invalid Sequence Number found ( expected " + expectedSequenceNumber + ", got " + sequenceNumber + ")";

                /* istanbul ignore next */
                debugLog(chalk.red.bold(errMessage));
                /**
                 * notify the observers that a message with an invalid sequence number has been received.
                 * @event invalid_sequence_number
                 * @param  expected sequence Number
                 * @param  actual sequence Number
                 */
                this.emit("invalid_sequence_number", expectedSequenceNumber, sequenceNumber);
                return this._report_error(StatusCodes2.BadTcpInternalError, errMessage);
            }
            // todo : handle the case where sequenceNumber wraps back to < 1024
        }
        /* istanbul ignore next */
        if (doDebug) {
            debugLog(chalk.yellow.bold("" + this.id + " Sequence Number = "), sequenceNumber);
        }
        this.#previousSequenceNumber = sequenceNumber;
        return true;
    }

    #_decrypt_OPN(binaryStream: BinaryStream): boolean {
        assert(this.securityPolicy !== SecurityPolicy.None);
        assert(this.securityPolicy !== SecurityPolicy.Invalid);
        assert(this.securityMode !== MessageSecurityMode.None);
        assert(this.securityHeader instanceof AsymmetricAlgorithmSecurityHeader);

        const asymmetricAlgorithmSecurityHeader = this.securityHeader! as AsymmetricAlgorithmSecurityHeader;

        /* istanbul ignore next */
        if (doDebug) {
            debugLog("securityHeader = {");
            debugLog("              securityPolicyId: ", asymmetricAlgorithmSecurityHeader.securityPolicyUri);
            debugLog(
                "             senderCertificate: ",
                makeSHA1Thumbprint(asymmetricAlgorithmSecurityHeader.senderCertificate).toString("hex")
            );
            debugLog("};");
        }

        // istanbul ignore next
        if (doDebug) {
            // OpcUA part 2 V 1.02 page 15
            // 4.11 OPC UA Security Related Services
            // [...]
            // The OPC UA Client sends its Public Key in a Digital Certificate and secret information with the
            // OpenSecureChannel service Message to the Server. This Message is secured by applying
            // Asymmetric Encryption with the Server's Public Key and by generating Asymmetric Signatures with
            // the Client's Private Key. However the Digital Certificate is sent unencrypted so that the receiver can
            // use it to verify the Asymmetric Signature.
            // [...]
            //

            /* istanbul ignore next */
            debugLog(chalk.cyan("EN------------------------------"));
            // xx debugLog(hexDump(binaryStream.buffer, 32, 0xFFFFFFFF));
            debugLog("---------------------- SENDER CERTIFICATE");
            debugLog("thumbprint ", makeSHA1Thumbprint(asymmetricAlgorithmSecurityHeader.senderCertificate).toString("hex"));
        }
        // istanbul ignore next
        if (doTraceChunk) {
            const thumb = makeSHA1Thumbprint(asymmetricAlgorithmSecurityHeader.senderCertificate).toString("hex");
            warningLog(timestamp(), ` >$$ securityPolicyId:  ${asymmetricAlgorithmSecurityHeader.securityPolicyUri} ${thumb} `);
        }

        const cryptoFactory = getCryptoFactory(this.securityPolicy);
        // istanbul ignore next
        if (!cryptoFactory) {
            return this._report_error(
                StatusCodes2.BadTcpInternalError,
                " Security Policy " + this.securityPolicy + " is not implemented yet"
            );
        }

        // The message has been signed  with sender private key and has been encrypted with receiver public key.
        // We shall decrypt it with the receiver private key.
        const buf = binaryStream.buffer.subarray(binaryStream.length);

        if (asymmetricAlgorithmSecurityHeader.receiverCertificateThumbprint) {
            if (this.securityMode === MessageSecurityMode.None) {
                warningLog("receiverCertificateThumbprint is not null but securityMode is None");
            } 
            // this mean that the message has been encrypted ....

            assert(this.#privateKey !== invalidPrivateKey, "expecting a valid private key");

            try {
                const decryptedBuffer = cryptoFactory.asymmetricDecrypt(buf, this.#privateKey);
                // replace decrypted buffer in initial buffer
                decryptedBuffer.copy(binaryStream.buffer, binaryStream.length);
                // adjust length
                binaryStream.buffer = binaryStream.buffer.subarray(0, binaryStream.length + decryptedBuffer.length);
            } catch (err) {
                // Cannot asymmetrically decrypt, may be the certificate used by the other party to encrypt
                // this package is wrong
                return this._report_error(StatusCodes2.BadTcpInternalError, "Cannot decrypt OPN package " + (err as Error).message);
            }

            /* istanbul ignore next */
            if (doDebug) {
                debugLog(chalk.cyan("DE-----------------------------"));
                // debugLog(hexDump(binaryStream.buffer));
                debugLog(chalk.cyan("-------------------------------"));
                const thumbprint = makeSHA1Thumbprint(asymmetricAlgorithmSecurityHeader.senderCertificate);
                debugLog("Certificate thumbprint:", thumbprint.toString("hex"));
            }
        } else {
            if (this.securityMode !== MessageSecurityMode.None){
                return this._report_error(
                    StatusCodes2.BadTcpInternalError,
                    "Expecting a encrypted OpenSecureChannel message as securityMode is not None"
                );
            }
        }

        const chunk = binaryStream.buffer;

        const { signatureLength, signatureIsOK } = asymmetricVerifyChunk(
            cryptoFactory,
            chunk,
            asymmetricAlgorithmSecurityHeader.senderCertificate
        );

        if (!signatureIsOK) {
            /* istanbul ignore next */
            if (doDebug) {
                debugLog(hexDump(binaryStream.buffer));
            }
            return this._report_error(
                StatusCodes2.BadTcpInternalError,
                "Sign and Encrypt asymmetricVerify : Invalid packet signature"
            );
        }

        // remove signature
        binaryStream.buffer = reduceLength(binaryStream.buffer, signatureLength);

        // remove padding
        if (asymmetricAlgorithmSecurityHeader.receiverCertificateThumbprint) {
            binaryStream.buffer = removePadding(binaryStream.buffer);
        }

        return true; // success
    }

    #_decrypt_MSG(binaryStream: BinaryStream): boolean {
        // istanbul ignore next
        if (!(this.securityHeader instanceof SymmetricAlgorithmSecurityHeader)) {
            throw new Error("Internal error : expecting a SymmetricAlgorithmSecurityHeader");
        }
        assert(this.securityMode !== MessageSecurityMode.None);
        assert(this.securityMode !== MessageSecurityMode.Invalid);
        assert(this.securityPolicy !== SecurityPolicy.None);
        assert(this.securityPolicy !== SecurityPolicy.Invalid);

        const symmetricAlgorithmSecurityHeader = this.securityHeader;
        // Check  security token
        // securityToken may have been renewed
        const derivedKeys = this.#derivedKeyProvider.getDerivedKey(symmetricAlgorithmSecurityHeader.tokenId);
        // istanbul ignore next
        if (!derivedKeys || derivedKeys.signatureLength === 0) {
            this.#derivedKeyProvider.getDerivedKey(symmetricAlgorithmSecurityHeader.tokenId);
            return this._report_error(
                StatusCodes2.BadSecureChannelTokenUnknown,
                "Security token data for token " + symmetricAlgorithmSecurityHeader.tokenId + " doesn't exist"
            );
        }

        // We shall decrypt it with the receiver private key.
        const buf = binaryStream.buffer.subarray(binaryStream.length);

        if (this.securityMode === MessageSecurityMode.SignAndEncrypt) {
            const decryptedBuffer = decryptBufferWithDerivedKeys(buf, derivedKeys);

            // replace decrypted buffer in initial buffer
            decryptedBuffer.copy(binaryStream.buffer, binaryStream.length);

            // adjust length
            binaryStream.buffer = binaryStream.buffer.subarray(0, binaryStream.length + decryptedBuffer.length);

            /* istanbul ignore next */
            if (doDebug) {
                debugLog(chalk.cyan("DE-----------------------------"));
                debugLog(hexDump(binaryStream.buffer));
                debugLog(chalk.cyan("-------------------------------"));
            }
        }

        // now check signature ....
        const chunk = binaryStream.buffer;

        const signatureIsOK = verifyChunkSignatureWithDerivedKeys(chunk, derivedKeys);
        if (!signatureIsOK) {
            return this._report_error(
                StatusCodes2.BadTcpInternalError,
                "_decrypt_MSG : Sign and Encrypt (derived keys) : Invalid packet signature"
            );
        }

        // remove signature
        binaryStream.buffer = reduceLength(binaryStream.buffer, derivedKeys.signatureLength);

        if (this.securityMode === MessageSecurityMode.SignAndEncrypt) {
            // remove padding
            binaryStream.buffer = removePadding(binaryStream.buffer);
        }

        return true;
    }

    #_decrypt(binaryStream: BinaryStream) {
        // istanbul ignore next
        if (!this.messageHeader) {
            throw new Error("internal error");
        }
        const msgType = this.messageHeader.msgType;

        // istanbul ignore next
        if (msgType !== "OPN" && this.securityPolicy === SecurityPolicy.Invalid) {
            throw new Error("internal error : invalid securityPolicy" + this.securityPolicy);
        }
        // note: securityPolicy might still be Invalid when MSGType == OPN

        // check if security is active or not
        if (this.securityPolicy === SecurityPolicy.None) {
            this.securityMode = MessageSecurityMode.None;
            assert(this.securityMode === MessageSecurityMode.None, "expecting securityMode = None when securityPolicy is None");
            return true; // nothing to do
        }

        if (msgType === "OPN") {
            return this.#_decrypt_OPN(binaryStream);
        } else {
            return this.#_decrypt_MSG(binaryStream);
        }
    }

    #_safe_decode_message_body(fullMessageBody: Buffer, objMessage: any, binaryStream: BinaryStream) {
        try {
            // de-serialize the object from the binary stream
            const options = this.#objectFactory;
            objMessage.decode(binaryStream, options);
        } catch (err) {
            if (types.isNativeError(err)) {
                warningLog("Decode message error : ", err.message);

                // istanbul ignore next
                if (doDebug) {
                    debugLog(err.stack);
                    debugLog(hexDump(fullMessageBody));
                    analyseExtensionObject(fullMessageBody, 0, 0);

                    debugLog(" ---------------- block");
                    let i = 0;
                    this.messageChunks.forEach((messageChunk) => {
                        debugLog(" ---------------- chunk i=", i++);
                        debugLog(hexDump(messageChunk));
                    });
                }
            }
            return false;
        }
        return true;
    }
}
