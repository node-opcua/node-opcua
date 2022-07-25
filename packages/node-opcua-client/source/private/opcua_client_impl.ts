/**
 * @module node-opcua-client-private
 */
// tslint:disable:variable-name
// tslint:disable:no-console
// tslint:disable:no-empty

import * as crypto from "crypto";
import { callbackify } from "util";
import * as async from "async";
import * as chalk from "chalk";

import { assert } from "node-opcua-assert";
import { createFastUninitializedBuffer } from "node-opcua-buffer-utils";
import {
    Certificate,
    exploreCertificate,
    extractPublicKeyFromCertificateSync,
    Nonce,
    PrivateKeyPEM,
    toPem
} from "node-opcua-crypto";

import { LocalizedText } from "node-opcua-data-model";
import { checkDebugFlag, make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";
import { extractFullyQualifiedDomainName, getHostname, resolveFullyQualifiedDomainName } from "node-opcua-hostname";
import { ClientSecureChannelLayer, computeSignature, fromURI, getCryptoFactory, SecurityPolicy } from "node-opcua-secure-channel";
import { ApplicationDescriptionOptions, ApplicationType, EndpointDescription, UserTokenType } from "node-opcua-service-endpoints";
import { MessageSecurityMode, UserTokenPolicy } from "node-opcua-service-secure-channel";
import {
    ActivateSessionRequest,
    ActivateSessionResponse,
    AnonymousIdentityToken,
    CloseSessionRequest,
    CloseSessionResponse,
    CreateSessionRequest,
    CreateSessionResponse,
    UserNameIdentityToken,
    X509IdentityToken
} from "node-opcua-service-session";
import { StatusCodes } from "node-opcua-status-code";
import { ErrorCallback, Callback } from "node-opcua-status-code";

import { SignatureData, SignatureDataOptions, UserIdentityToken } from "node-opcua-types";
import { isNullOrUndefined, matchUri } from "node-opcua-utils";

import { ClientSession } from "../client_session";
import { ClientSubscription, ClientSubscriptionOptions } from "../client_subscription";
import { Response } from "../common";
import {
    AnonymousIdentity,
    OPCUAClient,
    OPCUAClientOptions,
    UserIdentityInfo,
    UserIdentityInfoUserName,
    UserIdentityInfoX509,
    WithSessionFuncP,
    WithSubscriptionFuncP,
    EndpointWithUserIdentity
} from "../opcua_client";
import { repair_client_sessions } from "../reconnection";
import { ClientBaseImpl } from "./client_base_impl";
import { ClientSessionImpl } from "./client_session_impl";
import { ClientSubscriptionImpl } from "./client_subscription_impl";

interface TokenAndSignature {
    userIdentityToken: UserIdentityToken | null;
    userTokenSignature: SignatureDataOptions;
}

const doDebug = checkDebugFlag(__filename);
const debugLog = make_debugLog(__filename);
const errorLog = make_errorLog(__filename);
const warningLog = make_warningLog(__filename);

function validateServerNonce(serverNonce: Nonce | null): boolean {
    return !(serverNonce && serverNonce.length < 32) || (serverNonce && serverNonce.length === 0);
}

function verifyEndpointDescriptionMatches(client: OPCUAClientImpl, responseServerEndpoints: EndpointDescription[]): boolean {
    // The Server returns its EndpointDescriptions in the response. Clients use this information to
    // determine whether the list of EndpointDescriptions returned from the Discovery Endpoint matches
    // the Endpoints that the Server has. If there is a difference then the Client shall close the
    // Session and report an error.
    // The Server returns all EndpointDescriptions for the serverUri
    // specified by the Client in the request. The Client only verifies EndpointDescriptions with a
    // transportProfileUri that matches the profileUri specified in the original GetEndpoints request.
    // A Client may skip this check if the EndpointDescriptions were provided by a trusted source
    // such as the Administrator.
    // serverEndpoints:
    // The Client shall verify this list with the list from a Discovery Endpoint if it used a Discovery Endpoint
    // fetch to the EndpointDescriptions.

    // ToDo

    return true;
}

function findUserTokenPolicy(endpointDescription: EndpointDescription, userTokenType: UserTokenType) {
    endpointDescription.userIdentityTokens = endpointDescription.userIdentityTokens || [];
    const r = endpointDescription.userIdentityTokens.filter(
        (userIdentity: UserTokenPolicy) => userIdentity.tokenType === userTokenType
    );
    return r.length === 0 ? null : r[0];
}

interface IdentityTokenContext {
    endpoint: EndpointDescription;
    securityPolicy: SecurityPolicy;
    serverCertificate: Certificate;
    serverNonce: Buffer;
}

function createAnonymousIdentityToken(context: IdentityTokenContext): AnonymousIdentityToken {
    const endpoint = context.endpoint;
    const userTokenPolicy = findUserTokenPolicy(endpoint, UserTokenType.Anonymous);
    if (!userTokenPolicy) {
        throw new Error("Cannot find ANONYMOUS user token policy in end point description");
    }
    return new AnonymousIdentityToken({ policyId: userTokenPolicy.policyId });
}

interface X509TokenAndSignature {
    userIdentityToken: X509IdentityToken;
    userTokenSignature: SignatureDataOptions;
}

/**
 *
 * @param context
 * @param certificate - the user certificate
 * @param privateKey  - the private key associated with the user certificate
 */
function createX509IdentityToken(
    context: IdentityTokenContext,
    certificate: Certificate,
    privateKey: PrivateKeyPEM
): X509TokenAndSignature {
    const endpoint = context.endpoint;
    assert(endpoint instanceof EndpointDescription);
    const userTokenPolicy = findUserTokenPolicy(endpoint, UserTokenType.Certificate);
    // istanbul ignore next
    if (!userTokenPolicy) {
        throw new Error("Cannot find Certificate (X509) user token policy in end point description");
    }
    let securityPolicy = fromURI(userTokenPolicy.securityPolicyUri);

    // if the security policy is not specified we use the session security policy
    if (securityPolicy === SecurityPolicy.Invalid) {
        securityPolicy = context.securityPolicy;
    }
    const userIdentityToken = new X509IdentityToken({
        certificateData: certificate,
        policyId: userTokenPolicy.policyId
    });

    const serverCertificate: Certificate = context.serverCertificate;
    assert(serverCertificate instanceof Buffer);

    const serverNonce: Nonce = context.serverNonce || Buffer.alloc(0);
    assert(serverNonce instanceof Buffer);

    // see Release 1.02 155 OPC Unified Architecture, Part 4
    const cryptoFactory = getCryptoFactory(securityPolicy);

    // istanbul ignore next
    if (!cryptoFactory) {
        throw new Error(" Unsupported security Policy");
    }
    /**
     * OPCUA Spec 1.04 - part 4
     * page 28:
     * 5.6.3.1
     * ...
     * If the token is an X509IdentityToken then the proof is a signature generated with private key
     * associated with the Certificate. The data to sign is created by appending the last serverNonce to
     * the **serverCertificate** specified in the CreateSession response. If a token includes a secret then it
     * should be encrypted using the public key from the serverCertificate.
     *
     * page 155:
     * Token Encryption and Proof of Possession
     * 7.36.2.1 Overview
     * The Client shall always prove possession of a UserIdentityToken when it passes it to the Server.
     * Some tokens include a secret such as a password which the Server will accept as proof. In order
     * to protect these secrets the Token may be encrypted before it is passed to the Server. Other types
     * of tokens allow the Client to create a signature with the secret associated with the Token. In these
     * cases, the Client proves possession of a UserIdentityToken by creating a signature with the secret
     * and passing it to the Server
     *
     * page 159:
     * 7.36.5 X509IdentityTokens
     * The X509IdentityToken is used to pass an X.509 v3 Certificate which is issued by the user.
     * This token shall always be accompanied by a Signature in the userTokenSignature parameter of
     * ActivateSession if required by the SecurityPolicy. The Server should specify a SecurityPolicy for
     * the UserTokenPolicy if the SecureChannel has a SecurityPolicy of None.
     */

    // now create the proof of possession, by creating a signature
    // The data to sign is created by appending the last serverNonce to the serverCertificate

    // The signature generated with private key associated with the User Certificate
    const userTokenSignature: SignatureDataOptions = computeSignature(serverCertificate, serverNonce, privateKey, securityPolicy)!;

    return { userIdentityToken, userTokenSignature };
}
function createUserNameIdentityToken(
    session: IdentityTokenContext,
    userName: string | null,
    password: string | null
): UserNameIdentityToken {
    // assert(endpoint instanceof EndpointDescription);
    assert(userName === null || typeof userName === "string");
    assert(password === null || typeof password === "string");
    const endpoint = session.endpoint;
    assert(endpoint instanceof EndpointDescription);

    /**
     * OPC Unified Architecture 1.0.4:  Part 4 155
     * Each UserIdentityToken allowed by an Endpoint shall have a UserTokenPolicy specified in the
     * EndpointDescription. The UserTokenPolicy specifies what SecurityPolicy to use when encrypting
     * or signing. If this SecurityPolicy is omitted then the Client uses the SecurityPolicy in the
     * EndpointDescription. If the matching SecurityPolicy is set to None then no encryption or signature
     * is required.
     *
     */
    const userTokenPolicy = findUserTokenPolicy(endpoint, UserTokenType.UserName);

    // istanbul ignore next
    if (!userTokenPolicy) {
        throw new Error("Cannot find USERNAME user token policy in end point description");
    }

    let securityPolicy = fromURI(userTokenPolicy.securityPolicyUri);

    // if the security policy is not specified we use the session security policy
    if (securityPolicy === SecurityPolicy.Invalid) {
        securityPolicy = session.securityPolicy;
    }

    let identityToken;
    let serverCertificate: Buffer | string | null = session.serverCertificate;
    // if server does not provide certificate use unencrypted password
    if (!serverCertificate) {
        identityToken = new UserNameIdentityToken({
            encryptionAlgorithm: null,
            password: Buffer.from(password as string, "utf-8"),
            policyId: userTokenPolicy ? userTokenPolicy!.policyId : null,
            userName
        });
        return identityToken;
    }

    assert(serverCertificate instanceof Buffer);
    serverCertificate = toPem(serverCertificate, "CERTIFICATE");
    const publicKey = extractPublicKeyFromCertificateSync(serverCertificate);

    const serverNonce: Nonce = session.serverNonce || Buffer.alloc(0);
    assert(serverNonce instanceof Buffer);

    // If None is specified for the UserTokenPolicy and SecurityPolicy is None
    // then the password only contains the UTF-8 encoded password.
    // note: this means that password is sent in clear text to the server
    // note: OPCUA specification discourages use of unencrypted password
    //       but some old OPCUA server may only provide this policy and we
    //       still have to support in the client?
    if (securityPolicy === SecurityPolicy.None) {
        identityToken = new UserNameIdentityToken({
            encryptionAlgorithm: null,
            password: Buffer.from(password!, "utf-8"),
            policyId: userTokenPolicy.policyId,
            userName
        });
        return identityToken;
    }

    // see Release 1.02 155 OPC Unified Architecture, Part 4
    const cryptoFactory = getCryptoFactory(securityPolicy);

    // istanbul ignore next
    if (!cryptoFactory) {
        throw new Error(" Unsupported security Policy " + securityPolicy.toString());
    }

    identityToken = new UserNameIdentityToken({
        encryptionAlgorithm: cryptoFactory.asymmetricEncryptionAlgorithm,
        password: Buffer.from(password as string, "utf-8"),
        policyId: userTokenPolicy.policyId,
        userName
    });

    // now encrypt password as requested
    const lenBuf = createFastUninitializedBuffer(4);
    lenBuf.writeUInt32LE(identityToken.password.length + serverNonce.length, 0);
    const block = Buffer.concat([lenBuf, identityToken.password, serverNonce]);
    identityToken.password = cryptoFactory.asymmetricEncrypt(block, publicKey);

    return identityToken;
}

function _adjustRevisedSessionTimeout(revisedSessionTimeout: number, requestedTimeout: number): number {
    // Some old OPCUA Servers are known to report an invalid revisedSessionTimeout
    // such as Siemens SimoCode Pro V.
    // we need to adjust the value here, by guessing a sensible sessionTimeout value to use instead.
    if (revisedSessionTimeout < 1e-10) {
        warningLog(
            `the revisedSessionTimeout ${revisedSessionTimeout} reported by the server is inconsistent and has been adjusted back to requestedTimeout ${requestedTimeout}`
        );
        return requestedTimeout;
    }
    if (revisedSessionTimeout < OPCUAClientImpl.minimumRevisedSessionTimeout) {
        warningLog(
            `the revisedSessionTimeout ${revisedSessionTimeout} is smaller than the minimum timeout (OPCUAClientImpl.minimumRevisedSessionTimeout = ${OPCUAClientImpl.minimumRevisedSessionTimeout}) and has been clamped to this value`
        );
        return OPCUAClientImpl.minimumRevisedSessionTimeout;
    }
    return revisedSessionTimeout;
}

/***
 * @constructor
 * @internal
 */
export class OPCUAClientImpl extends ClientBaseImpl implements OPCUAClient {
    public static minimumRevisedSessionTimeout = 100.0;

    public static create(options: OPCUAClientOptions): OPCUAClient {
        return new OPCUAClientImpl(options);
    }

    public endpoint?: EndpointDescription;

    private endpointMustExist: boolean;
    private requestedSessionTimeout: number;
    private ___sessionName_counter: number;
    private userIdentityInfo: UserIdentityInfo;
    private serverUri?: string;
    private clientNonce?: Nonce;

    constructor(options?: OPCUAClientOptions) {
        options = options || {};
        super(options);

        // @property endpointMustExist {Boolean}
        // if set to true , create Session will only accept connection from server which endpoint_url has been reported
        // by GetEndpointsRequest.
        // By default, the client is strict.
        if (Object.prototype.hasOwnProperty.call(options, "endpoint_must_exist")) {
            if (Object.prototype.hasOwnProperty.call(options, "endpointMustExist")) {
                throw new Error(
                    "endpoint_must_exist is deprecated! you must now use endpointMustExist instead of endpoint_must_exist "
                );
            }
            warningLog("Warning: endpoint_must_exist is now deprecated, use endpointMustExist instead");
            options.endpointMustExist = options.endpoint_must_exist;
        }
        this.endpointMustExist = isNullOrUndefined(options.endpointMustExist) ? true : !!options.endpointMustExist;

        this.requestedSessionTimeout = options.requestedSessionTimeout || 60000; // 1 minute

        this.___sessionName_counter = 0;
        this.userIdentityInfo = { type: UserTokenType.Anonymous };
        this.endpoint = undefined;
    }

    /**
     * create and activate a new session
     * @async
     * @method createSession
     *
     *
     * @example
     *     // create a anonymous session
     *     const session = await client.createSession();
     *
     * @example
     *     // create a session with a userName and password
     *     const session = await client.createSession({
     *            type: UserTokenType.UserName,
     *            userName: "JoeDoe",
     *            password:"secret"
     *      });
     *
     */
    public async createSession(userIdentityInfo?: UserIdentityInfo): Promise<ClientSession>;
    public createSession(userIdentityInfo: UserIdentityInfo, callback: Callback<ClientSession>): void;
    public createSession(callback: Callback<ClientSession>): void;
    /**
     * @internal
     * @param args
     *
     */
    public createSession(...args: any[]): any {
        if (args.length === 1) {
            return this.createSession({ type: UserTokenType.Anonymous }, args[0]);
        }
        const userIdentityInfo = args[0] || { type: UserTokenType.Anonymous };
        const callback = args[1];

        this.userIdentityInfo = userIdentityInfo;

        assert(typeof callback === "function");

        this._createSession((err: Error | null, session?: ClientSession) => {
            if (err) {
                callback(err);
            } else {
                /* istanbul ignore next */
                if (!session) {
                    return callback(new Error("Internal Error"));
                }

                this._addSession(session as ClientSessionImpl);

                this._activateSession(session as ClientSessionImpl, (err1: Error | null, session2?: ClientSessionImpl) => {
                    callback(err1, session2);
                });
            }
        });
    }

    /**
     * createSession2 create a session with persistance
     *
     * - if the server returns BadTooManySession, the method will make an other attempt
     *   unitl create session succeed or connection is closed.
     *
     * @experiemental
     * @param userIdentityInfo
     */
    public async createSession2(userIdentityInfo?: UserIdentityInfo): Promise<ClientSession>;
    public createSession2(userIdentityInfo: UserIdentityInfo, callback: Callback<ClientSession>): void;
    public createSession2(callback: Callback<ClientSession>): void;
    public createSession2(...args: any[]): any {
        if (args.length === 1) {
            return this.createSession2({ type: UserTokenType.Anonymous }, args[0]);
        }
        const userIdentityInfo = args[0] as UserIdentityInfo;
        const callback = args[1] as Callback<ClientSession>;
        if (!this._secureChannel) {
            // we do not have a connection anymore
            return callback(new Error("Connection is closed"));
        }
        return this.createSession(args[0], (err: Error | null, session?: ClientSession) => {
            if (err && err.message.match(/BadTooManySessions/)) {
                const delayToRetry = 5; // seconds
                errorLog(`TooManySession .... we need to retry later  ... in  ${delayToRetry} secondes`);
                const retryCreateSessionTimer = setTimeout(() => {
                    errorLog("TooManySession .... now retrying");
                    this.createSession2(userIdentityInfo, callback);
                }, delayToRetry * 1000);
                return;
            }
            callback(err, session);
        });
    }

    /**
     * @method changeSessionIdentity
     * @param session
     * @param userIdentityInfo
     * @param callback
     * @async
     */
    public async changeSessionIdentity(session: ClientSession, userIdentityInfo: UserIdentityInfo): Promise<void>;
    public changeSessionIdentity(session: ClientSession, userIdentityInfo: UserIdentityInfo, callback: (err?: Error) => void): void;
    /**
     * @internal
     * @param args
     */
    public changeSessionIdentity(...args: any[]): any {
        const session = args[0] as ClientSessionImpl;
        const userIdentityInfo = args[1] as UserIdentityInfo;
        const callback = args[2];

        assert(typeof callback === "function");

        const old_userIdentity = this.userIdentityInfo;
        this.userIdentityInfo = userIdentityInfo;

        this._activateSession(session as ClientSessionImpl, (err1: Error | null, session1?: ClientSessionImpl) => {
            callback(err1 ? err1 : undefined);
        });
    }

    /**
     *
     * @method closeSession
     * @async
     * @param session - the created client session
     * @param deleteSubscriptions  - whether to delete subscriptions or not
     */
    public closeSession(session: ClientSession, deleteSubscriptions: boolean): Promise<void>;
    public closeSession(session: ClientSession, deleteSubscriptions: boolean, callback: (err?: Error) => void): void;
    /**
     * @internals
     * @param args
     */
    public closeSession(...args: any[]): any {
        super.closeSession(...args);
    }

    public toString(): string {
        let str = ClientBaseImpl.prototype.toString.call(this);
        str += "  requestedSessionTimeout....... " + this.requestedSessionTimeout + "\n";
        str += "  endpointUrl................... " + this.endpointUrl + "\n";
        str += "  serverUri..................... " + this.serverUri + "\n";
        return str;
    }

    /**
     *
     * @example
     *
     * ```javascript
     *
     * const session = await OPCUAClient.createSession(endpointUrl);
     * const dataValue = await session.read({ nodeId, attributeId: AttributeIds.Value });
     * await session.close();
     *
     * ```
     * @stability experimental
     *
     * @param endpointUrl
     * @param userIdentity
     * @returns session
     *
     *
     * const create
     */
    public static async createSession(
        endpointUrl: string,
        userIdentity?: UserIdentityInfo,
        clientOptions?: OPCUAClientOptions
    ): Promise<ClientSession> {
        const client = OPCUAClient.create(clientOptions || {});

        await client.connect(endpointUrl);
        const session = await client.createSession2(userIdentity);

        const oldClose = session.close as any;
        (session as any).close = thenify.withCallback((...args: any[]): any => {
            if (args.length === 1) {
                return session.close(true, args[0]);
            }
            const deleteSubscriptions = args[0] as boolean;
            const callback = args[1] as Callback<void>;
            session.close = oldClose;
            oldClose.call(session, deleteSubscriptions, (err?: Error) => {
                client.disconnect((err?: Error | null) => {
                    callback(err!);
                });
            });
        });
        return session;
    }
    /**
     * @method withSession
     */
    public withSession<T>(
        endpointUrl: string | EndpointWithUserIdentity,
        inner_func: (session: ClientSession) => Promise<T>
    ): Promise<T>;

    public withSession(
        endpointUrl: string | EndpointWithUserIdentity,
        inner_func: (session: ClientSession, done: (err?: Error) => void) => void,
        callback: (err?: Error) => void
    ): void;
    /**
     * @internal
     * @param args
     */
    public withSession(
        connectionPoint: string | EndpointWithUserIdentity,
        inner_func: (session: ClientSession, done: (err?: Error) => void) => void,
        ...args: any[]
    ): any {
        const endpointUrl: string = typeof connectionPoint === "string" ? connectionPoint : connectionPoint.endpointUrl;
        const userIdentity: UserIdentityInfo =
            typeof connectionPoint === "string" ? { type: UserTokenType.Anonymous } : connectionPoint.userIdentity;

        const callback = args[0];

        assert(typeof inner_func === "function", "expecting inner function");
        assert(typeof callback === "function", "expecting callback function");

        let theSession: ClientSession;
        let the_error: Error | undefined;

        let need_disconnect = false;
        async.series(
            [
                // step 1 : connect to
                (innerCallback: ErrorCallback) => {
                    this.connect(endpointUrl, (err?: Error) => {
                        need_disconnect = true;
                        if (err) {
                            warningLog(err.message);
                            errorLog(" cannot connect to endpoint :", endpointUrl);
                        }
                        innerCallback(err);
                    });
                },

                // step 2 : createSession
                (innerCallback: ErrorCallback) => {
                    this.createSession2(userIdentity, (err: Error | null, session?: ClientSession) => {
                        if (err) {
                            return innerCallback(err);
                        }
                        if (!session) {
                            return innerCallback(new Error("internal error"));
                        }
                        theSession = session;
                        innerCallback();
                    });
                },

                (innerCallback: ErrorCallback) => {
                    try {
                        inner_func(theSession, (err?: Error) => {
                            the_error = err;
                            innerCallback();
                        });
                    } catch (err) {
                        console.log("Exception catch in inner function,  check your code ", err);
                        errorLog("OPCUAClientImpl#withClientSession", (<Error>err).message);
                        the_error = err as Error;
                        innerCallback();
                    }
                },

                // close session
                (innerCallback: ErrorCallback) => {
                    theSession.close(/*deleteSubscriptions=*/ true, (err?: Error) => {
                        if (err) {
                            debugLog("OPCUAClientImpl#withClientSession: session closed failed ?");
                        }
                        innerCallback();
                    });
                },

                (innerCallback: ErrorCallback) => {
                    this.disconnect((err?: Error) => {
                        need_disconnect = false;
                        if (err) {
                            errorLog("OPCUAClientImpl#withClientSession: client disconnect failed ?");
                        }
                        innerCallback();
                    });
                }
            ],
            (err1) => {
                if (err1) {
                    console.log("err", err1.message);
                }
                if (need_disconnect) {
                    errorLog("Disconnecting client after failure");
                    this.disconnect((err2) => {
                        return callback(the_error || err1 || err2);
                    });
                } else {
                    return callback(the_error || err1);
                }
            }
        );
    }

    public withSubscription(
        endpointUrl: string | EndpointWithUserIdentity,
        subscriptionParameters: ClientSubscriptionOptions,
        innerFunc: (session: ClientSession, subscription: ClientSubscription, done: (err?: Error) => void) => void,
        callback: (err?: Error) => void
    ): void {
        assert(typeof innerFunc === "function");
        assert(typeof callback === "function");

        this.withSession(
            endpointUrl,
            (session: ClientSession, done: (err?: Error) => void) => {
                assert(typeof done === "function");

                const subscription = new ClientSubscriptionImpl(session as ClientSessionImpl, subscriptionParameters);

                try {
                    innerFunc(session, subscription, (err?: Error) => {
                        subscription.terminate((err1?: Error) => {
                            done(err1);
                        });
                    });
                } catch (err) {
                    debugLog(err);
                    done(err as Error);
                }
            },
            callback
        );
    }

    public async withSessionAsync(connectionPoint: string | EndpointWithUserIdentity, func: WithSessionFuncP<any>): Promise<any> {
        assert(typeof func === "function");
        assert(func.length === 1, "expecting a single argument in func");

        const endpointUrl: string = typeof connectionPoint === "string" ? connectionPoint : connectionPoint.endpointUrl;
        const userIdentity: UserIdentityInfo =
            typeof connectionPoint === "string" ? { type: UserTokenType.Anonymous } : connectionPoint.userIdentity;

        await this.connect(endpointUrl);
        const session = await this.createSession2(userIdentity);

        let result;
        try {
            result = await func(session);
        } catch (err) {
            errorLog(err);
            throw err;
        } finally {
            await session.close();
            await this.disconnect();
        }
        return result;
    }

    public async withSubscriptionAsync(
        connectionPoint: string | EndpointWithUserIdentity,
        parameters: ClientSubscriptionOptions,
        func: WithSubscriptionFuncP<any>
    ): Promise<any> {
        await this.withSessionAsync(connectionPoint, async (session: ClientSession) => {
            assert(session, " session must exist");
            const subscription = await session.createSubscription2(parameters);
            try {
                const result = await func(session, subscription);
                return result;
            } catch (err) {
                console.log("withSubscriptionAsync inner function failed ", (<Error>err).message);
                throw err;
            } finally {
                await subscription.terminate();
            }
        });
    }

    /**
     * transfer session to this client
     * @method reactivateSession
     * @param session
     * @param callback
     * @return {*}
     */
    public async reactivateSession(session: ClientSession): Promise<void>;
    public reactivateSession(session: ClientSession, callback: (err?: Error) => void): void;
    public reactivateSession(session: ClientSession, callback?: (err?: Error) => void): any {
        const internalSession = session as ClientSessionImpl;

        assert(typeof callback === "function");
        if (!this._secureChannel) {
            return callback!(new Error(" client must be connected first"));
        }
        // istanbul ignore next
        if (!this.__resolveEndPoint() || !this.endpoint) {
            return callback!(new Error(" End point must exist " + this._secureChannel.endpointUrl));
        }

        assert(
            !internalSession._client || matchUri(internalSession._client.endpointUrl, this.endpointUrl),
            "cannot reactivateSession on a different endpoint"
        );

        const old_client = internalSession._client;

        debugLog("OPCUAClientImpl#reactivateSession");

        this._activateSession(internalSession, (err: Error | null /*, newSession?: ClientSessionImpl*/) => {
            if (!err) {
                if (old_client !== this) {
                    // remove session from old client:
                    if (old_client) {
                        old_client._removeSession(internalSession);
                        assert(old_client._sessions.indexOf(internalSession) === -1);
                    }

                    this._addSession(internalSession);
                    assert(internalSession._client === this);
                    assert(!internalSession._closed, "session should not vbe closed");
                    assert(this._sessions.indexOf(internalSession) !== -1);
                }
                callback!();
            } else {
                // istanbul ignore next
                if (doDebug) {
                    debugLog(chalk.red.bgWhite("reactivateSession has failed !"), err.message);
                }
                callback!(err);
            }
        });
    }

    /**
     * @internal
     * @private
     */
    public _on_connection_reestablished(callback: (err?: Error) => void): void {
        assert(typeof callback === "function");

        // call base class implementation first
        ClientBaseImpl.prototype._on_connection_reestablished.call(this, (/*err?: Error*/) => {
            repair_client_sessions(this, callback);
        });
    }

    /**
     *
     * @internal
     * @private
     */
    public __createSession_step3(
        session: ClientSessionImpl,
        callback: (err: Error | null, session?: ClientSessionImpl) => void
    ): void {
        assert(typeof callback === "function");
        assert(this.serverUri !== undefined, " must have a valid server URI " + this.serverUri);
        assert(this.endpointUrl !== undefined, " must have a valid server endpointUrl");
        assert(this.endpoint);

        // istanbul ignore next
        if (!this._secureChannel) {
            return callback(new Error("Invalid channel"));
        }

        const applicationUri = this._getApplicationUri();

        const applicationDescription: ApplicationDescriptionOptions = {
            applicationName: new LocalizedText({ text: this.applicationName, locale: null }),
            applicationType: ApplicationType.Client,
            applicationUri,
            discoveryProfileUri: undefined,
            discoveryUrls: [],
            gatewayServerUri: undefined,
            productUri: "NodeOPCUA-Client"
        };

        // note : do not confuse CreateSessionRequest.clientNonce with OpenSecureChannelRequest.clientNonce
        //        which are two different nonce, with different size (although they share the same name )
        this.clientNonce = crypto.randomBytes(32);

        const request = new CreateSessionRequest({
            clientCertificate: this.getCertificate(),
            clientDescription: applicationDescription,
            clientNonce: this.clientNonce,
            endpointUrl: this.endpointUrl,
            maxResponseMessageSize: 800000,
            requestedSessionTimeout: this.requestedSessionTimeout,
            serverUri: this.serverUri,
            sessionName: this._nextSessionName()
        });

        // a client Nonce must be provided if security mode is set
        assert(this._secureChannel.securityMode === MessageSecurityMode.None || request.clientNonce !== null);

        this.performMessageTransaction(request, (err: Error | null, response?: Response) => {
            /* istanbul ignore next */
            if (err) {
                console.log("__createSession_step3 has failed", err.message);
                return callback(err);

                //  //xxxxxx               qdqsdqsdqsdqsd
                //                 // we could have an invalid state here or a connection error
                //                 errorLog("error: ", err.message, " retrying in ... 5 secondes");
                //                 setTimeout(() => {
                //                     errorLog(" .... now retrying");
                //                     this.__createSession_step3(session, callback);
                //                 }, 5 * 1000);
                //                 return;
            }

            /* istanbul ignore next */
            if (!response || !(response instanceof CreateSessionResponse)) {
                return callback(new Error("internal error"));
            }

            if (response.responseHeader.serviceResult === StatusCodes.BadTooManySessions) {
                return callback(new Error(response.responseHeader.serviceResult.toString()));
            }

            if (response.responseHeader.serviceResult !== StatusCodes.Good) {
                err = new Error(
                    "Error " + response.responseHeader.serviceResult.name + " " + response.responseHeader.serviceResult.description
                );
                return callback(err);
            }

            // istanbul ignore next
            if (!validateServerNonce(response.serverNonce)) {
                return callback(new Error("Invalid server Nonce"));
            }

            // todo: verify SignedSoftwareCertificates and  response.serverSignature

            session = session || new ClientSessionImpl(this);
            session.name = request.sessionName || "";
            session.sessionId = response.sessionId;
            session.authenticationToken = response.authenticationToken;

            session.timeout = _adjustRevisedSessionTimeout(response.revisedSessionTimeout, this.requestedSessionTimeout);
            session.serverNonce = response.serverNonce;
            session.serverCertificate = response.serverCertificate;
            session.serverSignature = response.serverSignature;

            debugLog("revised session timeout = ", session.timeout, response.revisedSessionTimeout);

            response.serverEndpoints = response.serverEndpoints || [];

            if (!verifyEndpointDescriptionMatches(this, response.serverEndpoints)) {
                errorLog("Endpoint description previously retrieved with GetEndpointsDescription");
                errorLog("CreateSessionResponse.serverEndpoints= ");
                errorLog(response.serverEndpoints);
                return callback(new Error("Invalid endpoint descriptions Found"));
            }
            // this._serverEndpoints = response.serverEndpoints;
            session.serverEndpoints = response.serverEndpoints;
            callback(null, session);
        });
    }
    /**
     *
     * @internal
     * @private
     */
    public __createSession_step2(
        session: ClientSessionImpl,
        callback: (err: Error | null, session?: ClientSessionImpl) => void
    ): void {
        callbackify(extractFullyQualifiedDomainName)(() => {
            this.__createSession_step3(session, callback);
        });
    }
    /**
     * @internal
     * @private
     */
    public _activateSession(session: ClientSessionImpl, callback: (err: Error | null, session?: ClientSessionImpl) => void): void {
        // see OPCUA Part 4 - $7.35
        assert(typeof callback === "function");

        // istanbul ignore next
        if (!this._secureChannel) {
            return callback(new Error(" No secure channel"));
        }

        const serverCertificate = session.serverCertificate;
        // If the securityPolicyUri is None and none of the UserTokenPolicies requires encryption,
        // the Client shall ignore the ApplicationInstanceCertificate (serverCertificate)
        assert(serverCertificate === null || serverCertificate instanceof Buffer);

        const serverNonce = session.serverNonce;
        assert(!serverNonce || serverNonce instanceof Buffer);

        // make sure session is attached to this client
        const _old_client = session._client;

        session._client = this;

        const context: IdentityTokenContext = {
            endpoint: this.endpoint!,
            securityPolicy: this._secureChannel.securityPolicy,
            serverCertificate,
            serverNonce: serverNonce! // please check this !
        };

        this.createUserIdentityToken(context, this.userIdentityInfo, (err: Error | null, data?: TokenAndSignature | null) => {
            if (err) {
                session._client = _old_client;
                return callback(err);
            }

            data = data!;
            const userIdentityToken: UserIdentityToken = data.userIdentityToken!;
            const userTokenSignature: SignatureDataOptions = data.userTokenSignature!;
            // TODO. fill the ActivateSessionRequest
            // see 5.6.3.2 Parameters OPC Unified Architecture, Part 4 30 Release 1.02
            const request = new ActivateSessionRequest({
                // This is a signature generated with the private key associated with the
                // clientCertificate. The SignatureAlgorithm shall be the AsymmetricSignatureAlgorithm
                // specified in the SecurityPolicy for the Endpoint. The SignatureData type is defined in 7.30.

                clientSignature: this.computeClientSignature(this._secureChannel!, serverCertificate, serverNonce) || undefined,

                // These are the SoftwareCertificates which have been issued to the Client application.
                // The productUri contained in the SoftwareCertificates shall match the productUri in the
                // ApplicationDescription passed by the Client in the CreateSession requests. Certificates without
                // matching productUri should be ignored.  Servers may reject connections from Clients if they are
                // not satisfied with the SoftwareCertificates provided by the Client.
                // This parameter only needs to be specified in the first ActivateSession request
                // after CreateSession.
                // It shall always be omitted if the maxRequestMessageSize returned from the Server in the
                // CreateSession response is less than one megabyte.
                // The SignedSoftwareCertificate type is defined in 7.31.

                clientSoftwareCertificates: [],

                // List of locale ids in priority order for localized strings. The first LocaleId in the list
                // has the highest priority. If the Server returns a localized string to the Client, the Server
                // shall return the translation with the highest priority that it can. If it does not have a
                // translation for any of the locales identified in this list, then it shall return the string
                // value that it has and include the locale id with the string.
                // See Part 3 for more detail on locale ids. If the Client fails to specify at least one locale id,
                // the Server shall use any that it has.
                // This parameter only needs to be specified during the first call to ActivateSession during
                // a single application Session. If it is not specified the Server shall keep using the current
                // localeIds for the Session.
                localeIds: [],

                // The credentials of the user associated with the Client application. The Server uses these
                // credentials to determine whether the Client should be allowed to activate a Session and what
                // resources the Client has access to during this Session. The UserIdentityToken is an extensible
                // parameter type defined in 7.35.
                // The EndpointDescription specifies what UserIdentityTokens the Server shall accept.
                userIdentityToken,

                // If the Client specified a user   identity token that supports digital signatures,
                // then it shall create a signature and pass it as this parameter. Otherwise the parameter
                // is omitted.
                // The SignatureAlgorithm depends on the identity token type.
                userTokenSignature
            });

            request.requestHeader.authenticationToken = session.authenticationToken!;
            session.lastRequestSentTime = new Date();

            this.performMessageTransaction(request, (err1: Error | null, response?: Response) => {
                if (!err1 && response && response.responseHeader.serviceResult === StatusCodes.Good) {
                    /* istanbul ignore next */
                    if (!(response instanceof ActivateSessionResponse)) {
                        return callback(new Error("Internal Error"));
                    }

                    if (!validateServerNonce(response.serverNonce)) {
                        return callback(new Error("Invalid server Nonce"));
                    }
                    session._client = this;
                    session.serverNonce = response.serverNonce;
                    session.lastResponseReceivedTime = new Date();
                    if (this.keepSessionAlive) {
                        session.startKeepAliveManager();
                    }
                    return callback(null, session);
                } else {
                    // restore client
                    session._client = _old_client;

                    /* istanbul ignore next */
                    if (!err1 && response) {
                        err1 = new Error(response.responseHeader.serviceResult.toString());
                    }
                    session._client = _old_client;
                    return callback(err1);
                }
            });
        });
    }
    /**
     *
     * @private
     */
    private _nextSessionName() {
        if (!this.___sessionName_counter) {
            this.___sessionName_counter = 0;
        }
        this.___sessionName_counter += 1;
        return this.clientName + this.___sessionName_counter;
    }

    /**
     *
     * @private
     */
    private _getApplicationUri() {
        const certificate = this.getCertificate();
        let applicationUri: string;
        if (certificate) {
            const e = exploreCertificate(certificate);
            if (e.tbsCertificate.extensions?.subjectAltName?.uniformResourceIdentifier) {
                applicationUri = e.tbsCertificate.extensions.subjectAltName.uniformResourceIdentifier[0];
            } else {
                errorLog("Certificate has no extensions.subjectAltName.uniformResourceIdentifier, ");
                errorLog(toPem(certificate, "CERTIFICATE"));
                applicationUri = this._getBuiltApplicationUri();
            }
        } else {
            applicationUri = this._getBuiltApplicationUri();
        }
        return applicationUri;
    }

    /**
     *
     * @private
     */
    private __resolveEndPoint() {
        this.securityPolicy = this.securityPolicy || SecurityPolicy.None;

        let endpoint = this.findEndpoint(this._secureChannel!.endpointUrl, this.securityMode, this.securityPolicy);
        this.endpoint = endpoint;

        // this is explained here : see OPCUA Part 4 Version 1.02 $5.4.1 page 12:
        //   A  Client  shall verify the  HostName  specified in the  Server Certificate  is the same as the  HostName
        //   contained in the  endpointUrl  provided in the  EndpointDescription. If there is a difference  then  the
        //   Client  shall report the difference and may close the  SecureChannel.

        if (!this.endpoint) {
            if (this.endpointMustExist) {
                debugLog(
                    "OPCUAClientImpl#endpointMustExist = true and endpoint with url ",
                    this._secureChannel!.endpointUrl,
                    " cannot be found"
                );

                return false;
            } else {
                // fallback :
                // our strategy is to take the first server_end_point that match the security settings
                // ( is this really OK ?)
                // this will permit us to access a OPCUA Server using it's IP address instead of its hostname

                endpoint = this.findEndpointForSecurity(this.securityMode, this.securityPolicy);
                if (!endpoint) {
                    return false;
                }
                this.endpoint = endpoint;
            }
        }
        return true;
    }

    /**
     *
     * @private
     */
    private _createSession(callback: (err: Error | null, session?: ClientSession) => void) {
        assert(typeof callback === "function");
        assert(this._secureChannel);
        if (!this.__resolveEndPoint() || !this.endpoint) {
            /* istanbul ignore next */
            if (doDebug && this._serverEndpoints) {
                debugLog(
                    this._serverEndpoints.map(
                        (endpoint) =>
                            endpoint.endpointUrl + " " + endpoint.securityMode.toString() + " " + endpoint.securityPolicyUri
                    )
                );
            }
            return callback(new Error(" End point must exist " + this._secureChannel!.endpointUrl));
        }
        this.serverUri = this.endpoint.server.applicationUri || "invalid application uri";
        this.endpointUrl = this._secureChannel!.endpointUrl;

        const session = new ClientSessionImpl(this);
        this.__createSession_step2(session, callback);
    }

    /**
     *
     * @private
     */
    private computeClientSignature(channel: ClientSecureChannelLayer, serverCertificate: Buffer, serverNonce: Nonce | undefined) {
        return computeSignature(serverCertificate, serverNonce || Buffer.alloc(0), this.getPrivateKey(), channel.securityPolicy);
    }
    /**
     *
     * @private
     */
    private createUserIdentityToken(
        context: IdentityTokenContext,
        userIdentityInfo: UserIdentityInfo,
        callback: (err: Error | null, data?: TokenAndSignature) => void
    ) {
        function coerceUserIdentityInfo(identityInfo: any): UserIdentityInfo {
            if (!identityInfo) {
                return { type: UserTokenType.Anonymous };
            }
            if (Object.prototype.hasOwnProperty.call(identityInfo, "type")) {
                return identityInfo as UserIdentityInfo;
            }
            if (Object.prototype.hasOwnProperty.call(identityInfo, "userName")) {
                identityInfo.type = UserTokenType.UserName;
                return identityInfo as UserIdentityInfoUserName;
            }
            if (Object.prototype.hasOwnProperty.call(identityInfo, "certificateData")) {
                identityInfo.type = UserTokenType.Certificate;
                return identityInfo as UserIdentityInfoX509;
            }
            identityInfo.type = UserTokenType.Anonymous;
            return identityInfo as AnonymousIdentity;
        }

        userIdentityInfo = coerceUserIdentityInfo(userIdentityInfo);

        assert(typeof callback === "function");
        if (null === userIdentityInfo) {
            return callback(null, {
                userIdentityToken: null,
                userTokenSignature: {}
            });
        }

        let userIdentityToken: UserIdentityToken;

        let userTokenSignature: SignatureDataOptions = {
            algorithm: undefined,
            signature: undefined
        };

        try {
            switch (userIdentityInfo.type) {
                case UserTokenType.Anonymous:
                    userIdentityToken = createAnonymousIdentityToken(context);
                    break;

                case UserTokenType.UserName: {
                    const userName = userIdentityInfo.userName || "";
                    const password = userIdentityInfo.password || "";
                    userIdentityToken = createUserNameIdentityToken(context, userName, password);
                    break;
                }

                case UserTokenType.Certificate: {
                    const certificate = userIdentityInfo.certificateData;
                    const privateKey = userIdentityInfo.privateKey;
                    ({ userIdentityToken, userTokenSignature } = createX509IdentityToken(context, certificate, privateKey));
                    break;
                }

                default:
                    debugLog(" userIdentityInfo = ", userIdentityInfo);
                    return callback(new Error("CLIENT: Invalid userIdentityInfo"));
            }
        } catch (err) {
            if (typeof err === "string") {
                return callback(new Error("Create identity token failed " + userIdentityInfo.type + " " + err));
            }
            return callback(err as Error);
        }
        return callback(null, { userIdentityToken, userTokenSignature });
    }
}

// tslint:disable:no-var-requires
// tslint:disable:max-line-length
const thenify = require("thenify");
/**
 * @method createSession
 * @async
 *
 * @example
 *     // create a anonymous session
 *     const session = await client.createSession();
 *
 * @example
 *     // create a session with a userName and password
 *     const userIdentityInfo  = {
 *          type: UserTokenType.UserName,
 *          userName: "JoeDoe",
 *          password:"secret"
 *     };
 *     const session = client.createSession(userIdentityInfo);
 *
 */
OPCUAClientImpl.prototype.createSession = thenify.withCallback(OPCUAClientImpl.prototype.createSession);
OPCUAClientImpl.prototype.createSession2 = thenify.withCallback(OPCUAClientImpl.prototype.createSession2);
/**
 * @method changeSessionIdentity
 * @async
 */
OPCUAClientImpl.prototype.changeSessionIdentity = thenify.withCallback(OPCUAClientImpl.prototype.changeSessionIdentity);
/**
 * @method closeSession
 * @async
 * @example
 *    const session  = await client.createSession();
 *    await client.closeSession(session);
 */
OPCUAClientImpl.prototype.closeSession = thenify.withCallback(OPCUAClientImpl.prototype.closeSession);
OPCUAClientImpl.prototype.reactivateSession = thenify.withCallback(OPCUAClientImpl.prototype.reactivateSession);
