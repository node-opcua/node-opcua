/**
 * @module node-opcua-secure-channel
 */
// tslint:disable:variable-name
// tslint:disable:max-line-length

import * as chalk from "chalk";

import { assert } from "node-opcua-assert";
import { decodeExpandedNodeId, decodeString } from "node-opcua-basic-types";
import { BinaryStream } from "node-opcua-binary-stream";
import {
    decryptBufferWithDerivedKeys,
    DerivedKeys,
    exploreCertificateInfo,
    makeSHA1Thumbprint,
    PrivateKeyPEM,
    reduceLength,
    removePadding,
    verifyChunkSignatureWithDerivedKeys
} from "node-opcua-crypto";
import { checkDebugFlag, hexDump, make_debugLog, make_warningLog } from "node-opcua-debug";
import { BaseUAObject, constructObject, hasConstructor } from "node-opcua-factory";
import { ExpandedNodeId, NodeId } from "node-opcua-nodeid";
import { analyseExtensionObject } from "node-opcua-packet-analyzer";
import {
    AsymmetricAlgorithmSecurityHeader,
    coerceMessageSecurityMode,
    MessageSecurityMode,
    CloseSecureChannelRequest
} from "node-opcua-service-secure-channel";
import { decodeStatusCode, coerceStatusCode, StatusCodes, StatusCode } from "node-opcua-status-code";
import { MessageBuilderBase, MessageBuilderBaseOptions, StatusCodes2 } from "node-opcua-transport";
import { timestamp } from "node-opcua-utils";
import { SequenceHeader } from "node-opcua-chunkmanager";
import { doTraceChunk } from "node-opcua-transport";

import { chooseSecurityHeader, MessageChunker, SymmetricAlgorithmSecurityHeader } from "./secure_channel_service";

import { SecurityHeader } from "./secure_message_chunk_manager";
import {
    asymmetricVerifyChunk,
    coerceSecurityPolicy,
    CryptoFactory,
    // DerivedKeys,
    fromURI,
    getCryptoFactory,
    SecurityPolicy
} from "./security_policy";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);
const warningLog = make_warningLog(__filename);

export interface SecurityToken {
    tokenId: number;
    expired?: boolean;
    revisedLifetime: number;
}

const defaultObjectFactory = {
    constructObject,
    hasConstructor
};

export interface ObjectFactory {
    constructObject: (expandedNodeId: ExpandedNodeId) => BaseUAObject;
    hasConstructor: (expandedNodeId: ExpandedNodeId) => boolean;
}

export interface MessageBuilderOptions extends MessageBuilderBaseOptions {
    securityMode?: MessageSecurityMode;
    privateKey?: PrivateKeyPEM;
    objectFactory?: ObjectFactory;
    signatureLength?: number;
    name?: string;
}

export interface SecurityTokenAndDerivedKeys {
    securityToken: SecurityToken;
    derivedKeys: DerivedKeys | null;
}

const invalidPrivateKey = "<invalid>";
let counter = 0;

type PacketInfo = any;

export interface MessageBuilder extends MessageBuilderBase {
    on(eventName: "startChunk", eventHandler: (info: PacketInfo, data: Buffer) => void): this;
    on(eventName: "chunk", eventHandler: (chunk: Buffer) => void): this;
    on(eventName: "error", eventHandler: (err: Error, statusCode: StatusCode, requestId: number | null) => void): this;
    on(eventName: "full_message_body", eventHandler: (fullMessageBody: Buffer) => void): this;
    on(
        eventName: "message",
        eventHandler: (obj: BaseUAObject, msgType: string, requestId: number, channelId: number) => void
    ): this;
    on(eventName: "abandon", eventHandler: (requestId: number) => void): this;

    on(eventName: "invalid_message", eventHandler: (obj: BaseUAObject) => void): this;
    on(eventName: "invalid_sequence_number", eventHandler: (expectedSequenceNumber: number, sequenceNumber: number) => void): this;
    on(eventName: "new_token", eventHandler: (tokenId: number) => void): this;

    emit(eventName: "startChunk", info: PacketInfo, data: Buffer): boolean;
    emit(eventName: "chunk", chunk: Buffer): boolean;
    emit(eventName: "error", err: Error, statusCode: StatusCode, requestId: number | null): boolean;
    emit(eventName: "full_message_body", fullMessageBody: Buffer): boolean;
    emit(eventName: "message", obj: BaseUAObject, msgType: string, requestId: number, channelId: number): boolean;
    emit(eventName: "invalid_message", evobj: BaseUAObject): boolean;
    emit(eventName: "invalid_sequence_number", expectedSequenceNumber: number, sequenceNumber: number): boolean;
    emit(eventName: "new_token", tokenId: number): boolean;
    emit(eventName: "abandon"): boolean;
}
/**
 * @class MessageBuilder
 * @extends MessageBuilderBase
 * @constructor
 *
 * @param options
 * @param options.securityMode {MessageSecurityMode} the security Mode
 * @param [options.objectFactory=factories] a object that provides a constructObject(id) method
 */
export class MessageBuilder extends MessageBuilderBase {
    public securityPolicy: SecurityPolicy;
    public securityMode: MessageSecurityMode;
    public cryptoFactory: CryptoFactory | null;
    public securityHeader?: SecurityHeader;

    protected id: string;
    private readonly objectFactory: ObjectFactory;
    private _previousSequenceNumber: number;
    private _tokenStack: SecurityTokenAndDerivedKeys[];
    private privateKey: PrivateKeyPEM;

    constructor(options: MessageBuilderOptions) {
        super(options);
        options = options || {};

        this.id = (options.name ? options.name : "Id") + counter++;

        this.privateKey = options.privateKey || invalidPrivateKey;

        this.cryptoFactory = null;

        this.securityPolicy = SecurityPolicy.Invalid; // not known yet
        this.securityMode = options.securityMode || MessageSecurityMode.Invalid; // not known yet
        this.objectFactory = options.objectFactory || defaultObjectFactory;
        assert(
            typeof this.objectFactory.constructObject === "function",
            " the objectFactory must provide a constructObject method"
        );
        this._previousSequenceNumber = -1; // means unknown
        assert(isFinite(this._previousSequenceNumber));
        this._tokenStack = [];
    }

    public setSecurity(securityMode: MessageSecurityMode, securityPolicy: SecurityPolicy): void {
        assert(this.securityMode === MessageSecurityMode.Invalid, "security already set");
        this.securityPolicy = coerceSecurityPolicy(securityPolicy);
        this.securityMode = coerceMessageSecurityMode(securityMode);
        assert(this.securityPolicy !== SecurityPolicy.Invalid);
        assert(this.securityMode !== MessageSecurityMode.Invalid);
    }

    public dispose(): void {
        super.dispose();
        // xx this.securityPolicy = undefined;
        // xx this.securityMode = null;
        // xx this.objectFactory = null;
        this.cryptoFactory = null;
        this.securityHeader = undefined;
        this._tokenStack = [];
        this.privateKey = invalidPrivateKey;
    }

    public pushNewToken(securityToken: SecurityToken, derivedKeys: DerivedKeys | null): void {
        assert(Object.prototype.hasOwnProperty.call(securityToken, "tokenId"));

        // TODO: make sure this list doesn't grow indefinitely
        this._tokenStack = this._tokenStack || [];
        assert(this._tokenStack.length === 0 || this._tokenStack[0].securityToken.tokenId !== securityToken.tokenId);
        this._tokenStack.push({
            derivedKeys,
            securityToken
        });
        /* istanbul ignore next */
        if (doDebug) {
            debugLog("id=", this.id, chalk.cyan("Pushing new token with id "), securityToken.tokenId, this.tokenIds());
        }
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
            assert(binaryStream.length === 12);

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
                    this.securityPolicy = fromURI(asymmetricAlgorithmSecurityHeader.securityPolicyUri);
                    this.cryptoFactory = getCryptoFactory(this.securityPolicy);
                }

                if (!this._decrypt(binaryStream)) {
                    return false;
                }

                this.sequenceHeader = new SequenceHeader();
                this.sequenceHeader.decode(binaryStream);

                /* istanbul ignore next */
                if (doDebug) {
                    debugLog(" Sequence Header", this.sequenceHeader);
                }
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
                this._validateSequenceNumber(this.sequenceHeader.sequenceNumber);
            }
            return true;
        } catch (err) {
            warningLog(chalk.red("Error"), (err as Error).message);
            return false;
        }
    }

    protected _decodeMessageBody(fullMessageBody: Buffer): boolean {
        // istanbul ignore next
        if (!this.messageHeader || !this.securityHeader) {
            return this._report_error(StatusCodes2.BadTcpInternalError, "internal error");
        }

        const msgType = this.messageHeader.msgType;

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
            this.emit("message", objMessage1, msgType, this.sequenceHeader.requestId, this.channelId);
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
            return this._report_error(StatusCodes2.BadTcpInternalError, err instanceof Error ? err.message : " err");
        }

        if (!this.objectFactory.hasConstructor(id)) {
            // the datatype NodeId is not supported by the server and unknown in the factory
            // we better off reporting an error and abort the communication
            return this._report_error(StatusCodes.BadNotSupported, "cannot construct object with nodeID " + id.toString());
        }

        // construct the object
        const objMessage = this.objectFactory.constructObject(id);

        if (!objMessage) {
            return this._report_error(StatusCodes.BadNotSupported, "cannot construct object with nodeID " + id);
        } else {
            if (this._safe_decode_message_body(fullMessageBody, objMessage, binaryStream)) {
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
                    this.emit("message", objMessage, msgType, this.sequenceHeader!.requestId, this.channelId);
                } catch (err) {
                    // this code catches a uncaught exception somewhere in one of the event handler
                    // this indicates a bug in the code that uses this class
                    // please check the stack trace to find the problem

                    /* istanbul ignore next */
                    if (doDebug) {
                        debugLog(err);
                    }
                    warningLog(chalk.red("MessageBuilder : ERROR DETECTED IN 'message' event handler"));
                    if (err instanceof Error) {
                        debugLog(err.stack);
                    }
                }
            } else {
                warningLog("cannot decode message  for valid object of type " + id.toString() + " " + objMessage.constructor.name);
                this.emit("invalid_message", objMessage);
                // we don't report an error here, we just ignore the message
                return false; // this._report_error(message);
            }
        }
        return true;
    }

    private _validateSequenceNumber(sequenceNumber: number) {
        // checking that sequenceNumber is increasing
        assert(isFinite(this._previousSequenceNumber));
        assert(isFinite(sequenceNumber) && sequenceNumber >= 0);

        let expectedSequenceNumber;
        if (this._previousSequenceNumber !== -1) {
            expectedSequenceNumber = this._previousSequenceNumber + 1;

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
            }
            // todo : handle the case where sequenceNumber wraps back to < 1024
        }
        /* istanbul ignore next */
        if (doDebug) {
            debugLog(chalk.yellow.bold("" + this.id + " Sequence Number = "), sequenceNumber);
        }
        this._previousSequenceNumber = sequenceNumber;
    }

    // eslint-disable-next-line max-statements
    private _decrypt_OPN(binaryStream: BinaryStream): boolean {
        assert(this.securityPolicy !== SecurityPolicy.None);
        assert(this.securityPolicy !== SecurityPolicy.Invalid);
        assert(this.securityMode !== MessageSecurityMode.None);
        assert(this.securityHeader instanceof AsymmetricAlgorithmSecurityHeader);

        const asymmetricAlgorithmSecurityHeader = this.securityHeader! as AsymmetricAlgorithmSecurityHeader;

        /* istanbul ignore next */
        if (doDebug) {
            debugLog("securityHeader = {");
            debugLog("             securityPolicyId: ", asymmetricAlgorithmSecurityHeader.securityPolicyUri);
            debugLog(
                "             senderCertificate: ",
                makeSHA1Thumbprint(asymmetricAlgorithmSecurityHeader.senderCertificate).toString("hex")
            );

            debugLog("};");
        }
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
        if (doTraceChunk) {
            const thumb = makeSHA1Thumbprint(asymmetricAlgorithmSecurityHeader.senderCertificate).toString("hex");
            warningLog(timestamp(), ` >$$ securityPolicyId:  ${asymmetricAlgorithmSecurityHeader.securityPolicyUri} ${thumb} `);
        }

        if (!this.cryptoFactory) {
            warningLog(" Security Policy " + this.securityPolicy + " is not implemented yet");
            return false;
        }

        // The message has been signed  with sender private key and has been encrypted with receiver public key.
        // We shall decrypt it with the receiver private key.
        const buf = binaryStream.buffer.slice(binaryStream.length);

        if (asymmetricAlgorithmSecurityHeader.receiverCertificateThumbprint) {
            // this mean that the message has been encrypted ....

            assert(this.privateKey !== invalidPrivateKey, "expecting a valid private key");

            const decryptedBuffer = this.cryptoFactory.asymmetricDecrypt(buf, this.privateKey);

            // replace decrypted buffer in initial buffer
            decryptedBuffer.copy(binaryStream.buffer, binaryStream.length);

            // adjust length
            binaryStream.buffer = binaryStream.buffer.slice(0, binaryStream.length + decryptedBuffer.length);

            /* istanbul ignore next */
            if (doDebug) {
                debugLog(chalk.cyan("DE-----------------------------"));
                // debugLog(hexDump(binaryStream.buffer));
                debugLog(chalk.cyan("-------------------------------"));
                const thumbprint = makeSHA1Thumbprint(asymmetricAlgorithmSecurityHeader.senderCertificate);
                debugLog("Certificate thumbprint:", thumbprint.toString("hex"));
            }
        }

        const cert = exploreCertificateInfo(asymmetricAlgorithmSecurityHeader.senderCertificate);
        // then verify the signature
        const signatureLength = cert.publicKeyLength; // 1024 bits = 128Bytes or 2048=256Bytes or 3072 or 4096
        assert(signatureLength === 128 || signatureLength === 256 || signatureLength === 384 || signatureLength === 512);

        const chunk = binaryStream.buffer;

        const signatureIsOK = asymmetricVerifyChunk(this.cryptoFactory, chunk, asymmetricAlgorithmSecurityHeader.senderCertificate);

        if (!signatureIsOK) {
            /* istanbul ignore next */
            if (doDebug) {
                debugLog(hexDump(binaryStream.buffer));
                warningLog("Sign and Encrypt asymmetricVerify : Invalid packet signature");
            }
            return false;
        }

        // remove signature
        binaryStream.buffer = reduceLength(binaryStream.buffer, signatureLength);

        // remove padding
        if (asymmetricAlgorithmSecurityHeader.receiverCertificateThumbprint) {
            binaryStream.buffer = removePadding(binaryStream.buffer);
        }

        return true; // success
    }

    private tokenIds() {
        return this._tokenStack.map((a) => a.securityToken.tokenId);
    }

    private _select_matching_token(tokenId: number): SecurityTokenAndDerivedKeys | null {
        /* istanbul ignore next */
        if (doDebug) {
            debugLog(
                "id=",
                this.id,
                " ",
                chalk.yellow("_select_matching_token : searching token "),
                tokenId,
                "length = ",
                this._tokenStack.length,
                this.tokenIds()
            );
        }
        // this method select the security token matching the provided tokenId
        // it also get rid of older security token
        let gotNewToken = false;

        while (this._tokenStack.length) {
            const firstToken = this._tokenStack[0];

            if (firstToken.securityToken.tokenId === tokenId) {
                if (gotNewToken) {
                    this.emit("new_token", tokenId);
                }

                /* istanbul ignore next */
                if (doDebug) {
                    debugLog(
                        "id=",
                        this.id,
                        chalk.red(" found token"),
                        gotNewToken,
                        firstToken.securityToken.tokenId,
                        this.tokenIds()
                    );
                }
                return firstToken;
            }
            // remove first
            this._tokenStack.shift();

            /* istanbul ignore next */
            if (doDebug) {
                debugLog("id=", this.id, "Remove first token ", firstToken.securityToken.tokenId, this.tokenIds());
            }
            gotNewToken = true;
        }

        /* istanbul ignore next */
        if (doDebug) {
            debugLog("id=", this.id, " Cannot find token ", tokenId);
        }
        return null;
    }

    private _decrypt_MSG(binaryStream: BinaryStream): boolean {
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
        const securityTokenData = this._select_matching_token(symmetricAlgorithmSecurityHeader.tokenId);
        if (!securityTokenData) {
            if (doDebug) {
                debugLog("Security token data for token " + symmetricAlgorithmSecurityHeader.tokenId + " doesn't exist");
            }
            return false;
        }

        assert(Object.prototype.hasOwnProperty.call(securityTokenData, "derivedKeys"));

        // SecurityToken may have expired, in this case the MessageBuilder shall reject the message
        if (securityTokenData.securityToken.expired) {
            debugLog("Security token has expired : tokenId " + securityTokenData.securityToken.tokenId);
            return false;
        }

        // We shall decrypt it with the receiver private key.
        const buf = binaryStream.buffer.slice(binaryStream.length);

        const derivedKeys = securityTokenData.derivedKeys;

        // istanbul ignore next
        if (!derivedKeys || derivedKeys.signatureLength === 0) {
            return false;
        }

        if (this.securityMode === MessageSecurityMode.SignAndEncrypt) {
            const decryptedBuffer = decryptBufferWithDerivedKeys(buf, derivedKeys);

            // replace decrypted buffer in initial buffer
            decryptedBuffer.copy(binaryStream.buffer, binaryStream.length);

            // adjust length
            binaryStream.buffer = binaryStream.buffer.slice(0, binaryStream.length + decryptedBuffer.length);

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
            debugLog("_decrypt_MSG : Sign and Encrypt : Invalid packet signature");
            return false;
        }

        // remove signature
        binaryStream.buffer = reduceLength(binaryStream.buffer, derivedKeys.signatureLength);

        if (this.securityMode === MessageSecurityMode.SignAndEncrypt) {
            // remove padding
            binaryStream.buffer = removePadding(binaryStream.buffer);
        }

        return true;
    }

    private _decrypt(binaryStream: BinaryStream) {
        // istanbul ignore next
        if (!this.messageHeader) {
            throw new Error("internal error");
        }

        if (this.securityPolicy === SecurityPolicy.Invalid) {
            // this._report_error("SecurityPolicy");
            // return false;
            return true;
        }

        const msgType = this.messageHeader.msgType;

        // check if security is active or not
        if (this.securityPolicy === SecurityPolicy.None) {
            this.securityMode = MessageSecurityMode.None;
            assert(this.securityMode === MessageSecurityMode.None, "expecting securityMode = None when securityPolicy is None");
            return true; // nothing to do
        }
        assert(this.securityMode !== MessageSecurityMode.None);

        if (msgType === "OPN") {
            return this._decrypt_OPN(binaryStream);
        } else {
            return this._decrypt_MSG(binaryStream);
        }
    }

    private _safe_decode_message_body(fullMessageBody: Buffer, objMessage: any, binaryStream: BinaryStream) {
        try {
            // de-serialize the object from the binary stream
            const options = this.objectFactory;
            objMessage.decode(binaryStream, options);
        } catch (err) {
            if (err instanceof Error) {
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
