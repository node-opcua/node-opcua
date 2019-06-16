/**
 * @module node-opcua-server
 */
// tslint:disable:no-console
import * as async from "async";
import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";
import * as _ from "underscore";
import { callbackify } from "util";

import { assert } from "node-opcua-assert";
import { ICertificateManager, OPCUACertificateManager } from "node-opcua-certificate-manager";
import { IOPCUASecureObjectOptions, OPCUASecureObject } from "node-opcua-common";
import { coerceLocalizedText, LocalizedText } from "node-opcua-data-model";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { display_trace_from_this_projet_only } from "node-opcua-debug";
import {
    extractFullyQualifiedDomainName,
    resolveFullyQualifiedDomainName
} from "node-opcua-hostname";
import {
    Message,
    Response,
    ServerSecureChannelLayer, ServerSecureChannelParent
} from "node-opcua-secure-channel";
import {
    FindServersRequest,
    FindServersResponse
} from "node-opcua-service-discovery";
import {
    ApplicationType,
    GetEndpointsResponse
} from "node-opcua-service-endpoints";
import { ApplicationDescription } from "node-opcua-service-endpoints";
import { ServiceFault } from "node-opcua-service-secure-channel";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { ApplicationDescriptionOptions } from "node-opcua-types";
import { EndpointDescription, GetEndpointsRequest } from "node-opcua-types";
import { OPCUAServerEndPoint } from "./server_end_point";

const doDebug = checkDebugFlag(__filename);
const debugLog = make_debugLog(__filename);

function constructFilename(p: string): string {
    let filename = path.join(__dirname, "..", p);
    if (!fs.existsSync(filename)) {
        // try one level up
        filename = path.join(__dirname, p);
        if (!fs.existsSync(filename)) {
            throw new Error("Cannot find filename " + filename + " ( __dirname = " + __dirname);
        }
    }
    return filename;
}

const default_server_info = {

    // The globally unique identifier for the application instance. This URI is used as
    // ServerUri in Services if the application is a Server.
    applicationUri: "urn:NodeOPCUA-Server-default",

    // The globally unique identifier for the product.
    productUri: "NodeOPCUA-Server",

    // A localized descriptive name for the application.
    applicationName: { text: "NodeOPCUA", locale: null },
    applicationType: ApplicationType.Server,
    gatewayServerUri: "",

    discoveryProfileUri: "",

    discoveryUrls: []
};

function cleanupEndpoint(endpoint: OPCUAServerEndPoint) {

    if (endpoint._on_new_channel) {
        assert(_.isFunction(endpoint._on_new_channel));
        endpoint.removeListener("newChannel", endpoint._on_new_channel);
        endpoint._on_new_channel = undefined;
    }

    if (endpoint._on_close_channel) {
        assert(_.isFunction(endpoint._on_close_channel));
        endpoint.removeListener("closeChannel", endpoint._on_close_channel);
        endpoint._on_close_channel = undefined;
    }
}

export interface OPCUABaseServerOptions extends IOPCUASecureObjectOptions {

    serverInfo?: ApplicationDescriptionOptions;
    serverCertificateManager?: OPCUACertificateManager;
}

const emptyCallback = () => { /* empty */
};

/**
 * @class OPCUABaseServer
 * @param options
 * @param options.certificateFile
 * @param options.privateKeyFile
 * @param [options.serverInfo = null]                   the information used in the end point description
 * @param [options.serverInfo.applicationUri = "urn:NodeOPCUA-SimpleDemoServer"] {String}
 * @param [options.serverInfo.productUri = "SimpleDemoServer"]{String}
 * @param [options.serverInfo.applicationName = {text: "applicationName"}]{LocalizedText}
 * @param [options.serverInfo.gatewayServerUri = null]{String}
 * @param [options.serverInfo.discoveryProfileUri= null]{String}
 * @param [options.serverInfo.discoveryUrls = []]{Array<String>}
 * @param [options.serverCertificateManager]
 * @constructor
 */
export class OPCUABaseServer extends OPCUASecureObject {

    public static makeServiceFault = makeServiceFault;

    /**
     * The type of server
     */
    get serverType(): ApplicationType {
        return this.serverInfo.applicationType;
    }

    public serverInfo: ApplicationDescription;
    public endpoints: OPCUAServerEndPoint[];
    public serverCertificateManager: OPCUACertificateManager;
    public capabilitiesForMDNS: string[];

    protected options: OPCUABaseServerOptions;

    constructor(options?: OPCUABaseServerOptions) {

        options = options || {} as OPCUABaseServerOptions;
        options.certificateFile = options.certificateFile ||
          constructFilename("certificates/server_selfsigned_cert_2048.pem");

        options.privateKeyFile = options.privateKeyFile ||
          constructFilename("certificates/PKI/own/private/private_key.pem");

        super(options);

        this.capabilitiesForMDNS = [];
        this.endpoints = [];
        this.options = options;

        const serverInfo: ApplicationDescriptionOptions = _.extend(_.clone(default_server_info), options.serverInfo) as ApplicationDescriptionOptions;
        serverInfo.applicationName = coerceLocalizedText(serverInfo.applicationName);

        this.serverInfo = new ApplicationDescription(serverInfo);

        const __applicationUri = serverInfo.applicationUri || "";

        (this.serverInfo as any).__defineGetter__("applicationUri", function(this: any) {
            return resolveFullyQualifiedDomainName(__applicationUri);
        });

        this.serverCertificateManager = options.serverCertificateManager
          || new OPCUACertificateManager({
              name: "certificates"
          });

    }

    /**
     * start all registered endPoint, in parallel, and call done when all endPoints are listening.
     * @method start
     * @async
     * @param {callback} done
     */
    public start(done: (err?: Error | null) => void) {

        const self = this;
        assert(_.isFunction(done));
        assert(_.isArray(this.endpoints));
        assert(this.endpoints.length > 0, "We neeed at least one end point");
        callbackify(extractFullyQualifiedDomainName)((err: Error | null, fqdn: string) => {

            async.forEach(this.endpoints, (endpoint: OPCUAServerEndPoint, callback: (err?: Error | null) => void) => {

                endpoint._on_new_channel = (channel: ServerSecureChannelLayer) => {
                    self.emit("newChannel", channel);
                };
                endpoint.on("newChannel", endpoint._on_new_channel);

                assert(!endpoint._on_close_channel);
                endpoint._on_close_channel = (channel: ServerSecureChannelLayer) => {
                    self.emit("closeChannel", channel);
                };
                endpoint.on("closeChannel", endpoint._on_close_channel);

                endpoint.start(callback);

            }, done);
        });
    }

    /**
     * shutdown all server endPoints
     * @async
     */
    public shutdown(done: (err?: Error) => void) {

        debugLog("OPCUABaseServer#shutdown starting");
        assert(_.isFunction(done));
        async.forEach(this.endpoints,
          (endpoint: OPCUAServerEndPoint, callback: (err?: Error) => void) => {
              cleanupEndpoint(endpoint);
              endpoint.shutdown(callback);
          }, (err?: Error | null) => {
              debugLog("shutdown completed");
              done(err!);
          });
    }

    public async shutdownChannels(): Promise<void>;
    public shutdownChannels(callback: (err?: Error | null) => void): void;
    public shutdownChannels(callback?: (err?: Error | null) => void): Promise<void> | void {

        assert(_.isFunction(callback));
        debugLog("OPCUABaseServer#shutdownChannels");
        async.forEach(this.endpoints,
          (endpoint: OPCUAServerEndPoint, inner_callback: (err?: Error | null) => void) => {
              debugLog(" shutting down endpoint ", endpoint.endpointDescriptions()[0].endpointUrl);
              async.series([
// xx                  (callback2: (err?: Error| null) => void) => {
// xx                      endpoint.suspendConnection(callback2);
// xx                  },
                  (callback2: (err?: Error | null) => void) => {
                      endpoint.abruptlyInterruptChannels();
                      endpoint.shutdown(callback2);
                  }
// xx              (callback2: (err?: Error| null) => void) => {
// xx                 endpoint.restoreConnection(callback2);
// xx              }
              ], inner_callback);
          }, callback);
    }

    public on_request(message: Message, channel: ServerSecureChannelLayer) {

        assert(message.request);
        assert(message.requestId !== 0);
        const request = message.request;

        // install channel._on_response so we can intercept its call and  emit the "response" event.
        if (!channel._on_response) {
            channel._on_response = (msg: string, response1: Response /*, inner_message: Message*/) => {
                this.emit("response", response1, channel);
            };
        }

        // prepare request
        this.prepare(message, channel);

        debugLog(
          chalk.green.bold("--------------------------------------------------------"),
          channel.channelId, request.schema.name
        );

        let errMessage: string;
        let response: Response;

        this.emit("request", request, channel);

        try {
            // handler must be named _on_ActionRequest()
            const handler = (this as any)["_on_" + request.schema.name];
            if (_.isFunction(handler)) {
                handler.apply(this, arguments);
            } else {
                errMessage = "UNSUPPORTED REQUEST !! " + request.schema.name;
                console.log(errMessage);
                debugLog(chalk.red.bold(errMessage));
                response = makeServiceFault(StatusCodes.BadNotImplemented, [errMessage]);
                channel.send_response("MSG", response, message, emptyCallback);
            }

        } catch (err) {

            /* istanbul ignore if */
            const errMessage1 = "EXCEPTION CAUGHT WHILE PROCESSING REQUEST !! " + request.schema.name;
            console.log(chalk.red.bold(errMessage1));

            console.log(request.toString());

            display_trace_from_this_projet_only(err);

            let additional_messages = [];
            additional_messages.push("EXCEPTION CAUGHT WHILE PROCESSING REQUEST !!! " + request.schema.name);
            additional_messages.push(err.message);
            if (err.stack) {
                additional_messages = additional_messages.concat(err.stack.split("\n"));
            }

            response = makeServiceFault(StatusCodes.BadInternalError, additional_messages);

            channel.send_response("MSG", response, message, emptyCallback);
        }
    }

    public _get_endpoints(): EndpointDescription[] {

        let endpoints: EndpointDescription[] = [];
        for (const endPoint of this.endpoints) {
            const ep = endPoint.endpointDescriptions();
            endpoints = endpoints.concat(ep);
        }
        return endpoints;
    }

    public getDiscoveryUrls(): string[] {
        const discoveryUrls = this.endpoints.map((e: OPCUAServerEndPoint) => {
            return e.endpointDescriptions()[0].endpointUrl as string;
        });
        return discoveryUrls;
        // alternative : return _.uniq(this._get_endpoints().map(function(e){ return e.endpointUrl; }));
    }

    public getServers(channel: ServerSecureChannelLayer): ApplicationDescription[] {
        this.serverInfo.discoveryUrls = this.getDiscoveryUrls();
        const servers = [this.serverInfo];
        return servers;
    }

    /**
     * set all the end point into a state where they do not accept further connections
     *
     * note:
     *     this method is useful for testing purpose
     *
     */
    public async suspendEndPoints(): Promise<void>;
    public suspendEndPoints(callback: (err?: Error) => void): void;
    public suspendEndPoints(callback?: (err?: Error) => void): void | Promise<void> {
        if (!callback) {
            throw new Error("Internal Error");
        }
        async.forEach(this.endpoints, (ep: OPCUAServerEndPoint, _inner_callback) => {

            /* istanbul ignore next */
            if (doDebug) {
                debugLog("Suspending ", ep.endpointDescriptions()[0].endpointUrl);
            }

            ep.suspendConnection((err?: Error | null) => {

                /* istanbul ignore next */
                if (doDebug) {
                    debugLog("Suspended ", ep.endpointDescriptions()[0].endpointUrl);
                }
                _inner_callback(err);
            });
        }, (err?: Error | null) => callback(err!));
    }

    /**
     * set all the end point into a state where they do accept connections
     * note:
     *    this method is useful for testing purpose
     */
    public async resumeEndPoints(): Promise<void>;
    public resumeEndPoints(callback: (err?: Error) => void): void;
    public resumeEndPoints(callback?: (err?: Error) => void): void | Promise<void> {
        async.forEach(this.endpoints, (ep: OPCUAServerEndPoint, _inner_callback) => {
            ep.restoreConnection(_inner_callback);
        }, (err?: Error | null) => callback!(err!));
    }

    protected prepare(message: Message, channel: ServerSecureChannelLayer): void {
        /* empty */
    }

    /**
     * @private
     */
    protected _on_GetEndpointsRequest(message: Message, channel: ServerSecureChannelLayer) {

        const server = this;
        const request = message.request as GetEndpointsRequest;

        assert(request.schema.name === "GetEndpointsRequest");

        const response = new GetEndpointsResponse({});

        response.endpoints = server._get_endpoints();

        response.endpoints = response.endpoints.filter(
          (endpoint: EndpointDescription) => !(endpoint as any).restricted);

        // apply filters
        if (request.profileUris && request.profileUris.length > 0) {
            response.endpoints = response.endpoints.filter((endpoint: any) => {
                return request.profileUris!.indexOf(endpoint.transportProfileUri) >= 0;
            });
        }

        // adjust locale on ApplicationName to match requested local or provide
        // a string with neutral locale (locale === null)
        // TODO: find a better way to handle this
        response.endpoints.forEach((endpoint: EndpointDescription) => {
            endpoint.server.applicationName.locale = null;
        });

        channel.send_response("MSG", response, message, emptyCallback);

    }

    /**
     * @private
     */
    protected _on_FindServersRequest(message: Message, channel: ServerSecureChannelLayer) {

        const server = this;
        // Release 1.02  13  OPC Unified Architecture, Part 4 :
        //   This  Service  can be used without security and it is therefore vulnerable to Denial Of Service (DOS)
        //   attacks. A  Server  should minimize the amount of processing required to send the response for this
        //   Service.  This can be achieved by preparing the result in advance.   The  Server  should  also add a
        //   short delay before starting processing of a request during high traffic conditions.

        const shortDelay = 2;
        setTimeout(() => {

            const request = message.request;
            assert(request.schema.name === "FindServersRequest");
            if (!(request instanceof FindServersRequest)) {
                throw new Error("Invalid request type");
            }

            let servers = server.getServers(channel);
            // apply filters
            // TODO /
            if (request.serverUris && request.serverUris.length > 0) {
                // A serverUri matches the applicationUri from the ApplicationDescription define
                servers = servers.filter((inner_Server: ApplicationDescription) => {
                    return request.serverUris!.indexOf(inner_Server.applicationUri) >= 0;
                });
            }

            function adapt(applicationDescription: ApplicationDescription): ApplicationDescription {
                return new ApplicationDescription({
                    applicationName: applicationDescription.applicationName,
                    applicationType: applicationDescription.applicationType,
                    applicationUri: applicationDescription.applicationUri,
                    discoveryProfileUri: applicationDescription.discoveryProfileUri,
                    discoveryUrls: applicationDescription.discoveryUrls,
                    gatewayServerUri: applicationDescription.gatewayServerUri,
                    productUri: applicationDescription.productUri
                });
            }

            const response = new FindServersResponse({
                servers: servers.map(adapt)
            });

            channel.send_response("MSG", response, message, emptyCallback);

        }, shortDelay);
    }

    /**
     * returns a array of currently active channels
     */
    protected getChannels(): ServerSecureChannelLayer[] {

        let channels: ServerSecureChannelLayer[] = [];

        for (const endpoint of this.endpoints) {
            const c = endpoint.getChannels();
            channels = channels.concat(c);
        }
        return channels;
    }

}

/**
 * construct a service Fault response
 * @method makeServiceFault
 * @param statusCode
 * @param messages
 */
function makeServiceFault(
  statusCode: StatusCode,
  messages: string[]
): ServiceFault {
    const response = new ServiceFault();
    response.responseHeader.serviceResult = statusCode;
    // xx response.serviceDiagnostics.push( new DiagnosticInfo({ additionalInfo: messages.join("\n")}));

    assert(_.isArray(messages));
    assert(typeof messages[0] === "string");

    response.responseHeader.stringTable = messages;
    // tslint:disable:no-console
    console.log(chalk.cyan(" messages "), messages.join("\n"));
    return response;
}

// tslint:disable:no-var-requires
const thenify = require("thenify");
const opts = { multiArgs: false };
OPCUABaseServer.prototype.resumeEndPoints = thenify.withCallback(OPCUABaseServer.prototype.resumeEndPoints, opts);
OPCUABaseServer.prototype.suspendEndPoints = thenify.withCallback(OPCUABaseServer.prototype.suspendEndPoints, opts);
OPCUABaseServer.prototype.shutdownChannels = thenify.withCallback(OPCUABaseServer.prototype.shutdownChannels, opts);
