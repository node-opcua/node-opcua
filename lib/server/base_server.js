/**
 * @module opcua.server
 * @type {async|exports}
 */
import async from "async";
import assert from "better-assert";
import _ from "underscore";
import { EventEmitter } from "events";
import path from "path";
import util from "util";
import { 
  display_trace_from_this_projet_only,
  get_clock_tick, 
  make_debugLog, 
  constructFilename 
} from "lib/misc/utils";


import { StatusCodes } from "lib/datamodel/opcua_status_code";
import { ApplicationType, ServiceFault } from "lib/datamodel/structures";

import { OPCUASecureObject } from "lib/misc/opcua_secure_object";
import {
  GetEndpointsResponse,
  ApplicationDescription
} from "lib/services/get_endpoints_service";

import register_server_service from "lib/services/register_server_service";
import { LocalizedText } from "lib/datamodel/localized_text";

const debugLog = make_debugLog(__filename);
const FindServersRequest = register_server_service.FindServersRequest;
const FindServersResponse = register_server_service.FindServersResponse;

const default_server_info = {

  // The globally unique identifier for the application instance. This URI is used as
  // ServerUri in Services if the application is a Server.
  applicationUri: "urn:NodeOPCUA-Server-default",

  // The globally unique identifier for the product.
  productUri: "NodeOPCUA-Server",

  // A localized descriptive name for the application.
  applicationName: { text: "NodeOPCUA", locale: null },
  applicationType: ApplicationType.SERVER,
  gatewayServerUri: "",
  discoveryProfileUri: "",
  discoveryUrls: []
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
 * @constructor
 */
class OPCUABaseServer extends OPCUASecureObject {
  constructor(options = {}) {
    const default_certificate_file = constructFilename("certificates/server_selfsigned_cert_2048.pem");
    options.certificateFile = options.certificateFile || default_certificate_file;

    const default_private_key_file = constructFilename("certificates/server_key_2048.pem");
    options.privateKeyFile = options.privateKeyFile || default_private_key_file;

    super(options);

    const self = this;


    self.endpoints = [];
    self.options = options;

    
    // OPCUASecureObject.call(this, options);

    this.serverInfo = _.clone(default_server_info);
    this.serverInfo = _.extend(this.serverInfo, options.serverInfo);

    self.serverInfo.applicationName = new LocalizedText(self.serverInfo.applicationName);

    this.serverInfo = new ApplicationDescription(this.serverInfo);
  }

  /**
   * start all registered endPoint, in parallel, and call done when all endPoints are listening.
   * @method start
   * @async
   * @param {callback} done
   */
  start(done) {
    const self = this;
    assert(_.isFunction(done));
    assert(_.isArray(this.endpoints));

    const tasks = [];
    this.endpoints.forEach((endPoint) => {
      tasks.push((callback) => {
        endPoint._on_new_channel = (channel) => {
          self.emit("newChannel", channel);
        };
        endPoint.on("newChannel", endPoint._on_new_channel);

        endPoint._on_close_channel = (channel) => {
          self.emit("closeChannel", channel);
        };
        endPoint.on("closeChannel", endPoint._on_close_channel);

        endPoint.start(callback);
      });
    });
    async.series(tasks, done);
  }

  /**
   * shutdown all server endPoints
   * @method shutdown
   * @async
   * @param  {callback} done
   * @param  {Error|null} done.err
   */
  shutdown(done) {
    assert(_.isFunction(done));
    const self = this;

    const tasks = [];
    this.endpoints.forEach((endPoint) => {
      tasks.push((callback) => {
        endPoint.shutdown(callback);
        if (endPoint._on_new_channel) {
          assert(_.isFunction(endPoint._on_new_channel));
          endPoint.removeListener("newChannel", endPoint._on_new_channel);
        }
        if (endPoint._on_close_channel) {
          assert(_.isFunction(endPoint._on_close_channel));
          endPoint.removeListener("closeChannel", endPoint._on_close_channel);
        }
      });
    });
    async.parallel(tasks, (err) => {
      done(err);
      debugLog("shutdown completed");
    });
  }

  prepare() /* message,channel*/ {

  }

  on_request(message, channel) {
    assert(message.request);
    assert(message.requestId);
    const request = message.request;


    // install channel._on_response so we can intercept its call and  emit the "response" event.
    if (!channel._on_response) {
      channel._on_response = (msg, response, inner_message) => {
        self.emit("response", response, channel);
      };
    }


    // prepare request
    this.prepare(message, channel);

    let self = this;
    debugLog("--------------------------------------------------------".green.bold, channel.secureChannelId, request._schema.name);
    let errMessage;
    let response;
    self.emit("request", request, channel);

    try {
      // handler must be named _on_ActionRequest()
      const handler = self[`_on_${request._schema.name}`];
      if (_.isFunction(handler)) {
        const t1 = get_clock_tick();
        handler.apply(self, arguments);
        const t2 = get_clock_tick();
        // xx console.log(request._schema.name," => t2-t1",t2-t1);
      } else {
        errMessage = `UNSUPPORTED REQUEST !! ${request._schema.name}`;
        console.log(errMessage);
        debugLog(errMessage.red.bold);
        response = makeServiceFault(StatusCodes.BadNotImplemented, [errMessage]);
        channel.send_response("MSG", response, message);
      }
    } catch (err) {
      /* istanbul ignore if */
      if (err) {
        errMessage = `EXCEPTION CAUGHT WHILE PROCESSING REQUEST !! ${request._schema.name}`;
        console.log(errMessage.red.bold);

        console.log(request.toString());

        display_trace_from_this_projet_only(err);

        let additional_messages = [];
        additional_messages.push(`EXCEPTION CAUGHT WHILE PROCESSING REQUEST !!! ${request._schema.name}`);
        additional_messages.push(err.message);
        if (err.stack) {
          additional_messages = additional_messages.concat(err.stack.split("\n"));
        }

        response = makeServiceFault(StatusCodes.BadInternalError, additional_messages);

        channel.send_response("MSG", response, message);
      }
    }
  }

  _get_endpoints() {
    let endpoints = [];
    this.endpoints.map((endPoint) => {
      const ep = endPoint.endpointDescriptions();
      endpoints = endpoints.concat(ep);
    });
    return endpoints;
  }

  /**
   * @method _on_GetEndpointsRequest
   * @param message
   * @param channel
   * @private
   */
  _on_GetEndpointsRequest(message, channel) {
    const server = this;
    const request = message.request;

    assert(request._schema.name === "GetEndpointsRequest");

    const response = new GetEndpointsResponse({});


    response.endpoints = server._get_endpoints();

    // apply filters

    if (request.profileUris && request.profileUris.length > 0) {
      response.endpoints = response.endpoints.filter(endpoint => request.profileUris.indexOf(endpoint.transportProfileUri) >= 0);
    }

    // adjust locale on ApplicationName to match requested local or provide 
    // a string with neutral locale (locale == null)
    // TODO: find a better way to handle this
    response.endpoints.forEach((endpoint) => {
      endpoint.server.applicationName.locale = null;
    });

    channel.send_response("MSG", response, message);
  }

  getDiscoveryUrls() {
    const discoveryUrls = this.endpoints.map(e => e._endpoints[0].endpointUrl);
    return discoveryUrls;
    // alternative : return _.uniq(this._get_endpoints().map(function(e){ return e.endpointUrl; }));
  }

  getServers(channel) {
    const server = this;
    server.serverInfo.discoveryUrls = server.getDiscoveryUrls(channel);
    const servers = [server.serverInfo];
    return servers;
  }

  /**
   * @method _on_FindServersRequest
   * @param message
   * @param channel
   * @private
   */
  _on_FindServersRequest(message, channel) {
    const server = this;
    // Release 1.02  13  OPC Unified Architecture, Part 4 :
    //   This  Service  can be used without security and it is therefore vulnerable to Denial Of Service (DOS)
    //   attacks. A  Server  should minimize the amount of processing required to send the response for this
    //   Service.  This can be achieved by preparing the result in advance.   The  Server  should  also add a
    //   short delay before starting processing of a request during high traffic conditions.

    const shortDelay = 2;
    setTimeout(() => {
      const request = message.request;
      assert(request._schema.name === "FindServersRequest");
      assert(request instanceof FindServersRequest);

      let servers = server.getServers(channel);

      // apply filters
      // TODO /
      if (request.serverUris && request.serverUris.length > 0) {
        // A serverUri matches the applicationUri from the ApplicationDescription define
        servers = servers.filter(applicationDecription => request.serverUris.indexOf(applicationDecription.applicationUri) >= 0);
      }

      const response = new FindServersResponse({
        servers
      });
      channel.send_response("MSG", response, message);
    }, shortDelay);
  }

  /**
   * returns a array of currently active channels
   * @method getChannels
   * @return {Array<ServerSecureChannelLayer>}
   */
  getChannels() {
    let channels = [];
    this.endpoints.map((endpoint) => {
      const c = _.values(endpoint._channels);
      channels = channels.concat(c);
    });
    return channels;
  }

  /**
   * set all the end point into a state where they do not accept further connections
   * @note this method is useful for testing purpose
   *
   * @method suspendEndPoints
   * @param callback {Function}
   */
  suspendEndPoints(callback) {
    const self = this;
    async.forEach(self.endpoints, (ep, _inner_callback) => {
      ep.suspendConnection(_inner_callback);
    }, () => {
      callback();
    });
  }

  /**
   * set all the end point into a state where they do accept connections
   * @note this method is useful for testing purpose
   * @method resumeEndPoints
   * @param callback {Function}
   */
  resumeEndPoints(callback) {
    const self = this;
    async.forEach(self.endpoints, (ep, _inner_callback) => {
      ep.restoreConnection(_inner_callback);
    }, callback);
  }

  /**
   * The type of server : SERVER, CLIENTANDSERVER, DISCOVERYSERVER
   * @property serverType
   * @type {ApplicationType}
   */
  get serverType() {
    return this.serverInfo.applicationType;
  }

}


/**
 * construct a service Fault response
 * @method makeServiceFault
 * @param statusCode
 * @param messages
 */
function makeServiceFault(statusCode, messages) {
  const response = new ServiceFault();
  response.responseHeader.serviceResult = statusCode;
  // xx response.serviceDiagnostics.push( new DiagnosticInfo({ additionalInfo: messages.join("\n")}));

  assert(_.isArray(messages));
  assert(typeof messages[0] === "string");

  response.responseHeader.stringTable = messages;
  console.log(" messages ".cyan, messages.join("\n"));
  return response;
}

OPCUABaseServer.makeServiceFault = makeServiceFault;

export { OPCUABaseServer };

