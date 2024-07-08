/* eslint-disable max-statements */
/**
 * @module node-opcua-server
 */
// tslint:disable:no-console
import { EventEmitter } from "events";
import net from "net";
import { Server, Socket } from "net";
import chalk from "chalk";
import async from "async";

import { assert } from "node-opcua-assert";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { Certificate, PrivateKey, makePrivateKeyThumbPrint, makeSHA1Thumbprint, split_der } from "node-opcua-crypto";
import { checkDebugFlag, make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";
import { getFullyQualifiedDomainName, resolveFullyQualifiedDomainName } from "node-opcua-hostname";
import {
    fromURI,
    MessageSecurityMode,
    SecurityPolicy,
    ServerSecureChannelLayer,
    ServerSecureChannelParent,
    toURI,
    IServerSessionBase,
    Message
} from "node-opcua-secure-channel";
import { UserTokenType } from "node-opcua-service-endpoints";
import { EndpointDescription } from "node-opcua-service-endpoints";
import { ApplicationDescription } from "node-opcua-service-endpoints";
import { UserTokenPolicyOptions } from "node-opcua-types";
import { IHelloAckLimits } from "node-opcua-transport";

import { IChannelData } from "./i_channel_data";
import { ISocketData } from "./i_socket_data";

const debugLog = make_debugLog(__filename);
const errorLog = make_errorLog(__filename);
const warningLog = make_warningLog(__filename);
const doDebug = checkDebugFlag(__filename);

const default_transportProfileUri = "http://opcfoundation.org/UA-Profile/Transport/uatcp-uasc-uabinary";

function extractSocketData(socket: net.Socket, reason: string): ISocketData {
    const { bytesRead, bytesWritten, remoteAddress, remoteFamily, remotePort, localAddress, localPort } = socket;
    const data: ISocketData = {
        bytesRead,
        bytesWritten,
        localAddress,
        localPort,
        remoteAddress,
        remoteFamily,
        remotePort,
        timestamp: new Date(),
        reason
    };
    return data;
}

function extractChannelData(channel: ServerSecureChannelLayer): IChannelData {
    const {
        channelId,
        clientCertificate,
        securityMode,
        securityPolicy,
        timeout,
        transactionsCount
    } = channel;

    const channelData: IChannelData = {
        channelId,
        clientCertificate,
        securityMode,
        securityPolicy,
        timeout,
        transactionsCount
    };
    return channelData;
}

function dumpChannelInfo(channels: ServerSecureChannelLayer[]): void {
    function d(s: IServerSessionBase) {
        return `[ status=${s.status} lastSeen=${s.clientLastContactTime.toFixed(0)}ms sessionName=${s.sessionName} timeout=${
            s.sessionTimeout
        } ]`;
    }
    function dumpChannel(channel: ServerSecureChannelLayer): void {
        console.log("------------------------------------------------------");
        console.log("            channelId = ", channel.channelId);
        console.log("             timeout  = ", channel.timeout);
        console.log("        remoteAddress = ", channel.remoteAddress);
        console.log("        remotePort    = ", channel.remotePort);
        console.log("");
        console.log("        bytesWritten  = ", channel.bytesWritten);
        console.log("        bytesRead     = ", channel.bytesRead);
        console.log("        sessions      = ", Object.keys(channel.sessionTokens).length);
        console.log(Object.values(channel.sessionTokens).map(d).join("\n"));

        const socket = (channel as any).transport?._socket;
        if (!socket) {
            console.log(" SOCKET IS CLOSED");
        }
    }

    for (const channel of channels) {
        dumpChannel(channel);
    }
    console.log("------------------------------------------------------");
}

const emptyCertificate = Buffer.alloc(0);
const emptyPrivateKey = null as any as PrivateKey;

let OPCUAServerEndPointCounter = 0;

export interface OPCUAServerEndPointOptions {
    /**
     * the tcp port
     */
    port: number;
    /**
     * the tcp host
     */
    host?: string;
    /**
     * the DER certificate chain
     */
    certificateChain: Certificate;

    /**
     * privateKey
     */
    privateKey: PrivateKey;

    certificateManager: OPCUACertificateManager;

    /**
     *  the default secureToken lifetime @default=60000
     */
    defaultSecureTokenLifetime?: number;

    /**
     * the maximum number of connection allowed on the TCP server socket
     * @default 20
     */
    maxConnections?: number;

    /**
     *  the  timeout for the TCP HEL/ACK transaction (in ms)
     *  @default 30000
     */
    timeout?: number;

    serverInfo: ApplicationDescription;

    objectFactory?: any;

    transportSettings?: IServerTransportSettings;
}

export interface IServerTransportSettings {
    adjustTransportLimits: (hello: IHelloAckLimits) => IHelloAckLimits;
}

export interface EndpointDescriptionParams {
    restricted?: boolean;
    allowUnsecurePassword?: boolean;
    resourcePath?: string;
    alternateHostname?: string[];
    hostname: string;
    securityPolicies: SecurityPolicy[];
    userTokenTypes: UserTokenType[];
}

export interface AddStandardEndpointDescriptionsParam {
    allowAnonymous?: boolean;
    disableDiscovery?: boolean;
    securityModes?: MessageSecurityMode[];

    restricted?: boolean;
    allowUnsecurePassword?: boolean;
    resourcePath?: string;
    alternateHostname?: string[];
    hostname?: string;
    securityPolicies?: SecurityPolicy[];
    userTokenTypes?: UserTokenType[];
}

function getUniqueName(name: string, collection: { [key: string]: number }) {
    if (collection[name]) {
        let counter = 0;
        while (collection[name + "_" + counter.toString()]) {
            counter++;
        }
        name = name + "_" + counter.toString();
        collection[name] = 1;
        return name;
    } else {
        collection[name] = 1;
        return name;
    }
}

interface ServerSecureChannelLayerPriv extends ServerSecureChannelLayer {
    _unpreregisterChannelEvent?: () => void;
}
/**
 * OPCUAServerEndPoint a Server EndPoint.
 * A sever end point is listening to one port
 * note:
 *   see OPCUA Release 1.03 part 4 page 108 7.1 ApplicationDescription
 */
export class OPCUAServerEndPoint extends EventEmitter implements ServerSecureChannelParent {
    /**
     * the tcp port
     */
    public port: number;
    public host: string | undefined;
    public certificateManager: OPCUACertificateManager;
    public defaultSecureTokenLifetime: number;
    public maxConnections: number;
    public timeout: number;
    public bytesWrittenInOldChannels: number;
    public bytesReadInOldChannels: number;
    public transactionsCountOldChannels: number;
    public securityTokenCountOldChannels: number;
    public serverInfo: ApplicationDescription;
    public objectFactory: any;

    public _on_new_channel?: (channel: ServerSecureChannelLayer) => void;
    public _on_close_channel?: (channel: ServerSecureChannelLayer) => void;
    public _on_connectionRefused?: (socketData: any) => void;
    public _on_openSecureChannelFailure?: (socketData: any, channelData: any) => void;

    private _certificateChain: Certificate;
    private _privateKey: PrivateKey;
    private _channels: { [key: string]: ServerSecureChannelLayer };
    private _server?: Server;
    private _endpoints: EndpointDescription[];
    private _listen_callback?: (err?: Error) => void;
    private _started = false;
    private _counter = OPCUAServerEndPointCounter++;
    private _policy_deduplicator: { [key: string]: number } = {};

    private transportSettings?: IServerTransportSettings;
    constructor(options: OPCUAServerEndPointOptions) {
        super();

        assert(!Object.prototype.hasOwnProperty.call(options, "certificate"), "expecting a certificateChain instead");
        assert(Object.prototype.hasOwnProperty.call(options, "certificateChain"), "expecting a certificateChain");
        assert(Object.prototype.hasOwnProperty.call(options, "privateKey"));

        this.certificateManager = options.certificateManager;

        options.port = options.port || 0;

        this.port = parseInt(options.port.toString(), 10);
        this.host = options.host;
        assert(typeof this.port === "number");

        this._certificateChain = options.certificateChain;
        this._privateKey = options.privateKey;

        this._channels = {};

        this.defaultSecureTokenLifetime = options.defaultSecureTokenLifetime || 600000;

        this.maxConnections = options.maxConnections || 20;

        this.timeout = options.timeout || 30000;

        this._server = undefined;

        this._setup_server();

        this._endpoints = [];

        this.objectFactory = options.objectFactory;

        this.bytesWrittenInOldChannels = 0;
        this.bytesReadInOldChannels = 0;
        this.transactionsCountOldChannels = 0;
        this.securityTokenCountOldChannels = 0;

        this.serverInfo = options.serverInfo;
        assert(this.serverInfo !== null && typeof this.serverInfo === "object");

        this.transportSettings = options.transportSettings;
    }

    public dispose(): void {
        this._certificateChain = emptyCertificate;
        this._privateKey = emptyPrivateKey;

        assert(Object.keys(this._channels).length === 0, "OPCUAServerEndPoint channels must have been deleted");

        this._channels = {};
        this.serverInfo = new ApplicationDescription({});

        this._endpoints = [];
        assert(this._endpoints.length === 0, "endpoints must have been deleted");
        this._endpoints = [];

        this._server = undefined;
        this._listen_callback = undefined;

        this.removeAllListeners();
    }

    public toString(): string {
        const privateKeyThumpPrint = makePrivateKeyThumbPrint(this.getPrivateKey());

        const txt =
            " end point" +
            this._counter +
            " port = " +
            this.port +
            " l = " +
            this._endpoints.length +
            " " +
            makeSHA1Thumbprint(this.getCertificateChain()).toString("hex") +
            " " +
            privateKeyThumpPrint.toString("hex");
        return txt;
    }

    public getChannels(): ServerSecureChannelLayer[] {
        return Object.values(this._channels);
    }

    /**
     * Returns the X509 DER form of the server certificate
     */
    public getCertificate(): Certificate {
        return split_der(this.getCertificateChain())[0];
    }

    /**
     * Returns the X509 DER form of the server certificate
     */
    public getCertificateChain(): Certificate {
        return this._certificateChain;
    }

    /**
     * the private key
     */
    public getPrivateKey(): PrivateKey {
        return this._privateKey;
    }

    /**
     * The number of active channel on this end point.
     */
    public get currentChannelCount(): number {
        return Object.keys(this._channels).length;
    }

    /**
     * @method getEndpointDescription
     * @param securityMode
     * @param securityPolicy
     * @return endpoint_description {EndpointDescription|null}
     */
    public getEndpointDescription(
        securityMode: MessageSecurityMode,
        securityPolicy: SecurityPolicy,
        endpointUrl: string | null
    ): EndpointDescription | null {
        const endpoints = this.endpointDescriptions();
        const arr = endpoints.filter(matching_endpoint.bind(this, securityMode, securityPolicy, endpointUrl));

        if (endpointUrl && endpointUrl.length > 0 && !(arr.length === 0 || arr.length === 1)) {
            errorLog("Several matching endpoints have been found : ");
            for (const a of arr) {
                errorLog("   ", a.endpointUrl, MessageSecurityMode[securityMode], securityPolicy);
            }
        }
        return arr.length === 0 ? null : arr[0];
    }

    public addEndpointDescription(
        securityMode: MessageSecurityMode,
        securityPolicy: SecurityPolicy,
        options: EndpointDescriptionParams
    ): void {
        // istanbul ignore next
        if (securityMode === MessageSecurityMode.None && securityPolicy !== SecurityPolicy.None) {
            throw new Error(" invalid security ");
        }
        // istanbul ignore next
        if (securityMode !== MessageSecurityMode.None && securityPolicy === SecurityPolicy.None) {
            throw new Error(" invalid security ");
        }
        //

        // resource Path is a string added at the end of the url such as "/UA/Server"
        const resourcePath = (options.resourcePath || "").replace(/\\/g, "/");

        assert(resourcePath.length === 0 || resourcePath.charAt(0) === "/", "resourcePath should start with /");

        const hostname = options.hostname || getFullyQualifiedDomainName();
        const endpointUrl = `opc.tcp://${hostname}:${this.port}${resourcePath}`;

        const endpoint_desc = this.getEndpointDescription(securityMode, securityPolicy, endpointUrl);

        // istanbul ignore next
        if (endpoint_desc) {
            throw new Error(" endpoint already exist");
        }

        const userTokenTypes = options.userTokenTypes;

        // now build endpointUrl
        this._endpoints.push(
            _makeEndpointDescription(
                {
                    collection: this._policy_deduplicator,
                    hostname,
                    server: this.serverInfo,
                    serverCertificateChain: this.getCertificateChain(),

                    securityMode,
                    securityPolicy,

                    allowUnsecurePassword: options.allowUnsecurePassword,
                    resourcePath: options.resourcePath,

                    restricted: !!options.restricted,
                    securityPolicies: options.securityPolicies || [],

                    userTokenTypes
                },
                this
            )
        );
    }

    public addRestrictedEndpointDescription(options: EndpointDescriptionParams): void {
        options = { ...options };
        options.restricted = true;
        return this.addEndpointDescription(MessageSecurityMode.None, SecurityPolicy.None, options);
    }

    public addStandardEndpointDescriptions(options?: AddStandardEndpointDescriptionsParam): void {
        options = options || {};

        options.securityModes = options.securityModes || defaultSecurityModes;
        options.securityPolicies = options.securityPolicies || defaultSecurityPolicies;
        options.userTokenTypes = options.userTokenTypes || defaultUserTokenTypes;

        options.allowAnonymous = options.allowAnonymous === undefined ? true : options.allowAnonymous;
        // make sure we do not have anonymous
        if (!options.allowAnonymous) {
            options.userTokenTypes = options.userTokenTypes.filter((r) => r !== UserTokenType.Anonymous);
        }

        const defaultHostname = options.hostname || getFullyQualifiedDomainName();

        let hostnames: string[] = [defaultHostname];

        options.alternateHostname = options.alternateHostname || [];
        if (typeof options.alternateHostname === "string") {
            options.alternateHostname = [options.alternateHostname];
        }
        // remove duplicates if any (uniq)
        hostnames = [...new Set(hostnames.concat(options.alternateHostname))];

        for (const alternateHostname of hostnames) {
            const optionsE: EndpointDescriptionParams = {
                hostname: alternateHostname,
                securityPolicies: options.securityPolicies,
                userTokenTypes: options.userTokenTypes,
                allowUnsecurePassword: options.allowUnsecurePassword,
                alternateHostname: options.alternateHostname,
                resourcePath: options.resourcePath
            };

            if (options.securityModes.indexOf(MessageSecurityMode.None) >= 0) {
                this.addEndpointDescription(MessageSecurityMode.None, SecurityPolicy.None, optionsE);
            } else {
                if (!options.disableDiscovery) {
                    this.addRestrictedEndpointDescription(optionsE);
                }
            }
            for (const securityMode of options.securityModes) {
                if (securityMode === MessageSecurityMode.None) {
                    continue;
                }
                for (const securityPolicy of options.securityPolicies) {
                    if (securityPolicy === SecurityPolicy.None) {
                        continue;
                    }
                    this.addEndpointDescription(securityMode, securityPolicy, optionsE);
                }
            }
        }
    }

    /**
     * returns the list of end point descriptions.
     */
    public endpointDescriptions(): EndpointDescription[] {
        return this._endpoints;
    }

    /**
     * @method listen
     * @async
     */
    public listen(callback: (err?: Error) => void): void {
        assert(typeof callback === "function");
        assert(!this._started, "OPCUAServerEndPoint is already listening");

        this._listen_callback = callback;

        this._server!.on("error", (err: Error) => {
            debugLog(chalk.red.bold(" error") + " port = " + this.port, err);
            this._started = false;
            this._end_listen(err);
        });
        this._server!.on("listening", () => {
            debugLog("server is listening");
        });

        const listenOptions: net.ListenOptions = {
            port: this.port,
            host: this.host
        };

        this._server!.listen(
            listenOptions,
            /*"::",*/ (err?: Error) => {
                // 'listening' listener
                debugLog(chalk.green.bold("LISTENING TO PORT "), this.port, "err  ", err);
                assert(!err, " cannot listen to port ");
                this._started = true;
                if (!this.port) {
                    const add = this._server!.address()!;
                    this.port = typeof add !== "string" ? add.port : this.port;
                }
                this._end_listen();
            }
        );
    }

    public killClientSockets(callback: (err?: Error) => void): void {
        for (const channel of this.getChannels()) {
            const hacked_channel = channel as any;
            if (hacked_channel.transport && hacked_channel.transport._socket) {
                // hacked_channel.transport._socket.close();
                hacked_channel.transport._socket.destroy();
                hacked_channel.transport._socket.emit("error", new Error("EPIPE"));
            }
        }
        callback();
    }

    public suspendConnection(callback: (err?: Error) => void): void {
        if (!this._started) {
            return callback(new Error("Connection already suspended !!"));
        }

        // Stops the server from accepting new connections and keeps existing connections.
        // (note from nodejs doc: This function is asynchronous, the server is finally closed
        // when all connections are ended and the server emits a 'close' event.
        // The optional callback will be called once the 'close' event occurs.
        // Unlike that event, it will be called with an Error as its only argument
        // if the server was not open when it was closed.
        this._server!.close(() => {
            this._started = false;
            debugLog("Connection has been closed !" + this.port);
        });
        this._started = false;
        callback();
    }

    public restoreConnection(callback: (err?: Error) => void): void {
        this.listen(callback);
    }

    public abruptlyInterruptChannels(): void {
        for (const channel of Object.values(this._channels)) {
            channel.abruptlyInterrupt();
        }
    }

    /**
     * @method shutdown
     * @async
     */
    public shutdown(callback: (err?: Error) => void): void {
        debugLog("OPCUAServerEndPoint#shutdown ");

        if (this._started) {
            // make sure we don't accept new connection any more ...
            this.suspendConnection(() => {
                // shutdown all opened channels ...
                const _channels = Object.values(this._channels);
                async.each(
                    _channels,
                    (channel: ServerSecureChannelLayer, callback1: (err?: Error) => void) => {
                        this.shutdown_channel(channel, callback1);
                    },
                    (err?: Error | null) => {
                        /* istanbul ignore next */
                        if (!(Object.keys(this._channels).length === 0)) {
                            errorLog(" Bad !");
                        }
                        assert(Object.keys(this._channels).length === 0, "channel must have unregistered themselves");
                        callback(err || undefined);
                    }
                );
            });
        } else {
            callback();
        }
    }

    /**
     * @method start
     * @async
     * @param callback
     */
    public start(callback: (err?: Error) => void): void {
        assert(typeof callback === "function");
        this.listen(callback);
    }

    public get bytesWritten(): number {
        const channels = Object.values(this._channels);
        return (
            this.bytesWrittenInOldChannels +
            channels.reduce((accumulated: number, channel: ServerSecureChannelLayer) => {
                return accumulated + channel.bytesWritten;
            }, 0)
        );
    }

    public get bytesRead(): number {
        const channels = Object.values(this._channels);
        return (
            this.bytesReadInOldChannels +
            channels.reduce((accumulated: number, channel: ServerSecureChannelLayer) => {
                return accumulated + channel.bytesRead;
            }, 0)
        );
    }

    public get transactionsCount(): number {
        const channels = Object.values(this._channels);
        return (
            this.transactionsCountOldChannels +
            channels.reduce((accumulated: number, channel: ServerSecureChannelLayer) => {
                return accumulated + channel.transactionsCount;
            }, 0)
        );
    }

    public get securityTokenCount(): number {
        const channels = Object.values(this._channels);
        return (
            this.securityTokenCountOldChannels +
            channels.reduce((accumulated: number, channel: ServerSecureChannelLayer) => {
                return accumulated + channel.securityTokenCount;
            }, 0)
        );
    }

    public get activeChannelCount(): number {
        return Object.keys(this._channels).length;
    }

    private _dump_statistics() {
        this._server!.getConnections((err: Error | null, count: number) => {
            debugLog(chalk.cyan("CONCURRENT CONNECTION = "), count);
        });
        debugLog(chalk.cyan("MAX CONNECTIONS = "), this._server!.maxConnections);
    }

    private _setup_server() {
        assert(!this._server);
        this._server = net.createServer({ pauseOnConnect: true }, this._on_client_connection.bind(this));

        // xx console.log(" Server with max connections ", self.maxConnections);
        this._server.maxConnections = this.maxConnections + 1; // plus one extra

        this._listen_callback = undefined;
        this._server
            .on("connection", (socket: NodeJS.Socket) => {
                // istanbul ignore next
                if (doDebug) {
                    this._dump_statistics();
                    debugLog("server connected  with : " + (socket as any).remoteAddress + ":" + (socket as any).remotePort);
                }
            })
            .on("close", () => {
                debugLog("server closed : all connections have ended");
            })
            .on("error", (err: Error) => {
                // this could be because the port is already in use
                debugLog(chalk.red.bold("server error: "), err.message);
            });
    }

    private _on_client_connection(socket: Socket) {
        // a client is attempting a connection on the socket
        socket.setNoDelay(true);

        debugLog("OPCUAServerEndPoint#_on_client_connection", this._started);
        if (!this._started) {
            debugLog(
                chalk.bgWhite.cyan(
                    "OPCUAServerEndPoint#_on_client_connection " +
                        "SERVER END POINT IS PROBABLY SHUTTING DOWN !!! - Connection is refused"
                )
            );
            socket.end();
            return;
        }
        const deny_connection = () => {
            console.log(
                chalk.bgWhite.cyan(
                    "OPCUAServerEndPoint#_on_client_connection " +
                        "The maximum number of connection has been reached - Connection is refused"
                )
            );
            const reason = "maxConnections reached (" + this.maxConnections + ")";
            const socketData = extractSocketData(socket, reason);
            this.emit("connectionRefused", socketData);

            socket.end();
            socket.destroy();
        };

        const establish_connection = () => {
            const nbConnections = Object.keys(this._channels).length;
            if (nbConnections >= this.maxConnections) {
                warningLog(
                    " nbConnections ",
                    nbConnections,
                    " self._server.maxConnections",
                    this._server!.maxConnections,
                    this.maxConnections
                );
                deny_connection();
                return;
            }

            debugLog("OPCUAServerEndPoint._on_client_connection successful => New Channel");

            const channel = new ServerSecureChannelLayer({
                defaultSecureTokenLifetime: this.defaultSecureTokenLifetime,
                // objectFactory: this.objectFactory,
                parent: this,
                timeout: this.timeout,
                adjustTransportLimits: this.transportSettings?.adjustTransportLimits
            });
     
            debugLog("channel Timeout = >", channel.timeout);

            socket.resume();

            this._preregisterChannel(channel);

            channel.init(socket, (err?: Error) => {
                this._un_pre_registerChannel(channel);
                debugLog(chalk.yellow.bold("Channel#init done"), err);
                if (err) {
                    const reason = "openSecureChannel has Failed " + err.message;
                    const socketData = extractSocketData(socket, reason);
                    const channelData = extractChannelData(channel);
                    this.emit("openSecureChannelFailure", socketData, channelData);

                    socket.end();
                    socket.destroy();
                } else {
                    debugLog("server receiving a client connection");
                    this._registerChannel(channel);
                }
            });

            channel.on("message", (message: Message) => {
                // forward
                this.emit("message", message, channel, this);
            });
        };

        // Each SecureChannel exists until it is explicitly closed or until the last token has expired and the overlap
        // period has elapsed. A Server application should limit the number of SecureChannels.
        // To protect against misbehaving Clients and denial of service attacks, the Server shall close the oldest
        // SecureChannel that has no Session assigned before reaching the maximum number of supported SecureChannels.
        this._prevent_DDOS_Attack(establish_connection, deny_connection);
    }
    private _preregisterChannel(channel: ServerSecureChannelLayer) {
        // _preregisterChannel is used to keep track of channel for which
        // that are in early stage of the hand shaking process.
        // e.g HEL/ACK and OpenSecureChannel may not have been received yet
        // as they will need to be interrupted when OPCUAServerEndPoint is closed
        assert(this._started, "OPCUAServerEndPoint must be started");

        assert(!Object.prototype.hasOwnProperty.call(this._channels, channel.hashKey), " channel already preregistered!");

        const channelPriv = <ServerSecureChannelLayerPriv>channel;
        this._channels[channel.hashKey] = channelPriv;
        channelPriv._unpreregisterChannelEvent = () => {
            debugLog("Channel received an abort event during the preregistration phase");
            this._un_pre_registerChannel(channel);
            channel.dispose();
        };
        channel.on("abort", channelPriv._unpreregisterChannelEvent);
    }

    private _un_pre_registerChannel(channel: ServerSecureChannelLayer) {
        if (!this._channels[channel.hashKey]) {
            debugLog("Already un preregistered ?", channel.hashKey);
            return;
        }
        delete this._channels[channel.hashKey];
        const channelPriv = <ServerSecureChannelLayerPriv>channel;
        if (typeof channelPriv._unpreregisterChannelEvent === "function") {
            channel.removeListener("abort", channelPriv._unpreregisterChannelEvent!);
            channelPriv._unpreregisterChannelEvent = undefined;
        }
    }

    /**
     * @method _registerChannel
     * @param channel
     * @private
     */
    private _registerChannel(channel: ServerSecureChannelLayer) {
        if (this._started) {
            debugLog(chalk.red("_registerChannel = "), "channel.hashKey = ", channel.hashKey);

            assert(!this._channels[channel.hashKey]);
            this._channels[channel.hashKey] = channel;

            /**
             * @event newChannel
             * @param channel
             */
            this.emit("newChannel", channel);

            channel.on("abort", () => {
                this._unregisterChannel(channel);
            });
        } else {
            debugLog("OPCUAServerEndPoint#_registerChannel called when end point is shutdown !");
            debugLog("  -> channel will be forcefully terminated");
            channel.close(() => {
                channel.dispose();
            });
        }
    }

    /**
     * @method _unregisterChannel
     * @param channel
     * @private
     */
    private _unregisterChannel(channel: ServerSecureChannelLayer): void {
        debugLog("_un-registerChannel channel.hashKey", channel.hashKey);
        if (!Object.prototype.hasOwnProperty.call(this._channels, channel.hashKey)) {
            return;
        }

        assert(Object.prototype.hasOwnProperty.call(this._channels, channel.hashKey), "channel is not registered");

        /**
         * @event closeChannel
         * @param channel
         */
        this.emit("closeChannel", channel);

        // keep trace of statistics data from old channel for our own accumulated stats.
        this.bytesWrittenInOldChannels += channel.bytesWritten;
        this.bytesReadInOldChannels += channel.bytesRead;
        this.transactionsCountOldChannels += channel.transactionsCount;
        delete this._channels[channel.hashKey];

        // istanbul ignore next
        if (doDebug) {
            this._dump_statistics();
            debugLog("un-registering channel  - Count = ", this.currentChannelCount);
        }

        /// channel.dispose();
    }

    private _end_listen(err?: Error) {
        if (!this._listen_callback) return;
        assert(typeof this._listen_callback === "function");
        this._listen_callback!(err);
        this._listen_callback = undefined;
    }

    /**
     *  shutdown_channel
     * @param channel
     * @param inner_callback
     */
    private shutdown_channel(channel: ServerSecureChannelLayer, inner_callback: (err?: Error) => void) {
        assert(typeof inner_callback === "function");
        channel.once("close", () => {
            // xx console.log(" ON CLOSED !!!!");
        });

        channel.close(() => {
            this._unregisterChannel(channel);
            setImmediate(inner_callback);
        });
    }

    /**
     * @private
     */
    private _prevent_DDOS_Attack(establish_connection: () => void, deny_connection: () => void) {
        const nbConnections = this.activeChannelCount;

        if (nbConnections >= this.maxConnections) {
            // istanbul ignore next
            errorLog(chalk.bgRed.white("PREVENTING DDOS ATTACK => maxConnection =" + this.maxConnections));

            const unused_channels: ServerSecureChannelLayer[] = this.getChannels().filter((channel1: ServerSecureChannelLayer) => {
                return !channel1.hasSession;
            });
            if (unused_channels.length === 0) {
                doDebug && console.log(
                    this.getChannels()
                        .map(({ status, isOpened, hasSession }) => `${status} ${isOpened} ${hasSession}\n`)
                        .join(" ")
                );
                // all channels are in used , we cannot get any
                errorLog(`All channels are in used ! we cannot cancel any ${this.getChannels().length}`);
                // istanbul ignore next
                if (doDebug) {
                    console.log("  - all channels are used !!!!");
                    false && dumpChannelInfo(this.getChannels());
                }
                setTimeout(deny_connection, 1000);
                return;
            }
            // istanbul ignore next
            if (doDebug) {
                console.log(
                    "   - Unused channels that can be clobbered",
                    unused_channels.map((channel1: ServerSecureChannelLayer) => channel1.hashKey).join(" ")
                );
            }
            const channel = unused_channels[0];
            errorLog(`${unused_channels.length} : Forcefully closing oldest channel that have no session: ${channel.hashKey}`);
            channel.close(() => {
                // istanbul ignore next
                if (doDebug) {
                    console.log("   _ Unused channel has been closed ", channel.hashKey);
                }
                this._unregisterChannel(channel);
                establish_connection();
            });
        } else {
            setImmediate(establish_connection);
        }
    }
}

interface MakeEndpointDescriptionOptions {
    /**
     * @default  default hostname (default value will be full qualified domain name)
     */
    hostname: string;

    serverCertificateChain: Certificate;
    /**
     *
     */
    securityMode: MessageSecurityMode;
    /**
     *
     */
    securityPolicy: SecurityPolicy;

    securityLevel?: number;

    server: ApplicationDescription;
    /*
        {
            applicationUri: string;
            applicationName: LocalizedTextOptions;
            applicationType: ApplicationType;
            gatewayServerUri: string;
            discoveryProfileUri: string;
            discoveryUrls: string[];
        };
     */
    resourcePath?: string;

    // allow un-encrypted password in userNameIdentity
    allowUnsecurePassword?: boolean; // default false

    /**
     * onlyCertificateLessConnection
     */
    onlyCertificateLessConnection?: boolean;

    restricted: boolean;

    collection: { [key: string]: number };

    securityPolicies: SecurityPolicy[];

    userTokenTypes: UserTokenType[];
    /**
     *
     * default value: false;
     *
     * note: setting noUserIdentityTokens=true is useful for pure local discovery servers
     */
    noUserIdentityTokens?: boolean;
}

export interface EndpointDescriptionEx extends EndpointDescription {
    _parent: OPCUAServerEndPoint;
    restricted: boolean;
}

function estimateSecurityLevel(securityMode: MessageSecurityMode, securityPolicy: SecurityPolicy): number {
    if (securityMode === MessageSecurityMode.None) {
        return 1;
    }
    let offset = 100;
    if (securityMode === MessageSecurityMode.SignAndEncrypt) {
        offset = 200;
    }
    switch (securityPolicy) {
        case SecurityPolicy.Basic128:
        case SecurityPolicy.Basic128Rsa15:
        case SecurityPolicy.Basic192:
            return 2; // deprecated => low
        case SecurityPolicy.Basic192Rsa15:
            return 3; // deprecated => low
        case SecurityPolicy.Basic256:
            return 4; // deprecated => low
        case SecurityPolicy.Basic256Rsa15:
            return 4 + offset;
        case SecurityPolicy.Aes128_Sha256_RsaOaep:
            return 5 + offset;
        case SecurityPolicy.Basic256Sha256:
            return 6 + offset;
        case SecurityPolicy.Aes256_Sha256_RsaPss:
            return 7 + offset;

        default:
        case SecurityPolicy.None:
            return 1;
    }
}
/**
 * @private
 */
function _makeEndpointDescription(options: MakeEndpointDescriptionOptions, parent: OPCUAServerEndPoint): EndpointDescriptionEx {
    assert(Object.prototype.hasOwnProperty.call(options, "serverCertificateChain"));
    assert(!Object.prototype.hasOwnProperty.call(options, "serverCertificate"));
    assert(!!options.securityMode); // s.MessageSecurityMode
    assert(!!options.securityPolicy);
    assert(options.server !== null && typeof options.server === "object");
    assert(!!options.hostname && typeof options.hostname === "string");
    assert(typeof options.restricted === "boolean");

    const u = (n: string) => getUniqueName(n, options.collection);
    options.securityLevel =
        options.securityLevel === undefined
            ? estimateSecurityLevel(options.securityMode, options.securityPolicy)
            : options.securityLevel;
    assert(isFinite(options.securityLevel), "expecting a valid securityLevel");

    const securityPolicyUri = toURI(options.securityPolicy);

    const userIdentityTokens: UserTokenPolicyOptions[] = [];

    const registerIdentity2 = (tokenType: UserTokenType, securityPolicy: SecurityPolicy, name: string) => {
        return registerIdentity({
            policyId: u(name),
            tokenType,
            issuedTokenType: null,
            issuerEndpointUrl: null,
            securityPolicyUri: securityPolicy
        });
    };
    const registerIdentity = (r: UserTokenPolicyOptions) => {
        const tokenType = r.tokenType === undefined ? UserTokenType.Invalid : r.tokenType;
        const securityPolicy = (r.securityPolicyUri || "") as SecurityPolicy;
        if (!securityPolicy && options.userTokenTypes.indexOf(tokenType) >= 0) {
            userIdentityTokens.push(r);
            return;
        }
        if (options.securityPolicies.indexOf(securityPolicy) >= 0 && options.userTokenTypes.indexOf(tokenType) >= 0) {
            userIdentityTokens.push(r);
        }
    };

    if (!options.noUserIdentityTokens) {
        if (options.securityPolicy === SecurityPolicy.None) {
            if (options.allowUnsecurePassword) {
                registerIdentity({
                    policyId: u("username_unsecure"),
                    tokenType: UserTokenType.UserName,

                    issuedTokenType: null,
                    issuerEndpointUrl: null,
                    securityPolicyUri: null
                });
            }

            const onlyCertificateLessConnection =
                options.onlyCertificateLessConnection === undefined ? false : options.onlyCertificateLessConnection;

            if (!onlyCertificateLessConnection) {
                registerIdentity2(UserTokenType.UserName, SecurityPolicy.Basic256, "username_basic256");
                registerIdentity2(UserTokenType.UserName, SecurityPolicy.Basic128Rsa15, "username_basic128Rsa15");
                registerIdentity2(UserTokenType.UserName, SecurityPolicy.Basic256Sha256, "username_basic256Sha256");
                registerIdentity2(UserTokenType.UserName, SecurityPolicy.Aes128_Sha256_RsaOaep, "username_aes128Sha256RsaOaep");

                // X509
                registerIdentity2(UserTokenType.Certificate, SecurityPolicy.Basic256, "certificate_basic256");
                registerIdentity2(UserTokenType.Certificate, SecurityPolicy.Basic128Rsa15, "certificate_basic128Rsa15");
                registerIdentity2(UserTokenType.Certificate, SecurityPolicy.Basic256Sha256, "certificate_basic256Sha256");
                registerIdentity2(
                    UserTokenType.Certificate,
                    SecurityPolicy.Aes128_Sha256_RsaOaep,
                    "certificate_aes128Sha256RsaOaep"
                );
            }
        } else {
            // note:
            //  when channel session security is not "None",
            //  userIdentityTokens can be left to null.
            //  in this case this mean that secure policy will be the same as connection security policy
            // istanbul ignore next
            if (process.env.NODEOPCUA_SERVER_EMULATE_SIEMENS) {
                // However, for some reason SIEMENS plc requires that password get encrypted even though
                // the secure channel is also encrypted ....
                // you can set the NODEOPCUA_SERVER_EMULATE_SIEMENS env variable to simulate this behavior
                const registerIdentity3 = (tokenType: UserTokenType, securityPolicy: SecurityPolicy, name: string) => {
                    const identity = {
                        policyId: u(name),
                        tokenType,
                        issuedTokenType: null,
                        issuerEndpointUrl: null,
                        securityPolicyUri: securityPolicy
                    };
                    userIdentityTokens.push(identity);
                };
                registerIdentity3(UserTokenType.UserName, SecurityPolicy.Basic256, "username_basic256");
                registerIdentity3(UserTokenType.UserName, SecurityPolicy.Basic128Rsa15, "username_basic128Rsa15");
                registerIdentity3(UserTokenType.UserName, SecurityPolicy.Basic256Sha256, "username_basic256Sha256");
            } else {
                registerIdentity({
                    policyId: u("usernamePassword"),
                    tokenType: UserTokenType.UserName,
                    issuedTokenType: null,
                    issuerEndpointUrl: null,
                    securityPolicyUri: null
                });

                registerIdentity({
                    policyId: u("certificateX509"),
                    tokenType: UserTokenType.Certificate,

                    issuedTokenType: null,
                    issuerEndpointUrl: null,
                    securityPolicyUri: null
                });
            }
        }

        registerIdentity({
            policyId: u("anonymous"),
            tokenType: UserTokenType.Anonymous,

            issuedTokenType: null,
            issuerEndpointUrl: null,
            securityPolicyUri: null
        });
    }
    // return the endpoint object
    const endpoint = new EndpointDescription({
        endpointUrl: "<to be evaluated at run time>", // options.endpointUrl,

        server: undefined, // options.server,
        serverCertificate: options.serverCertificateChain,

        securityMode: options.securityMode,
        securityPolicyUri,
        userIdentityTokens,

        securityLevel: options.securityLevel,
        transportProfileUri: default_transportProfileUri
    }) as EndpointDescriptionEx;
    endpoint._parent = parent;

    // endpointUrl is dynamic as port number may be adjusted
    // when the tcp socket start listening
    (endpoint as any).__defineGetter__("endpointUrl", () => {
        const port = endpoint._parent.port;
        const resourcePath = options.resourcePath || "";
        const hostname = options.hostname;
        const endpointUrl = `opc.tcp://${hostname}:${port}${resourcePath}`;
        return resolveFullyQualifiedDomainName(endpointUrl);
    });

    endpoint.server = options.server;

    endpoint.restricted = options.restricted;

    return endpoint;
}

/**
 * return true if the end point matches security mode and policy
 * @param endpoint
 * @param securityMode
 * @param securityPolicy
 * @internal
 *
 */
function matching_endpoint(
    securityMode: MessageSecurityMode,
    securityPolicy: SecurityPolicy,
    endpointUrl: string | null,
    endpoint: EndpointDescription
): boolean {
    assert(endpoint instanceof EndpointDescription);
    const endpoint_securityPolicy = fromURI(endpoint.securityPolicyUri);
    if (endpointUrl && endpoint.endpointUrl! !== endpointUrl) {
        return false;
    }
    return endpoint.securityMode === securityMode && endpoint_securityPolicy === securityPolicy;
}

const defaultSecurityModes = [MessageSecurityMode.None, MessageSecurityMode.Sign, MessageSecurityMode.SignAndEncrypt];


const defaultSecurityPolicies = [

    // now deprecated  Basic128Rs15 shall be disabled by default
    // see https://profiles.opcfoundation.org/profile/1532
    // SecurityPolicy.Basic128Rsa15,

    // now deprecated Basic256 shall be disabled by default
    // see https://profiles.opcfoundation.org/profile/2062
    // SecurityPolicy.Basic256,
    
    // xx UNUSED!!  SecurityPolicy.Basic192Rsa15,
    // xx UNUSED!!  SecurityPolicy.Basic256Rsa15,
    
    SecurityPolicy.Basic256Sha256,
    SecurityPolicy.Aes128_Sha256_RsaOaep,
    SecurityPolicy.Aes256_Sha256_RsaPss
];

const defaultUserTokenTypes = [
    UserTokenType.Anonymous,
    UserTokenType.UserName,
    UserTokenType.Certificate
    // NOT USED YET : UserTokenType.IssuedToken
];
