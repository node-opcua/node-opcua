import chalk from "chalk";
import * as _ from "underscore";

import { assert } from "node-opcua-assert";
import { decodeExpandedNodeId, decodeString } from "node-opcua-basic-types";
import { BinaryStream } from "node-opcua-binary-stream";
import {
    ComputeDerivedKeysOptions,
    decryptBufferWithDerivedKeys,
    DerivedKeys,
    exploreCertificate,
    exploreCertificateInfo,
    PrivateKeyPEM,
    reduceLength,
    removePadding,
    verifyChunkSignatureWithDerivedKeys
} from "node-opcua-crypto";
import { checkDebugFlag, hexDump, make_debugLog } from "node-opcua-debug";
import { BaseUAObject, constructObject } from "node-opcua-factory";
import { ExpandedNodeId } from "node-opcua-nodeid";
import { analyseExtensionObject } from "node-opcua-packet-analyzer";
import {
    AsymmetricAlgorithmSecurityHeader,
    coerceMessageSecurityMode,
    MessageSecurityMode
} from "node-opcua-service-secure-channel";
import { decodeStatusCode } from "node-opcua-status-code";
import { MessageBuilderBase } from "node-opcua-transport";
// tslint:disable:variable-name

import { SequenceHeader } from "node-opcua-chunkmanager";
import { chooseSecurityHeader, SymmetricAlgorithmSecurityHeader } from "./secure_channel_service";

import { SecurityHeader } from "./secure_message_chunk_manager";
import {
    asymmetricVerifyChunk, coerceSecurityPolicy,
    CryptoFactory,
    // DerivedKeys,
    fromURI,
    getCryptoFactory,
    SecurityPolicy
} from "./security_policy";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

export interface SecurityToken {
    tokenId: number;
    expired?: boolean;
    revisedLifetime: number;
}

const defaultObjectFactory =  { constructObject };

export interface ObjectFactory {

    constructObject: (expandedNodeId: ExpandedNodeId) => BaseUAObject;
}
export interface MessageBuilderOptions {
    securityMode?: MessageSecurityMode;
    privateKey?: PrivateKeyPEM;
    objectFactory?: ObjectFactory;
    signatureLength?: number;
}

export interface SecurityTokenAndDerivedKeys {
    securityToken: SecurityToken;
    derivedKeys: DerivedKeys | null;
}

const invalidPrivateKey = "<invalid>";

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
    private objectFactory: ObjectFactory;
    private _previousSequenceNumber: number;
    private _tokenStack: SecurityTokenAndDerivedKeys[];
    private privateKey: PrivateKeyPEM;

    constructor(options: MessageBuilderOptions) {

        super(options);
        options = options || {};

        this.privateKey = options.privateKey || invalidPrivateKey;

        this.cryptoFactory = null;

        this.securityPolicy = SecurityPolicy.Invalid; // not known yet
        this.securityMode = options.securityMode || MessageSecurityMode.Invalid; // not known yet
        this.objectFactory = options.objectFactory || defaultObjectFactory;
        assert(_.isFunction(this.objectFactory.constructObject), " the objectFactory must provide a constructObject method");
        this._previousSequenceNumber = -1; // means unknown
        assert(_.isFinite(this._previousSequenceNumber));
        this._tokenStack = [];
    }

    public setSecurity(securityMode: MessageSecurityMode, securityPolicy: SecurityPolicy) {
        assert(this.securityMode === MessageSecurityMode.Invalid, "security already set");
        this.securityPolicy = coerceSecurityPolicy(securityPolicy);
        this.securityMode = coerceMessageSecurityMode(securityMode);
        assert(this.securityPolicy !== SecurityPolicy.Invalid);
        assert(this.securityMode !== MessageSecurityMode.Invalid);
    }

    public dispose() {
        super.dispose();
        // xx this.securityPolicy = undefined;
        // xx this.securityMode = null;
        // xx this.objectFactory = null;
        this.cryptoFactory = null;
        this.securityHeader = undefined;
        this._tokenStack = [];
        this.privateKey = invalidPrivateKey;

    }

    public pushNewToken(securityToken: SecurityToken, derivedKeys: DerivedKeys| null) {

        assert(securityToken.hasOwnProperty("tokenId"));

        // TODO: make sure this list doesn't grow indefinitely
        this._tokenStack = this._tokenStack || [];
        assert(this._tokenStack.length === 0 || this._tokenStack[0].securityToken.tokenId !== securityToken.tokenId);
        this._tokenStack.push({
            securityToken,
            derivedKeys
        });
    }

    protected _read_headers(binaryStream: BinaryStream): boolean {

        super._read_headers(binaryStream);

        assert(binaryStream.length === 12);

        const msgType = this.messageHeader.msgType;

        if (msgType === "HEL" || msgType === "ACK") {

            this.securityPolicy = SecurityPolicy.None;
        } else if (msgType === "ERR") {

            // extract Error StatusCode and additional message
            binaryStream.length = 8;
            const errorCode = decodeStatusCode(binaryStream);
            const message = decodeString(binaryStream);

            console.log(chalk.red.bold(" ERROR RECEIVED FROM SENDER"), chalk.cyan(errorCode.toString()), message);
            console.log(hexDump(binaryStream.buffer));
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

            this._validateSequenceNumber(this.sequenceHeader.sequenceNumber);
        }
        return true;
    }

    protected _decodeMessageBody(fullMessageBody: Buffer): boolean {

        const binaryStream = new BinaryStream(fullMessageBody);
        const msgType = this.messageHeader.msgType;

        if (msgType === "ERR") {
            // invalid message type
            this._report_error("ERROR RECEIVED");
            return false;
        }
        if (msgType === "HEL" || msgType === "ACK") {
            // invalid message type
            this._report_error("Invalid message type ( HEL/ACK )");
            return false;
        }

        // read expandedNodeId:
        const id = decodeExpandedNodeId(binaryStream);

        let objMessage;
        try {

            // construct the object
            objMessage = this.objectFactory.constructObject(id);
        } catch (err) {
            this._report_error("cannot construct object with nodeID " + id);
            return false;
        }
        // construct the object

        if (!objMessage) {
            this._report_error("cannot construct object with nodeID " + id);
            return false;

        } else {

            debugLog("message size =", this.totalMessageSize, " body size =", this.totalBodySize);

            if (this._safe_decode_message_body(fullMessageBody, objMessage, binaryStream)) {

                if (!this.sequenceHeader) {
                    throw new Error("internal error");
                }
                try {

                    /**
                     * notify the observers that a full message has been received
                     * @event message
                     * @param  objMessage the decoded message object
                     * @param  msgType the message type ( "HEL","ACK","OPN","CLO" or "MSG" )
                     * @param  the request Id
                     */
                    this.emit("message", objMessage, msgType, this.sequenceHeader.requestId, this.channelId);
                } catch (err) {
                    // this code catches a uncaught exception somewhere in one of the event handler
                    // this indicates a bug in the code that uses this class
                    // please check the stack trace to find the problem
                    console.log(chalk.red("MessageBuilder : ERROR DETECTED IN event handler"));
                    console.log(err);
                    console.log(err.stack);
                }
            } else {
                const message = "cannot decode message  for valid object of type " + id.toString() + " " + objMessage.constructor.name;
                console.log(message);
                this._report_error(message);
                return false;
            }
        }
        return true;
    }

    private _validateSequenceNumber(sequenceNumber: number) {

        // checking that sequenceNumber is increasing
        assert(_.isFinite(this._previousSequenceNumber));
        assert(_.isFinite(sequenceNumber) && sequenceNumber >= 0);

        let expectedSequenceNumber;
        if (this._previousSequenceNumber !== -1) {

            expectedSequenceNumber = this._previousSequenceNumber + 1;

            if (expectedSequenceNumber !== sequenceNumber) {
                const errMessage = "Invalid Sequence Number found ( expected " + expectedSequenceNumber + ", got " + sequenceNumber + ")";
                debugLog(chalk.bold.red(errMessage));
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
            debugLog(chalk.yellow.bold(" Sequence Number = "), sequenceNumber);
        }
        this._previousSequenceNumber = sequenceNumber;
    }

    private _decrypt_OPN(binaryStream: BinaryStream) {

        assert(this.securityPolicy !== SecurityPolicy.None);
        assert(this.securityPolicy !== SecurityPolicy.Invalid);
        assert(this.securityMode !== MessageSecurityMode.None);
        assert(this.securityHeader instanceof AsymmetricAlgorithmSecurityHeader);

        const asymmetricAlgorithmSecurityHeader = this.securityHeader as AsymmetricAlgorithmSecurityHeader;

        /* istanbul ignore next */
        if (doDebug) {
            debugLog("securityHeader", JSON.stringify(this.securityHeader, null, " "));
        }

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
        if (doDebug) {
            debugLog(chalk.cyan("EN------------------------------"));
            debugLog(hexDump(binaryStream.buffer, 32, 0xFFFFFFFF));
            debugLog("---------------------- SENDER CERTIFICATE");
            debugLog(hexDump(asymmetricAlgorithmSecurityHeader.senderCertificate));
        }

        if (!this.cryptoFactory) {
            this._report_error(" Security Policy " + this.securityPolicy + " is not implemented yet");
            return false;
        }

        // The message has been signed  with sender private key and has been encrypted with receiver public key.
        // We shall decrypt it with the receiver private key.
        const buf = binaryStream.buffer.slice(binaryStream.length);

        if (asymmetricAlgorithmSecurityHeader.receiverCertificateThumbprint) { // this mean that the message has been encrypted ....

            assert(this.privateKey !== invalidPrivateKey, "expecting a valid private key");

            const decryptedBuffer = this.cryptoFactory.asymmetricDecrypt(buf, this.privateKey);

            // replace decrypted buffer in initial buffer
            decryptedBuffer.copy(binaryStream.buffer, binaryStream.length);

            // adjust length
            binaryStream.buffer = binaryStream.buffer.slice(0, binaryStream.length + decryptedBuffer.length);

            /* istanbul ignore next */
            if (doDebug) {
                debugLog(chalk.cyan("DE-----------------------------"));
                debugLog(hexDump(binaryStream.buffer));
                debugLog(chalk.cyan("-------------------------------"));
                debugLog("Certificate :", hexDump(asymmetricAlgorithmSecurityHeader.senderCertificate));
            }
        }

        const cert = exploreCertificateInfo(asymmetricAlgorithmSecurityHeader.senderCertificate);
        // then verify the signature
        const signatureLength = cert.publicKeyLength; // 1024 bits = 128Bytes or 2048=256Bytes or 3072 or 4096
        assert(signatureLength === 128 || signatureLength === 256 || signatureLength === 384 || signatureLength === 512);

        const chunk = binaryStream.buffer;

        const signatureIsOK = asymmetricVerifyChunk(this.cryptoFactory, chunk, asymmetricAlgorithmSecurityHeader.senderCertificate);

        if (!signatureIsOK) {
            console.log(hexDump(binaryStream.buffer));
            this._report_error("Sign and Encrypt asymmetricVerify : Invalid packet signature");
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

    private _select_matching_token(tokenId: number): SecurityTokenAndDerivedKeys | null {

        let gotNewToken = false;
        this._tokenStack = this._tokenStack || [];
        while (this._tokenStack.length) {
            if (this._tokenStack.length === 0) {
                return null; // no token
            }
            if (this._tokenStack[0].securityToken.tokenId === tokenId) {
                if (gotNewToken) {
                    this.emit("new_token", tokenId);
                }
                return this._tokenStack[0];
            }
            // remove first
            this._tokenStack = this._tokenStack.slice(1);
            gotNewToken = true;
        }
        return null;
    }

    private _decrypt_MSG(binaryStream: BinaryStream): boolean {

        assert(this.securityHeader instanceof SymmetricAlgorithmSecurityHeader);
        assert(this.securityMode !== MessageSecurityMode.None);
        assert(this.securityMode !== MessageSecurityMode.Invalid);
        assert(this.securityPolicy !== SecurityPolicy.None);
        assert(this.securityPolicy !== SecurityPolicy.Invalid);

        const symmetricAlgorithmSecurityHeader = this.securityHeader as SymmetricAlgorithmSecurityHeader;
        // Check  security token
        // securityToken may have been renewed
        const securityTokenData = this._select_matching_token(symmetricAlgorithmSecurityHeader.tokenId);
        if (!securityTokenData) {
            this._report_error("Security token data for token " + symmetricAlgorithmSecurityHeader.tokenId + " doesn't exist");
            return false;
        }

        assert(securityTokenData.hasOwnProperty("derivedKeys"));

        // SecurityToken may have expired, in this case the MessageBuilder shall reject the message
        if (securityTokenData.securityToken.expired) {
            this._report_error("Security token has expired : tokenId " + securityTokenData.securityToken.tokenId);
            return false;
        }

        // We shall decrypt it with the receiver private key.
        const buf = binaryStream.buffer.slice(binaryStream.length);

        if (!securityTokenData.derivedKeys) {
            return false;
        }

        const derivedKeys: DerivedKeys = securityTokenData.derivedKeys;

        assert(derivedKeys !== null);
        assert(derivedKeys.signatureLength > 0, " must provide a signature length");

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
            this._report_error("Sign and Encrypt : Invalid packet signature");
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
            console.log(err);
            console.log(err.stack);
            console.log(hexDump(fullMessageBody));
            analyseExtensionObject(fullMessageBody, 0, 0);

            console.log(" ---------------- block");
            let i = 0;
            this.messageChunks.forEach((messageChunk) => {
                console.log(" ---------------- chunk i=", i++);
                console.log(hexDump(messageChunk));
            });
            return false;
        }
        return true;
    }
}
