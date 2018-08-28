/**
 * @module bode-opcua-client
 */
// tslint:disable:variable-name
import * as async from "async";
import chalk from "chalk";
import * as crypto from "crypto";
import { EventEmitter } from "events";
import { assert } from "node-opcua-assert";
import { createFastUninitializedBuffer } from "node-opcua-buffer-utils";
import { makeApplicationUrn } from "node-opcua-common";
import { exploreCertificate, Certificate, Nonce, extractPublicKeyFromCertificateSync, toPem } from "node-opcua-crypto";
import { LocalizedText } from "node-opcua-data-model";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import {
    ClientSecureChannelLayer, computeSignature, ConnectionStrategyOptions,
    ErrorCallback,
    fromURI,
    getCryptoFactory,
    SecurityPolicy
} from "node-opcua-secure-channel";
import {
    ApplicationDescription,
    ApplicationDescriptionOptions,
    ApplicationType,
    EndpointDescription,
    UserTokenType
} from "node-opcua-service-endpoints";
import { MessageSecurityMode, UserTokenPolicy } from "node-opcua-service-secure-channel";
import {
    ActivateSessionRequest,
    ActivateSessionResponse,
    AnonymousIdentityToken,
    CloseSessionRequest, CloseSessionResponse,
    CreateSessionRequest,
    CreateSessionResponse, IssuedIdentityToken,
    UserNameIdentityToken,
} from "node-opcua-service-session";
import { StatusCodes } from "node-opcua-status-code";
import { isNullOrUndefined } from "node-opcua-utils";
import * as _ from "underscore";
import {
    FindServersRequestLike,
    GetEndpointCallbackFunc,
    GetEndpointsOptions,
    OPCUAClientBase,
    OPCUAClientBaseOptions, OPCUAClientBasePublic
} from "./client_base";
import { ClientSession, ClientSessionImpl, ResponseCallback } from "./client_session";
import { ClientSubscription, ClientSubscriptionOptions } from "./client_subscription";
import { Request, Response } from "./common";
import { repair_client_sessions } from "./reconnection";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

function validateServerNonce(serverNonce: Nonce | null): boolean {
    return (!(serverNonce && serverNonce.length < 32));
}

function verifyEndpointDescriptionMatches(
    client: OPCUAClient,
    responseServerEndpoints: EndpointDescription[]
): boolean {
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

export interface UserIdentityInfo {
    userName?: string;
    password?: string;
}

function isAnonymous(userIdentityInfo: UserIdentityInfo | null): boolean {
    return !userIdentityInfo || (!userIdentityInfo.userName && !userIdentityInfo.password);
}

function isUserNamePassword(userIdentityInfo: UserIdentityInfo): boolean {
    return (userIdentityInfo.userName !== undefined) && (userIdentityInfo.password !== undefined);
}

function findUserTokenPolicy(endpointDescription: EndpointDescription, userTokenType: UserTokenType) {
    endpointDescription.userIdentityTokens = endpointDescription.userIdentityTokens || [];
    const r = _.filter(endpointDescription.userIdentityTokens, (userIdentity: UserTokenPolicy) =>
        userIdentity.tokenType === userTokenType
    );
    return r.length === 0 ? null : r[0];
}

function createAnonymousIdentityToken(session: ClientSessionImpl): AnonymousIdentityToken {

    const endpoint = session.endpoint;
    const userTokenPolicy = findUserTokenPolicy(endpoint, UserTokenType.Anonymous);
    if (!userTokenPolicy) {
        throw new Error("Cannot find ANONYMOUS user token policy in end point description");
    }
    return new AnonymousIdentityToken({policyId: userTokenPolicy.policyId});
}

function createUserNameIdentityToken(
    session: ClientSessionImpl,
    userName: string | null,
    password: string | null
): UserNameIdentityToken {

    // assert(endpoint instanceof EndpointDescription);
    assert(userName === null || typeof userName === "string");
    assert(password === null || typeof password === "string");
    const endpoint = session.endpoint;
    assert(endpoint instanceof EndpointDescription);

    const userTokenPolicy = findUserTokenPolicy(endpoint, UserTokenType.UserName);

    // istanbul ignore next
    if (!userTokenPolicy) {
        throw new Error("Cannot find USERNAME user token policy in end point description");
    }

    let securityPolicy = fromURI(userTokenPolicy.securityPolicyUri);

    // if the security policy is not specified we use the session security policy
    if (securityPolicy === SecurityPolicy.Invalid) {
        securityPolicy = session._client._secureChannel.securityPolicy;
    }

    let userIdentityToken;
    let serverCertificate: Buffer | string = session.serverCertificate;
    // if server does not provide certificate use unencrypted password
    if (serverCertificate === null) {
        userIdentityToken = new UserNameIdentityToken({
            userName,
            password: Buffer.from(password as string, "utf-8"),
            encryptionAlgorithm: null,
            policyId: userTokenPolicy.policyId
        });
        return userIdentityToken;
    }

    assert(serverCertificate instanceof Buffer);
    serverCertificate = toPem(serverCertificate, "CERTIFICATE");
    const publicKey = extractPublicKeyFromCertificateSync(serverCertificate);

    const serverNonce: Nonce = session.serverNonce || Buffer.alloc(0);
    assert(serverNonce instanceof Buffer);

    // see Release 1.02 155 OPC Unified Architecture, Part 4
    const cryptoFactory = getCryptoFactory(securityPolicy);

    // istanbul ignore next
    if (!cryptoFactory) {
        throw new Error(" Unsupported security Policy");
    }

    userIdentityToken = new UserNameIdentityToken({
        userName,
        password: Buffer.from(password as string, "utf-8"),
        encryptionAlgorithm: cryptoFactory.asymmetricEncryptionAlgorithm,
        policyId: userTokenPolicy.policyId
    });


    // now encrypt password as requested
    const lenBuf = createFastUninitializedBuffer(4);
    lenBuf.writeUInt32LE(userIdentityToken.password.length + serverNonce.length, 0);
    const block = Buffer.concat([lenBuf, userIdentityToken.password, serverNonce]);
    userIdentityToken.password = cryptoFactory.asymmetricEncrypt(block, publicKey);

    return userIdentityToken;
}

export interface OPCUAClientOptions extends OPCUAClientBaseOptions {

    /**
     * the requested session timeout in CreateSession (ms)
     * @default 60000
     */

    requestedSessionTimeout?: number;
    /**
     * the client application name
     * @default "NodeOPCUA-Client"
     */
    applicationName?: string;
    /**
     * set to false if the client should accept server endpoint mismatch
     * @default true
     */
    endpoint_must_exist?: boolean;

// --------------------------------------------------------------------
    connectionStrategy?: ConnectionStrategyOptions;

    /** the server certificate. */
    serverCertificate?: Certificate;

    /***
     * default secure token lifetime in ms
     */
    defaultSecureTokenLifetime?: number;

    /**
     * the security mode
     * @default MessageSecurityMode.None
     */
    securityMode?: MessageSecurityMode | string;

    /**
     * the security policy
     * @default SecurityPolicy.None
     */
    securityPolicy?: SecurityPolicy | string;

    /**
     * @default false
     */
    keepSessionAlive?: boolean;

    /**
     * client certificate pem file.
     * @default "certificates/client_selfsigned_cert_1024.pem"
     */
    certificateFile?: string;

    /**
     * client private key pem file.
     * @default "certificates/client_key_1024.pem"
     */
    privateKeyFile?: string;

    /**
     * a client name string that will be used to generate session names.
     */
    clientName?: string;
}


export interface OPCUAClientPublic extends OPCUAClientBasePublic {


    connect(endpointUrl: string): Promise<void>;

    connect(endpointUrl: string, callback: ErrorCallback): void;

    disconnect(): Promise<void>;

    disconnect(callback: ErrorCallback): void;

    getEndpoints(options?: GetEndpointsOptions): Promise<EndpointDescription[]>;

    getEndpoints(options: GetEndpointsOptions, callback: ResponseCallback<EndpointDescription[]>): void;

    getEndpoints(callback: GetEndpointCallbackFunc): void;


    findServers(options?: FindServersRequestLike): Promise<ApplicationDescription[]>;

    findServers(options: FindServersRequestLike, callback: ResponseCallback<ApplicationDescription[]>): void;

    findServers(callback: ResponseCallback<ApplicationDescription[]>): void;


    createSession(userIdentityInfo?: UserIdentityInfo): Promise<ClientSession>;

    createSession(userIdentityInfo: UserIdentityInfo, callback: (err: Error | null, session?: ClientSession) => void): void;

    createSession(callback: (err: Error | null, session?: ClientSession) => void): void;


    closeSession(session: ClientSession, deleteSubscriptions: boolean): Promise<void>;

    closeSession(session: ClientSession, deleteSubscriptions: boolean, callback: (err?: Error) => void): void;


    withSession(endpointUrl: string, inner_func: (session: ClientSession, done: (err?: Error) => void) => void): Promise<void>;

    withSession(endpointUrl: string, inner_func: (session: ClientSession, done: (err?: Error) => void) => void, callback: (err?: Error) => void): void;

}

/**
 * @class OPCUAClient
 * @extends OPCUAClientBase
 * @param options
 * @param [options.securityMode=MessageSecurityMode.None] {MessageSecurityMode} the default security mode.
 * @param [options.securityPolicy =SecurityPolicy.None] {SecurityPolicy} the security mode.
 * @param [options.requestedSessionTimeout= 60000]            {Number} the requested session time out in CreateSession
 * @param [options.applicationName="NodeOPCUA-Client"]        {string} the client application name
 * @param [options.endpoint_must_exist=true] {Boolean} set to false if the client should accept server endpoint mismatch
 * @param [options.keepSessionAlive=false]{Boolean}
 * @param [options.certificateFile="certificates/client_selfsigned_cert_1024.pem"] {String} client certificate pem file.
 * @param [options.privateKeyFile="certificates/client_key_1024.pem"] {String} client private key pem file.
 * @param [options.clientName=""] {String} a client name string that will be used to generate session names.
 * @constructor
 * @internal
 */
export class OPCUAClient extends OPCUAClientBase implements OPCUAClientPublic {

    private endpoint_must_exist: boolean;
    private requestedSessionTimeout: number;
    private applicationName: string;
    private ___sessionName_counter: number;
    private userIdentityInfo: UserIdentityInfo;
    private endpoint?: EndpointDescription;
    private serverUri?: string;
    private clientNonce?: Nonce;

    constructor(options?: OPCUAClientOptions) {

        options = options || {};
        super(options);

        // @property endpoint_must_exist {Boolean}
        // if set to true , create Session will only accept connection from server which endpoint_url has been reported
        // by GetEndpointsRequest.
        // By default, the client is strict.
        this.endpoint_must_exist = (isNullOrUndefined(options.endpoint_must_exist)) ? true : !!options.endpoint_must_exist;

        this.requestedSessionTimeout = options.requestedSessionTimeout || 60000; // 1 minute

        this.applicationName = options.applicationName || "NodeOPCUA-Client";

        this.___sessionName_counter = 0;
        this.userIdentityInfo = {};
        this.endpoint = undefined;
    }

    /**
     *
     * @private
     */
    _nextSessionName() {
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
    _getApplicationUri() {

        const certificate = this.getCertificate();
        let applicationUri;
        if (certificate) {
            const e = exploreCertificate(certificate);
            applicationUri = e.tbsCertificate.extensions.subjectAltName.uniformResourceIdentifier[0];
        } else {
            const hostname = require("node-opcua-hostname").get_fully_qualified_domain_name();
            applicationUri = makeApplicationUrn(hostname, this.applicationName);
        }
        return applicationUri;

    }

    /**
     *
     * @private
     */
    private __resolveEndPoint() {

        this.securityPolicy = this.securityPolicy || SecurityPolicy.None;

        let endpoint = this.findEndpoint(this._secureChannel.endpointUrl, this.securityMode, this.securityPolicy);
        this.endpoint = endpoint;


        // this is explained here : see OPCUA Part 4 Version 1.02 $5.4.1 page 12:
        //   A  Client  shall verify the  HostName  specified in the  Server Certificate  is the same as the  HostName
        //   contained in the  endpointUrl  provided in the  EndpointDescription. If there is a difference  then  the
        //   Client  shall report the difference and may close the  SecureChannel.

        if (!this.endpoint) {
            if (this.endpoint_must_exist) {
                debugLog("OPCUAClient#endpoint_must_exist = true and endpoint with url ", this._secureChannel.endpointUrl, " cannot be found");
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
    private _createSession(callback: (err: Error | null, session?: ClientSessionImpl) => void) {

        assert(typeof callback === "function");
        assert(this._secureChannel);
        if (!this.__resolveEndPoint() || !this.endpoint) {

            if (this._serverEndpoints) {
                console.log(this._serverEndpoints.map((endpoint) =>
                    endpoint.endpointUrl + " " + endpoint.securityMode.toString() + " " + endpoint.securityPolicyUri));
            }
            return callback(new Error(" End point must exist " + this._secureChannel.endpointUrl));
        }
        this.serverUri = this.endpoint.server.applicationUri || "invalid application uri";
        this.endpointUrl = this._secureChannel.endpointUrl;

        const session = new ClientSessionImpl(this);
        this.__createSession_step2(session, callback);
    }

    /**
     *
     * @private
     */
    __createSession_step2(session: ClientSessionImpl, callback: (err: Error | null, session?: ClientSessionImpl) => void) {


        assert(typeof callback === "function");
        assert(this._secureChannel);
        assert(this.serverUri !== undefined, " must have a valid server URI");
        assert(this.endpointUrl !== undefined, " must have a valid server endpointUrl");
        assert(this.endpoint);


        const applicationUri = this._getApplicationUri();

        const applicationDescription: ApplicationDescriptionOptions = {
            applicationUri,
            productUri: "NodeOPCUA-Client",
            applicationName: new LocalizedText({text: this.applicationName, locale: null}),
            applicationType: ApplicationType.Client,
            gatewayServerUri: undefined,
            discoveryProfileUri: undefined,
            discoveryUrls: []
        };

        // note : do not confuse CreateSessionRequest.clientNonce with OpenSecureChannelRequest.clientNonce
        //        which are two different nonce, with different size (although they share the same name )
        this.clientNonce = crypto.randomBytes(32);

        const request = new CreateSessionRequest({
            clientDescription: applicationDescription,
            serverUri: this.serverUri,
            endpointUrl: this.endpointUrl,
            sessionName: this._nextSessionName(),
            clientNonce: this.clientNonce,
            clientCertificate: this.getCertificate(),
            requestedSessionTimeout: this.requestedSessionTimeout,
            maxResponseMessageSize: 800000
        });

        // a client Nonce must be provided if security mode is set
        assert(this._secureChannel.securityMode === MessageSecurityMode.None || request.clientNonce !== null);

        this.performMessageTransaction(request, (err: Error | null, response?: Response) => {

            if (err) {
                return callback(err);
            }

            if (!response || !(response instanceof CreateSessionResponse)) {
                return callback(new Error("internal error"));
            }

            if (response.responseHeader.serviceResult === StatusCodes.BadTooManySessions) {
                return callback(new Error("Too Many Sessions : " + response.responseHeader.serviceResult.toString()));
            }

            if (response.responseHeader.serviceResult !== StatusCodes.Good) {
                err = new Error("Error " + response.responseHeader.serviceResult.name + " " + response.responseHeader.serviceResult.description);
                return callback(err);
            }

            // istanbul ignore next
            if (!validateServerNonce(response.serverNonce)) {
                return callback(new Error("invalid server Nonce"));
            }

            // todo: verify SignedSoftwareCertificates and  response.serverSignature

            session = session || new ClientSessionImpl(this);
            session.name = request.sessionName || "";
            session.sessionId = response.sessionId;
            session.authenticationToken = response.authenticationToken;
            session.timeout = response.revisedSessionTimeout;
            session.serverNonce = response.serverNonce;
            session.serverCertificate = response.serverCertificate;
            session.serverSignature = response.serverSignature;

            debugLog("revised session timeout = ", session.timeout);

            response.serverEndpoints = response.serverEndpoints || [];

            if (!verifyEndpointDescriptionMatches(this, response.serverEndpoints)) {
                console.log("Endpoint description previously retrieved with GetendpointsDescription");
                console.log("CreateSessionResponse.serverEndpoints= ");
                console.log(response.serverEndpoints);
                return callback(new Error("Invalid endpoint descriptions Found"));
            }
            // this._serverEndpoints = response.serverEndpoints;
            session.serverEndpoints = response.serverEndpoints;
            callback(null, session);
        });

    }

    /**
     *
     * @private
     */
    computeClientSignature(
        channel: ClientSecureChannelLayer,
        serverCertificate: Buffer,
        serverNonce: Nonce | undefined
    ) {
        return computeSignature(
            serverCertificate,
            serverNonce || Buffer.alloc(0),
            this.getPrivateKey(),
            channel.securityPolicy
        );
    }

    /**
     *
     * @private
     */
    createUserIdentityToken(
        session: ClientSessionImpl,
        userIdentityInfo: UserIdentityInfo,
        callback: (err: Error | null, identityToken?: any | null) => void
    ) {
        assert(_.isFunction(callback));
        if (null === userIdentityInfo) {
            return callback(null, null);
        }
        if (isAnonymous(userIdentityInfo)) {
            try {
                const userIdentityToken = createAnonymousIdentityToken(session);
                return callback(null, userIdentityToken);
            }
            catch (err) {
                return callback(err);
            }

        } else if (isUserNamePassword(userIdentityInfo)) {

            const userName = this.userIdentityInfo.userName || "";
            const password = this.userIdentityInfo.password || "";

            try {
                const userIdentityToken = createUserNameIdentityToken(session, userName, password);
                return callback(null, userIdentityToken);
            }
            catch (err) {
                return callback(err);
            }
        } else {
            console.log(" userIdentityInfo = ", userIdentityInfo);
            return callback(new Error("CLIENT: Invalid userIdentityInfo"));
        }
    }


    /**
     *
     * @private
     */
    public _activateSession(session: ClientSessionImpl, callback: (err: Error | null, session?: ClientSessionImpl) => void) {

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

        this.createUserIdentityToken(session, this.userIdentityInfo, (err: Error | null, userIdentityToken: IssuedIdentityToken) => {

            if (err) {
                session._client = _old_client;
                return callback(err);
            }

            // TODO. fill the ActivateSessionRequest
            // see 5.6.3.2 Parameters OPC Unified Architecture, Part 4 30 Release 1.02
            const request = new ActivateSessionRequest({

                // This is a signature generated with the private key associated with the
                // clientCertificate. The SignatureAlgorithm shall be the AsymmetricSignatureAlgorithm
                // specified in the SecurityPolicy for the Endpoint. The SignatureData type is defined in 7.30.

                clientSignature: this.computeClientSignature(this._secureChannel, serverCertificate, serverNonce) || undefined,

                // These are the SoftwareCertificates which have been issued to the Client application. The productUri contained
                // in the SoftwareCertificates shall match the productUri in the ApplicationDescription passed by the Client in
                // the CreateSession requests. Certificates without matching productUri should be ignored.  Servers may reject
                // connections from Clients if they are not satisfied with the SoftwareCertificates provided by the Client.
                // This parameter only needs to be specified in the first ActivateSession request after CreateSession.
                // It shall always be omitted if the maxRequestMessageSize returned from the Server in the CreateSession
                // response is less than one megabyte. The SignedSoftwareCertificate type is defined in 7.31.

                clientSoftwareCertificates: [],

                // List of locale ids in priority order for localized strings. The first LocaleId in the list has the highest
                // priority. If the Server returns a localized string to the Client, the Server shall return the translation
                // with the highest priority that it can. If it does not have a translation for any of the locales identified
                // in this list, then it shall return the string value that it has and include the locale id with the string.
                // See Part 3 for more detail on locale ids. If the Client fails to specify at least one locale id, the Server
                // shall use any that it has.
                // This parameter only needs to be specified during the first call to ActivateSession during a single
                // application Session. If it is not specified the Server shall keep using the current localeIds for the Session.
                localeIds: [],

                // The credentials of the user associated with the Client application. The Server uses these credentials to
                // determine whether the Client should be allowed to activate a Session and what resources the Client has access
                // to during this Session. The UserIdentityToken is an extensible parameter type defined in 7.35.
                // The EndpointDescription specifies what UserIdentityTokens the Server shall accept.
                userIdentityToken,

                // If the Client specified a user   identity token that supports digital signatures,
                // then it shall create a signature and pass it as this parameter. Otherwise the parameter is omitted.
                // The SignatureAlgorithm depends on the identity token type.
                userTokenSignature: {
                    algorithm: undefined,
                    signature: undefined
                }

            });

            session.performMessageTransaction(request, (err: Error | null, response?: Response) => {

                if (!err && response && response.responseHeader.serviceResult === StatusCodes.Good) {

                    if (!(response instanceof ActivateSessionResponse)) {
                        return callback(new Error("Internal Error"));
                    }

                    session.serverNonce = response.serverNonce;

                    if (!validateServerNonce(session.serverNonce)) {
                        return callback(new Error("Invalid server Nonce"));
                    }
                    return callback(null, session);

                } else {
                    if (!err && response) {
                        err = new Error(response.responseHeader.serviceResult.toString());
                    }
                    session._client = _old_client;
                    return callback(err);
                }
            });
        });
    }

    /**
     * transfer session to this client
     * @method reactivateSession
     * @param session
     * @param callback
     * @return {*}
     */
    private reactivateSession(session: ClientSession, callback: (err?: Error) => void) {

        const internalSession = session as ClientSessionImpl;

        assert(typeof callback === "function");
        assert(this._secureChannel, " client must be connected first");

        // istanbul ignore next
        if (!this.__resolveEndPoint() || !this.endpoint) {
            return callback(new Error(" End point must exist " + this._secureChannel.endpointUrl));
        }

        assert(!internalSession._client || internalSession._client.endpointUrl === this.endpointUrl, "cannot reactivateSession on a different endpoint");
        const old_client = internalSession._client;

        debugLog("OPCUAClient#reactivateSession");

        this._activateSession(internalSession, (err: Error | null, newSession?: ClientSessionImpl) => {
            if (!err) {

                if (old_client !== this) {
                    // remove session from old client:
                    if (old_client) {
                        old_client._removeSession(internalSession);
                        assert(!_.contains(old_client._sessions, internalSession));
                    }

                    this._addSession(internalSession);
                    assert(internalSession._client === this);
                    assert(!internalSession._closed, "session should not vbe closed");
                    assert(_.contains(this._sessions, internalSession));
                }
                callback();

            } else {

                // istanbul ignore next
                if (doDebug) {
                    console.log(chalk.red.bgWhite("reactivateSession has failed !"), err.message);
                }
                callback(err);
            }
        });
    }

    /**
     * create and activate a new session
     * @async
     * @method createSession
     *
     * @param [userIdentityInfo {Object} ] optional
     * @param [userIdentityInfo.userName {String} ]
     * @param [userIdentityInfo.password {String} ]
     *
     * @param callback {Function}
     * @param callback.err     {Error|null}   - the Error if the async method has failed
     * @param callback.session {ClientSession} - the created session object.
     *
     *
     * @example :
     *     // create a anonymous session
     *     client.createSession(function(err,session) {
     *       if (err) {} else {}
     *     });
     *
     * @example :
     *     // create a session with a userName and password
     *     client.createSession({userName: "JoeDoe", password:"secret"}, function(err,session) {
     *       if (err) {} else {}
     *     });
     *
     */
    async createSession(userIdentityInfo?: UserIdentityInfo): Promise<ClientSession>;
    createSession(userIdentityInfo?: UserIdentityInfo): Promise<ClientSession>;
    createSession(userIdentityInfo: UserIdentityInfo, callback: (err: Error | null, session?: ClientSession) => void): void ;
    createSession(callback: (err: Error | null, session?: ClientSession) => void): void;
    createSession(...args: any[]): any {

        if (args.length === 1) {
            return this.createSession({}, args[0]);
        }
        const userIdentityInfo = args[0];
        const callback = args[1];

        this.userIdentityInfo = userIdentityInfo;

        assert(_.isFunction(callback));

        this._createSession((err: Error | null, session?: ClientSessionImpl) => {
            if (err) {
                callback(err);
            } else {

                if (!session) {
                    return callback(new Error("Internal Error"));
                }

                this._addSession(session);

                this._activateSession(session, (err: Error | null, session2?: ClientSessionImpl) => {
                    callback(err, session);
                });
            }
        });
    }


    /**
     * @method changeSessionIdentity
     * @param session
     * @param userIdentityInfo
     * @param callback
     * @async
     */
    changeSessionIdentity(
        session: ClientSession,
        userIdentityInfo: UserIdentityInfo,
        callback: (err?: Error) => void
    ) {

        assert(_.isFunction(callback));

        const old_userIdentity = this.userIdentityInfo;
        this.userIdentityInfo = userIdentityInfo;

        this._activateSession(session as ClientSessionImpl, (err: Error | null, session?: ClientSessionImpl) => {
            callback(err ? err : undefined);
        });
    }

    private _closeSession(
        session: ClientSessionImpl,
        deleteSubscriptions: boolean,
        callback: (err: Error | null, response?: CloseSessionResponse) => void
    ) {

        assert(_.isFunction(callback));
        assert(_.isBoolean(deleteSubscriptions));

        // istanbul ignore next
        if (!this._secureChannel) {
            return callback(new Error("no channel"));
        }
        assert(this._secureChannel);
        if (!this._secureChannel.isValid()) {
            return callback(new Error("invalid channel"));
        }


        if (this.isReconnecting) {
            console.log("OPCUAClient#_closeSession called while reconnection in progress ! What shall we do");
            return callback(null);
        }

        const request = new CloseSessionRequest({
            deleteSubscriptions
        });

        session.performMessageTransaction(request, (err: Error | null, response?: Response) => {

            if (err) {
                callback(err);
            } else {
                callback(err, response);
            }
        });
    }

    /**
     *
     * @method closeSession
     * @async
     * @param session  {ClientSession} - the created client session
     * @param deleteSubscriptions  {Boolean} - whether to delete subscriptions or not
     * @param callback {Function} - the callback
     * @param callback.err {Error|null}   - the Error if the async method has failed
     */
    closeSession(session: ClientSession, deleteSubscriptions: boolean): Promise<void>;
    closeSession(session: ClientSession, deleteSubscriptions: boolean, callback: (err?: Error) => void): void;
    closeSession(...args: any []): any {

        const session = args[0] as ClientSessionImpl;
        const deleteSubscriptions = args[1];
        const callback = args[2];

        assert(_.isBoolean(deleteSubscriptions));
        assert(_.isFunction(callback));
        assert(session);
        assert(session._client === this, "session must be attached to this");
        session._closed = true;

        // todo : send close session on secure channel
        this._closeSession(session, deleteSubscriptions, (err?: Error | null, response?: CloseSessionResponse) => {

            session.emitCloseEvent(StatusCodes.Good);

            this._removeSession(session);
            session.dispose();

            assert(!_.contains(this._sessions, session));
            assert(session._closed, "session must indicate it is closed");

            callback(err ? err : undefined);
        });
    }


    /**
     *
     * @private
     */
    public _on_connection_reestablished(callback: (err?: Error) => void) {

        assert(_.isFunction(callback));

        // call base class implementation first
        OPCUAClientBase.prototype._on_connection_reestablished.call(this, (err?: Error) => {
            repair_client_sessions(this, callback);
        });

    }


    toString() {
        OPCUAClientBase.prototype.toString.call(this);
        console.log("  requestedSessionTimeout....... ", this.requestedSessionTimeout);
        console.log("  endpointUrl................... ", this.endpointUrl);
        console.log("  serverUri..................... ", this.serverUri);
    }

    /**
     * @method withSession
     */

    withSession(
        endpointUrl: string,
        inner_func: (session: ClientSession, done: (err?: Error) => void) => void
    ): Promise<void>;

    withSession(
        endpointUrl: string,
        inner_func: (session: ClientSession, done: (err?: Error) => void) => void,
        callback: (err?: Error) => void
    ): void;

    withSession(...args: any[]): any {

        const endpointUrl = args[0];
        const inner_func = args[1];
        const callback = args[2];

        assert(_.isFunction(inner_func), "expecting inner function");
        assert(_.isFunction(callback), "expecting callback function");

        let theSession: ClientSession;
        let the_error: Error | undefined;

        let need_disconnect = false;
        async.series([

            // step 1 : connect to
            (callback: ErrorCallback) => {
                this.connect(endpointUrl, (err?: Error) => {
                    need_disconnect = true;
                    if (err) {
                        console.log(" cannot connect to endpoint :", endpointUrl);
                    }
                    callback(err);
                });
            },

            // step 2 : createSession
            (callback: ErrorCallback) => {
                this.createSession((err: Error | null, session?: ClientSession) => {
                    if (err) {
                        return callback(err);
                    }
                    if (!session) {
                        return callback(new Error("internal error"));
                    }
                    theSession = session;
                    callback();
                });
            },

            (callback: ErrorCallback) => {
                try {
                    inner_func(theSession, (err?: Error) => {
                        the_error = err;
                        callback();
                    });
                }
                catch (err) {
                    console.log("OPCUAClient#withClientSession", err.message);
                    the_error = err;
                    callback();
                }
            },

            // close session
            (callback: ErrorCallback) => {
                theSession.close(/*deleteSubscriptions=*/true, (err?: Error) => {
                    if (err) {
                        console.log("OPCUAClient#withClientSession: session closed failed ?");
                    }
                    callback();
                });
            },

            (callback: ErrorCallback) => {
                this.disconnect((err?: Error) => {
                    need_disconnect = false;
                    if (err) {
                        console.log("OPCUAClient#withClientSession: client disconnect failed ?");
                    }
                    callback();
                });
            }

        ], (err1) => {
            if (need_disconnect) {
                console.log("Disconnecting client after failure");
                this.disconnect((err2) => {
                    return callback(the_error || err1 || err2);
                });
            } else {
                return callback(the_error || err1);
            }
        });
    }

    withSubscription(
        endpointUrl: string,
        subscriptionParameters: ClientSubscriptionOptions,
        innerFunc: (session: ClientSession, subscription: ClientSubscription, done: (err?: Error) => void) => void,
        callback: (err?: Error) => void
    ) {

        assert(_.isFunction(innerFunc));
        assert(_.isFunction(callback));

        this.withSession(endpointUrl, (session: ClientSession, done: (err?: Error) => void) => {

            assert(_.isFunction(done));

            const subscription = new ClientSubscription(session as ClientSessionImpl, subscriptionParameters);

            try {
                innerFunc(session, subscription, (err?: Error) => {

                    subscription.terminate((err?: Error) => {
                        done(err);
                    });
                });

            }
            catch (err) {
                console.log(err);
                done(err);
            }
        }, callback);
    }


    async withSessionAsync(endpointUrl: string, func: WithSessionFunc): Promise<void> {
        return;
    }

    async withSubscriptionAsync(
        endpointUrl: string,
        parameters: any, func: WithSubscriptionFunc): Promise<void> {
        return;
    }
}

export type WithSessionFunc = (session: ClientSession) => Promise<void>;
export type WithSubscriptionFunc = (session: ClientSession, subscription: ClientSubscription) => Promise<void>;


const thenify = require("thenify");
/**
 * @method connect
 * @param endpointUrl {string}
 * @async
 * @return {Promise}
 */
OPCUAClient.prototype.connect = thenify.withCallback(OPCUAClient.prototype.connect);
/**
 * @method disconnect
 * disconnect client from server
 * @return {Promise}
 * @async
 */
OPCUAClient.prototype.disconnect = thenify.withCallback(OPCUAClient.prototype.disconnect);
/**
 * @method createSession
 * @param [userIdentityInfo {Object} ] optional
 * @param [userIdentityInfo.userName {String} ]
 * @param [userIdentityInfo.password {String} ]
 * @return {Promise}
 * @async
 *
 * @example
 *     // create a anonymous session
 *     const session = await client.createSession();
 *
 * @example
 *     // create a session with a userName and password
 *     const userIdentityInfo  = { userName: "JoeDoe", password:"secret"};
 *     const session = client.createSession(userIdentityInfo);
 *
 */
OPCUAClient.prototype.createSession = thenify.withCallback(OPCUAClient.prototype.createSession);
/**
 * @method changeSessionIdentity
 * @param session
 * @param userIdentityInfo
 * @return {Promise}
 * @async
 */
OPCUAClient.prototype.changeSessionIdentity = thenify.withCallback(OPCUAClient.prototype.changeSessionIdentity);
/**
 * @method closeSession
 * @param session {ClientSession}
 * @param deleteSubscriptions  {Boolean} - whether to delete
 * @return {Promise}
 * @async
 * @example
 *    const session  = await client.createSession();
 *    await client.closeSession(session);
 */
OPCUAClient.prototype.closeSession = thenify.withCallback(OPCUAClient.prototype.closeSession);


// OPCUAClient.prototype.withSubscription = thenify(OPCUAClient.prototype.withSubscription);
const m = process.version.match(/v([0-9]*)\./);
const nodeVersion = m ? parseInt(m[1]) : 0;

if (nodeVersion >= 8) {
// xx     require("./opcua_client_es2017_extensions");
}

