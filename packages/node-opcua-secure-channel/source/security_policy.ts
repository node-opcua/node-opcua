/**
 * @module node-opcua-secure-channel
 */
// tslint:disable:object-literal-short-hand
// tslint:disable:variable-name
// tslint:disable:max-line-length

import { assert } from "node-opcua-assert";

import { MessageSecurityMode, SignatureData } from "node-opcua-service-secure-channel";

import {
    Certificate,
    computeDerivedKeys as computeDerivedKeys_ext,
    DerivedKeys,
    encryptBufferWithDerivedKeys,
    exploreCertificateInfo,
    makeMessageChunkSignature,
    makeMessageChunkSignatureWithDerivedKeys,
    Nonce,
    privateDecrypt_long,
    PrivateKeyPEM,
    publicEncrypt_long,
    PublicKeyPEM,
    rsa_length,
    RSA_PKCS1_OAEP_PADDING,
    RSA_PKCS1_PADDING,
    Signature,
    split_der,
    toPem,
    verifyMessageChunkSignature
} from "node-opcua-crypto";
import { EncryptBufferFunc, SignBufferFunc } from "node-opcua-chunkmanager";
import { make_warningLog } from "node-opcua-debug";

// tslint:disable:no-empty
function errorLog(...args: any[]) {
    /** */
}
const warningLog = make_warningLog(__filename);

/**
 *
 * OPCUA Spec Release 1.02  page 15    OPC Unified Architecture, Part 7
 *
 * @property Basic128Rsa15    Security Basic 128Rsa15
 * -----------------------
 *  A suite of algorithms that uses RSA15 as
 *  Key-Wrap-algorithm and 128-Bit for  encryption algorithms.
 *    -> SymmetricSignatureAlgorithm   -   HmacSha1 -(http://www.w3.org/2000/09/xmldsig#hmac-sha1).
 *    -> SymmetricEncryptionAlgorithm  -     Aes128 -(http://www.w3.org/2001/04/xmlenc#aes128-cbc).
 *    -> AsymmetricSignatureAlgorithm  -    RsaSha1 -(http://www.w3.org/2000/09/xmldsig#rsa-sha1).
 *    -> AsymmetricKeyWrapAlgorithm    -    KwRsa15 -(http://www.w3.org/2001/04/xmlenc#rsa-1_5).
 *    -> AsymmetricEncryptionAlgorithm -      Rsa15 -(http://www.w3.org/2001/04/xmlenc#rsa-1_5).
 *    -> KeyDerivationAlgorithm        -      PSha1 -(http://docs.oasis-open.org/ws-sx/ws-secureconversation/200512/dk/p_sha1).
 *    -> DerivedSignatureKeyLength     -  128
 *    -> MinAsymmetricKeyLength        - 1024
 *    -> MaxAsymmetricKeyLength        - 2048
 *    -> CertificateSignatureAlgorithm - Sha1
 *
 * @property Basic256 Security Basic 256:
 * -------------------
 * A suite of algorithms that are for 256-Bit encryption, algorithms include:
 *    -> SymmetricSignatureAlgorithm   - HmacSha1 -(http://www.w3.org/2000/09/xmldsig#hmac-sha1).
 *    -> SymmetricEncryptionAlgorithm  -   Aes256 -(http://www.w3.org/2001/04/xmlenc#aes256-cbc).
 *    -> AsymmetricSignatureAlgorithm  -  RsaSha1 -(http://www.w3.org/2000/09/xmldsig#rsa-sha1).
 *    -> AsymmetricKeyWrapAlgorithm    - KwRsaOaep-(http://www.w3.org/2001/04/xmlenc#rsa-oaep-mgf1p).
 *    -> AsymmetricEncryptionAlgorithm -  RsaOaep -(http://www.w3.org/2001/04/xmlenc#rsa-oaep).
 *    -> KeyDerivationAlgorithm        -    PSha1 -(http://docs.oasis-open.org/ws-sx/ws-secureconversation/200512/dk/p_sha1).
 *    -> DerivedSignatureKeyLength     -  192.
 *    -> MinAsymmetricKeyLength        - 1024
 *    -> MaxAsymmetricKeyLength        - 2048
 *    -> CertificateSignatureAlgorithm - Sha1
 *
 * @property Basic256 Security Basic 256 Sha256
 * --------------------------------------------
 * A suite of algorithms that are for 256-Bit encryption, algorithms include.
 *   -> SymmetricSignatureAlgorithm   - Hmac_Sha256 -(http://www.w3.org/2000/09/xmldsig#hmac-sha256).
 *   -> SymmetricEncryptionAlgorithm  -  Aes256_CBC -(http://www.w3.org/2001/04/xmlenc#aes256-cbc).
 *   -> AsymmetricSignatureAlgorithm  -  Rsa_Sha256 -(http://www.w3.org/2001/04/xmldsig-more#rsa-sha256).
 *   -> AsymmetricKeyWrapAlgorithm    -   KwRsaOaep -(http://www.w3.org/2001/04/xmlenc#rsa-oaep-mgf1p).
 *   -> AsymmetricEncryptionAlgorithm -    Rsa_Oaep -(http://www.w3.org/2001/04/xmlenc#rsa-oaep).
 *   -> KeyDerivationAlgorithm        -     PSHA256 -(http://docs.oasis-open.org/ws-sx/ws-secureconversation/200512/dk/p_sha256).
 *   -> DerivedSignatureKeyLength     - 256
 *   -> MinAsymmetricKeyLength        - 2048
 *   -> MaxAsymmetricKeyLength        - 4096
 *   -> CertificateSignatureAlgorithm - Sha256
 *
 *  Support for this security profile may require support for a second application instance certificate, with a larger
 *  key size. Applications shall support multiple Application Instance Certificates if required by supported Security
 *  Polices and use the certificate that is required for a given security endpoint.
 *
 *  * @property Aes128_Sha256_RsaOaep
 *
 *  ...
 *   -> DerivedSignatureKeyLength     - 256
 *   -> MinAsymmetricKeyLength        - 2048
 *   -> MaxAsymmetricKeyLength        - 4096
 *   -> CertificateSignatureAlgorithm - Sha256
 */
export enum SecurityPolicy {
    Invalid = "invalid",
    None = "http://opcfoundation.org/UA/SecurityPolicy#None",
    Basic128 = "http://opcfoundation.org/UA/SecurityPolicy#Basic128",
    Basic192 = "http://opcfoundation.org/UA/SecurityPolicy#Basic192",
    Basic192Rsa15 = "http://opcfoundation.org/UA/SecurityPolicy#Basic192Rsa15",
    Basic256Rsa15 = "http://opcfoundation.org/UA/SecurityPolicy#Basic256Rsa15",
    Basic256Sha256 = "http://opcfoundation.org/UA/SecurityPolicy#Basic256Sha256",

    // new
    Aes128_Sha256_RsaOaep = "http://opcfoundation.org/UA/SecurityPolicy#Aes128_Sha256_RsaOaep",
    Aes256_Sha256_RsaPss = "http://opcfoundation.org/UA/SecurityPolicy#Aes256_Sha256_RsaPss",
    PubSub_Aes128_CTR = "http://opcfoundation.org/UA/SecurityPolicy#PubSub_Aes128_CTR",
    PubSub_Aes256_CTR = "http://opcfoundation.org/UA/SecurityPolicy#PubSub_Aes256_CTR",

    // obsoletes
    Basic128Rsa15 = "http://opcfoundation.org/UA/SecurityPolicy#Basic128Rsa15", // Obsolete
    Basic256 = "http://opcfoundation.org/UA/SecurityPolicy#Basic256" // obsolete
}

export function fromURI(uri: string | null): SecurityPolicy {
    // istanbul ignore next
    if (typeof uri !== "string") {
        return SecurityPolicy.Invalid;
    }
    const a: string[] = uri.split("#");
    // istanbul ignore next
    if (a.length < 2) {
        return SecurityPolicy.Invalid;
    }
    const v = (SecurityPolicy as any)[a[1]];
    return (v as SecurityPolicy) || SecurityPolicy.Invalid;
}

export function toURI(value: SecurityPolicy | string): string {
    if (typeof value === "string") {
        const a: string[] = value.split("#");
        // istanbul ignore next
        if (a.length < 2) {
            return (SecurityPolicy as any)[value as any];
        }
        return value;
    }

    const securityPolicy = value || SecurityPolicy.Invalid;
    if (securityPolicy === SecurityPolicy.Invalid) {
        throw new Error("trying to convert an invalid Security Policy into a URI: " + value);
    }
    return SecurityPolicy[securityPolicy];
}

export function coerceSecurityPolicy(value?: string | SecurityPolicy | null): SecurityPolicy {
    if (value === undefined || value === null) {
        return SecurityPolicy.None;
    }
    if (
        value === "Basic128Rsa15" ||
        value === "Basic256" ||
        value === "Basic192Rsa15" ||
        value === "None" ||
        value === "Basic256Sha256" ||
        value === "Aes128_Sha256_RsaOaep" ||
        value === "Aes256_Sha256_RsaPss" ||
        value === "Basic256Rsa15"
    ) {
        return (SecurityPolicy as any)[value as string] as SecurityPolicy;
    }
    if (
        !(
            value === SecurityPolicy.Basic128Rsa15 ||
            value === SecurityPolicy.Basic256 ||
            value === SecurityPolicy.Basic192Rsa15 ||
            value === SecurityPolicy.Basic256Rsa15 ||
            value === SecurityPolicy.Basic256Sha256 ||
            value === SecurityPolicy.Aes128_Sha256_RsaOaep ||
            value === SecurityPolicy.Aes256_Sha256_RsaPss ||
            value === SecurityPolicy.None
        )
    ) {
        errorLog("coerceSecurityPolicy: invalid security policy ", value, SecurityPolicy);
    }
    return value as SecurityPolicy;
}

// --------------------
function RSAPKCS1V15_Decrypt(buffer: Buffer, privateKey: PrivateKeyPEM): Buffer {
    const blockSize = rsa_length(privateKey);
    return privateDecrypt_long(buffer, privateKey, blockSize, RSA_PKCS1_PADDING);
}

function RSAOAEP_Decrypt(buffer: Buffer, privateKey: PrivateKeyPEM): Buffer {
    const blockSize = rsa_length(privateKey);
    return privateDecrypt_long(buffer, privateKey, blockSize, RSA_PKCS1_OAEP_PADDING);
}

// --------------------
export function asymmetricVerifyChunk(self: CryptoFactory, chunk: Buffer, certificate: Certificate): boolean {
    assert(chunk instanceof Buffer);
    assert(certificate instanceof Buffer);
    // let's get the signatureLength by checking the size
    // of the certificate's public key
    const cert = exploreCertificateInfo(certificate);
    const signatureLength = cert.publicKeyLength; // 1024 bits = 128Bytes or 2048=256Bytes

    const blockToVerify = chunk.slice(0, chunk.length - signatureLength);
    const signature = chunk.slice(chunk.length - signatureLength);
    return self.asymmetricVerify(blockToVerify, signature, certificate);
}

function RSAPKCS1V15SHA1_Verify(buffer: Buffer, signature: Signature, certificate: Certificate): boolean {
    assert(certificate instanceof Buffer);
    assert(signature instanceof Buffer);
    const options = {
        algorithm: "RSA-SHA1",
        publicKey: toPem(certificate, "CERTIFICATE"),
        signatureLength: 0
    };
    return verifyMessageChunkSignature(buffer, signature, options);
}

const RSAPKCS1OAEPSHA1_Verify = RSAPKCS1V15SHA1_Verify;

function RSAPKCS1OAEPSHA256_Verify(buffer: Buffer, signature: Signature, certificate: Certificate): boolean {
    const options = {
        algorithm: "RSA-SHA256",
        publicKey: toPem(certificate, "CERTIFICATE"),
        signatureLength: 0
    };
    return verifyMessageChunkSignature(buffer, signature, options);
}

function RSAPKCS1V15SHA1_Sign(buffer: Buffer, privateKey: PrivateKeyPEM): Buffer {
    assert(!((privateKey as any) instanceof Buffer), "privateKey should not be a Buffer but a PEM");
    const params = {
        algorithm: "RSA-SHA1",
        privateKey,
        signatureLength: rsa_length(privateKey)
    };
    return makeMessageChunkSignature(buffer, params);
}

function RSAPKCS1V15SHA256_Sign(buffer: Buffer, privateKey: PrivateKeyPEM): Buffer {
    // xx    if (privateKey instanceof Buffer) {
    // xx        privateKey = toPem(privateKey, "RSA PRIVATE KEY");
    // xx   }
    const params = {
        algorithm: "RSA-SHA256",
        privateKey,
        signatureLength: rsa_length(privateKey)
    };
    return makeMessageChunkSignature(buffer, params);
}

const RSAPKCS1OAEPSHA1_Sign = RSAPKCS1V15SHA1_Sign;

function RSAPKCS1V15_Encrypt(buffer: Buffer, publicKey: PublicKeyPEM): Buffer {
    const keyLength = rsa_length(publicKey);
    return publicEncrypt_long(buffer, publicKey, keyLength, 11, RSA_PKCS1_PADDING);
}

function RSAOAEP_Encrypt(buffer: Buffer, publicKey: PublicKeyPEM): Buffer {
    const keyLength = rsa_length(publicKey);
    return publicEncrypt_long(buffer, publicKey, keyLength, 42, RSA_PKCS1_OAEP_PADDING);
}

// export interface DerivedKeys {
//     signatureLength: number;
//     encryptingBlockSize: number;
//     derivedClientKeys: Buffer | null;
//     derivedServerKeys: Buffer | null;
//     algorithm: string | null;
// }

export interface DerivedKeys1 {
    derivedClientKeys: DerivedKeys | null;
    derivedServerKeys: DerivedKeys | null;
    algorithm: string | null;
}

export function computeDerivedKeys(cryptoFactory: CryptoFactory, serverNonce: Nonce, clientNonce: Nonce): DerivedKeys1 {
    // calculate derived keys

    if (clientNonce && serverNonce) {
        const options = {
            algorithm: cryptoFactory.symmetricEncryptionAlgorithm,
            encryptingBlockSize: cryptoFactory.encryptingBlockSize,
            encryptingKeyLength: cryptoFactory.derivedEncryptionKeyLength,

            sha1or256: cryptoFactory.sha1or256,
            signatureLength: cryptoFactory.signatureLength,
            signingKeyLength: cryptoFactory.derivedSignatureKeyLength
        };
        return {
            algorithm: null,
            derivedClientKeys: computeDerivedKeys_ext(serverNonce, clientNonce, options),
            derivedServerKeys: computeDerivedKeys_ext(clientNonce, serverNonce, options)
        };
    } else {
        return { derivedClientKeys: null, derivedServerKeys: null, algorithm: null };
    }
}

export interface CryptoFactory {

    securityPolicy: SecurityPolicy;
    symmetricKeyLength: number;
    derivedEncryptionKeyLength: number;
    derivedSignatureKeyLength: number;
    encryptingBlockSize: number;
    signatureLength: number;

    /**  for info only */
    minimumAsymmetricKeyLength: number;
    /**  for info only */
    maximumAsymmetricKeyLength: number;

    asymmetricVerifyChunk: (self: CryptoFactory, chunk: Buffer, certificate: Certificate) => boolean;
    asymmetricSign: (buffer: Buffer, publicKey: PublicKeyPEM) => Buffer;
    asymmetricVerify: (buffer: Buffer, signature: Signature, certificate: Certificate) => boolean;

    asymmetricEncrypt: (buffer: Buffer, publicKey: PublicKeyPEM) => Buffer;
    asymmetricDecrypt: (buffer: Buffer, privateKey: PrivateKeyPEM) => Buffer;

    /**  for info only */
    asymmetricSignatureAlgorithm: string;
    /**  for info only */
    asymmetricEncryptionAlgorithm: string;

    symmetricEncryptionAlgorithm:  "aes-256-cbc" |  "aes-128-cbc";

    blockPaddingSize: number;
    sha1or256: "SHA1" | "SHA256";
}

const factoryBasic128Rsa15: CryptoFactory = {
    derivedEncryptionKeyLength: 16,
    derivedSignatureKeyLength: 16,
    encryptingBlockSize: 16,
    securityPolicy: SecurityPolicy.Basic128Rsa15,
    signatureLength: 20,
    symmetricKeyLength: 16,

    maximumAsymmetricKeyLength: 512,
    minimumAsymmetricKeyLength: 128,

    /* asymmetric signature algorithm */
    asymmetricVerifyChunk,

    asymmetricSign: RSAPKCS1V15SHA1_Sign,

    asymmetricVerify: RSAPKCS1V15SHA1_Verify,

    asymmetricSignatureAlgorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1",

    /* asymmetric encryption algorithm */
    asymmetricEncrypt: RSAPKCS1V15_Encrypt,

    asymmetricDecrypt: RSAPKCS1V15_Decrypt,

    asymmetricEncryptionAlgorithm: "http://www.w3.org/2001/04/xmlenc#rsa-1_5",

    blockPaddingSize: 11,

    symmetricEncryptionAlgorithm: "aes-128-cbc",

    sha1or256: "SHA1"
};

const _Basic256: CryptoFactory = {
    securityPolicy: SecurityPolicy.Basic256,

    derivedEncryptionKeyLength: 32,
    derivedSignatureKeyLength: 24,
    encryptingBlockSize: 16,
    signatureLength: 20,
    symmetricKeyLength: 32,

    maximumAsymmetricKeyLength: 512,
    minimumAsymmetricKeyLength: 128,

    asymmetricVerifyChunk,

    asymmetricSign: RSAPKCS1OAEPSHA1_Sign,

    asymmetricVerify: RSAPKCS1OAEPSHA1_Verify,

    asymmetricSignatureAlgorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1",

    /* asymmetric encryption algorithm */
    asymmetricEncrypt: RSAOAEP_Encrypt,

    asymmetricDecrypt: RSAOAEP_Decrypt,

    asymmetricEncryptionAlgorithm: "http://www.w3.org/2001/04/xmlenc#rsa-oaep",

    blockPaddingSize: 42,

    // "aes-256-cbc"
    symmetricEncryptionAlgorithm: "aes-256-cbc",

    sha1or256: "SHA1"
};

const _Basic256Sha256: CryptoFactory = {
    securityPolicy: SecurityPolicy.Basic256Sha256,

    derivedEncryptionKeyLength: 32,
    derivedSignatureKeyLength: 32,
    encryptingBlockSize: 16,
    signatureLength: 32,
    symmetricKeyLength: 32,

    maximumAsymmetricKeyLength: 4096,
    minimumAsymmetricKeyLength: 2048,

    asymmetricVerifyChunk,

    asymmetricSign: RSAPKCS1V15SHA256_Sign,

    asymmetricVerify: RSAPKCS1OAEPSHA256_Verify,

    asymmetricSignatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",

    /* asymmetric encryption algorithm */
    asymmetricEncrypt: RSAOAEP_Encrypt,

    asymmetricDecrypt: RSAOAEP_Decrypt,

    asymmetricEncryptionAlgorithm: "http://www.w3.org/2001/04/xmlenc#rsa-oaep",

    blockPaddingSize: 42,

    // "aes-256-cbc"
    symmetricEncryptionAlgorithm: "aes-256-cbc",

    sha1or256: "SHA256"
};

const _Aes128_Sha256_RsaOaep: CryptoFactory = {
    securityPolicy: SecurityPolicy.Aes128_Sha256_RsaOaep,

    derivedEncryptionKeyLength: 16,
    derivedSignatureKeyLength: 32,
    encryptingBlockSize: 16,

    signatureLength: 32,
    symmetricKeyLength: 32,

    maximumAsymmetricKeyLength: 4096,
    minimumAsymmetricKeyLength: 2048,

    asymmetricVerifyChunk,

    asymmetricSign: RSAPKCS1V15SHA256_Sign,

    asymmetricVerify: RSAPKCS1OAEPSHA256_Verify,

    asymmetricSignatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",

    /* asymmetric encryption algorithm */
    asymmetricEncrypt: RSAOAEP_Encrypt,

    asymmetricDecrypt: RSAOAEP_Decrypt,

    asymmetricEncryptionAlgorithm: "http://www.w3.org/2001/04/xmlenc#rsa-oaep",

    blockPaddingSize: 42,

    // "aes-128-cbc" : 128 bits : 16 bytes
    symmetricEncryptionAlgorithm: "aes-128-cbc",

    sha1or256: "SHA256"
};

const _Aes256_Sha256_RsaPss: CryptoFactory = {
    securityPolicy: SecurityPolicy.Aes256_Sha256_RsaPss,
    derivedEncryptionKeyLength: 32,
    derivedSignatureKeyLength: 32,
    encryptingBlockSize: 16,
    signatureLength: 32,
    symmetricKeyLength: 32,

    maximumAsymmetricKeyLength: 4096,
    minimumAsymmetricKeyLength: 2048,

    asymmetricVerifyChunk,

    asymmetricSign: RSAPKCS1V15SHA256_Sign,

    asymmetricVerify: RSAPKCS1OAEPSHA256_Verify,

    asymmetricSignatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",

    /* asymmetric encryption algorithm */
    asymmetricEncrypt: RSAOAEP_Encrypt,

    asymmetricDecrypt: RSAOAEP_Decrypt,

    asymmetricEncryptionAlgorithm: "http://www.w3.org/2001/04/xmlenc#rsa-oaep",

    blockPaddingSize: 42,

    // "aes-256-cbc"
    symmetricEncryptionAlgorithm: "aes-256-cbc",

    sha1or256: "SHA256"
};


export function getCryptoFactory(securityPolicy: SecurityPolicy): CryptoFactory | null {
    switch (securityPolicy) {
        case SecurityPolicy.None:
            return null;
        case SecurityPolicy.Basic128Rsa15:
            return factoryBasic128Rsa15;
        case SecurityPolicy.Basic256:
            return _Basic256;
        case SecurityPolicy.Basic256Sha256:
            return _Basic256Sha256;
        case SecurityPolicy.Aes128_Sha256_RsaOaep:
            return _Aes128_Sha256_RsaOaep;
        case SecurityPolicy.Aes256_Sha256_RsaPss:
            return _Aes256_Sha256_RsaPss;
        default: {
            errorLog(" Security policy ", securityPolicy, "is not supported");
            return null;
        }
    }
}

export function computeSignature(
    senderCertificate: Buffer | null,
    senderNonce: Nonce | null,
    receiverPrivateKey: PrivateKeyPEM | null,
    securityPolicy: SecurityPolicy
): SignatureData | undefined {
    if (!senderNonce || !senderCertificate || senderCertificate.length === 0 || !receiverPrivateKey) {
        return undefined;
    }

    // Verify that senderCertificate is not a chain
    const chain = split_der(senderCertificate);

    const cryptoFactory = getCryptoFactory(securityPolicy);
    if (!cryptoFactory) {
        return undefined;
    }
    // This parameter is calculated by appending the clientNonce to the clientCertificate
    const dataToSign = Buffer.concat([chain[0], senderNonce]);

    // ... and signing the resulting sequence of bytes.
    const signature = cryptoFactory.asymmetricSign(dataToSign, receiverPrivateKey);

    return new SignatureData({
        // A string containing the URI of the algorithm.
        // The URI string values are defined as part of the security profiles specified in Part 7.
        // (The SignatureAlgorithm shall be the AsymmetricSignatureAlgorithm specified in the
        // SecurityPolicy for the Endpoint)
        // for instance "http://www.w3.org/2000/09/xmldsig#rsa-sha1"
        algorithm: cryptoFactory.asymmetricSignatureAlgorithm,
        // This is a signature generated with the private key associated with a Certificate
        signature
    });
}

export function verifySignature(
    receiverCertificate: Buffer,
    receiverNonce: Buffer,
    signature: SignatureData,
    senderCertificate: Buffer,
    securityPolicy: SecurityPolicy
): boolean {
    if (securityPolicy === SecurityPolicy.None) {
        return true;
    }
    const cryptoFactory = getCryptoFactory(securityPolicy);
    if (!cryptoFactory) {
        return false;
    }
    if (!(signature.signature instanceof Buffer)) {
        // no signature provided
        return false;
    }
    // Verify that senderCertificate is not a chain
    const chain = split_der(receiverCertificate);

    assert(signature.signature instanceof Buffer);
    // This parameter is calculated by appending the clientNonce to the clientCertificate
    const dataToVerify = Buffer.concat([chain[0], receiverNonce]);
    try {
        return cryptoFactory.asymmetricVerify(dataToVerify, signature.signature, senderCertificate);
    } catch (e) {
        warningLog(`Error when verifying signature of certificate: ${e}`);
        return false;
    }
}

export interface SecureMessageChunkManagerOptionsPartial {
    cipherBlockSize?: number;
    encryptBufferFunc?: EncryptBufferFunc;
    plainBlockSize?: number;

    signBufferFunc: SignBufferFunc;
    signatureLength: number;
}
export function getOptionsForSymmetricSignAndEncrypt(
    securityMode: MessageSecurityMode,
    derivedKeys: DerivedKeys
): SecureMessageChunkManagerOptionsPartial {
    assert(Object.prototype.hasOwnProperty.call(derivedKeys, "signatureLength"));
    assert(securityMode !== MessageSecurityMode.None && securityMode !== MessageSecurityMode.Invalid);

    let options: SecureMessageChunkManagerOptionsPartial = {
        signBufferFunc: (chunk: Buffer) => makeMessageChunkSignatureWithDerivedKeys(chunk, derivedKeys),
        signatureLength: derivedKeys.signatureLength
    };
    if (securityMode === MessageSecurityMode.SignAndEncrypt) {
        options = {
            ...options,
            cipherBlockSize: derivedKeys.encryptingBlockSize,
            encryptBufferFunc: (chunk: Buffer) => encryptBufferWithDerivedKeys(chunk, derivedKeys),
            plainBlockSize: derivedKeys.encryptingBlockSize
        };
    }
    return options;
}
