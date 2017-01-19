
import { OPCUAServer } from "lib/server/opcua_server";
import util from "util";
import async from "async";
import _ from "underscore";
import assert from "better-assert";

import { ApplicationType as _structure_ApplicationType } from "lib/datamodel/structures";
import { OPCUAServerEndPoint } from "lib/server/server_end_point";
import { StatusCodes } from "lib/datamodel/opcua_status_code";
import register_server_service from "lib/services/register_server_service";

import {
  ApplicationDescription,
  ApplicationType
} from "lib/services/get_endpoints_service";

import { get_fully_qualified_domain_name } from "lib/misc/hostname";
import { constructFilename, make_debugLog } from "lib/misc/utils";
import { OPCUABaseServer } from "lib/server/base_server";
import { makeApplicationUrn } from "lib/misc/applicationurn";

const RegisterServerRequest = register_server_service.RegisterServerRequest;
const RegisterServerResponse = register_server_service.RegisterServerResponse;
const FindServersRequest = register_server_service.FindServersRequest;
const FindServersResponse = register_server_service.FindServersResponse;


class OPCUADiscoveryServer extends OPCUABaseServer {
  constructor(options = {}) {
    super(...arguments);
    const self = this;

    const default_certificate_file = constructFilename("certificates/discoveryServer_cert_2048.pem");
    options.certificateFile = options.certificateFile || default_certificate_file;

    const default_private_key_file = constructFilename("certificates/discoveryServer_key_2048.pem");
    options.privateKeyFile = options.privateKeyFile || default_private_key_file;

    const defaultApplicationUri = makeApplicationUrn(get_fully_qualified_domain_name(), "NodeOPCUA-DiscoveryServer");


    const serverInfo = options.serverInfo || {};

    serverInfo.applicationType = _structure_ApplicationType.DISCOVERYSERVER;
    serverInfo.applicationUri = serverInfo.applicationUri || defaultApplicationUri;
    serverInfo.productUri = serverInfo.productUri || "SampleDiscoveryServer";
    serverInfo.applicationName = serverInfo.applicationName || { text: "SampleDiscoveryServer", locale: null };
    serverInfo.gatewayServerUri = serverInfo.gatewayServerUri || "";
    serverInfo.discoveryProfileUri = serverInfo.discoveryProfileUri || "";
    serverInfo.discoveryUrls = serverInfo.discoveryUrls || [];

    self.serverInfo = serverInfo;

    const port = options.port || 4840;

    self.registered_servers = {};
      // see OPC UA Spec 1.2 part 6 : 7.4 Well Known Addresses
      // opc.tcp://localhost:4840/UADiscovery

    const endPoint = new OPCUAServerEndPoint({
      port,
      certificateChain: self.getCertificateChain(),
      privateKey: self.getPrivateKey(),
      serverInfo: self.serverInfo
    });
    endPoint.addStandardEndpointDescriptions();

    self.endpoints.push(endPoint);

    endPoint.on("message", (message, channel) => {
      self.on_request(message, channel);
    });
  }

  start(done) {
    super.start(done);
  }

  _on_RegisterServerRequest(message, channel) {
    const server = this;
    const request = message.request;

    assert(request._schema.name === "RegisterServerRequest");
    assert(request instanceof RegisterServerRequest);

    function sendError(statusCode) {
      console.log("_on_RegisterServerRequest error".red, statusCode.toString());
      const response = new RegisterServerResponse({ responseHeader: { serviceResult: statusCode } });
      return channel.send_response("MSG", response, message);
    }

      // check serverType is valid
    if (!_isValideServerType(request.server.serverType)) {
      return sendError(StatusCodes.BadInvalidArgument);
    }

      // BadServerUriInvalid
      // TODO

      // BadServerNameMissing
    if (request.server.serverNames.length === 0) {
      return sendError(StatusCodes.BadServerNameMissing);
    }

      // BadDiscoveryUrlMissing
    if (request.server.discoveryUrls.length === 0) {
      return sendError(StatusCodes.BadDiscoveryUrlMissing);
    }

    const key = request.server.serverUri;

    if (request.server.isOnline) {
      console.log(" registering server : ".cyan, request.server.serverUri.yellow);
      server.registered_servers[key] = request.server;

          // prepare serverInfo which will be used by FindServers
      const serverInfo = {};
      serverInfo.applicationUri = serverInfo.serverUri;
      serverInfo.applicationType = request.server.serverType;
      serverInfo.productUri = request.server.productUri;
      serverInfo.applicationName = request.server.serverNames[0]; // which one shall we use ?
      serverInfo.gatewayServerUri = request.server.gatewayServerUri;
          // XXX ?????? serverInfo.discoveryProfileUri = serverInfo.discoveryProfileUri;
      serverInfo.discoveryUrls = request.server.discoveryUrls;
      server.registered_servers[key].serverInfo = serverInfo;
    } else if (key in server.registered_servers) {
      console.log(" unregistering server : ".cyan, request.server.serverUri.yellow);
      delete server.registered_servers[key];
    }

    const response = new RegisterServerResponse({});
    channel.send_response("MSG", response, message);
  }

  // OPCUADiscoveryServer.prototype.getDiscoveryUrls = function(channel) {
  //
  //    var self = this;
  //    assert(channel);
  //
  //    var discoveryUrls = OPCUABaseServer.prototype.getDiscoveryUrls.call(this,channel);
  //    // add registered server Urls
  //    _.forEach(self.registered_servers,function(registered_server){
  //        discoveryUrls = discoveryUrls.concat(registered_server.discoveryUrls);
  //    });
  //    return discoveryUrls;
  // };

  getServers(channel) {
    const self = this;
    self.serverInfo.discoveryUrls = self.getDiscoveryUrls(channel);
    const servers = [self.serverInfo];
    _.forEach(self.registered_servers, (registered_server) => {
      servers.push(registered_server.serverInfo);
    });

    return servers;
  }
  get registeredServerCount() {
    return Object.keys(this.registered_servers).length;
  }
}


// OPCUADiscoveryServer.prototype.shutdown = OPCUABaseServer.prototype.shutdown;

/*= = private
 * returns true if the serverType can be added to a discovery server.
 * @param serverType
 * @return {boolean}
 * @private
 */
function _isValideServerType(serverType) {
  switch (serverType) {
    case ApplicationType.CLIENT:
      return false;
    case ApplicationType.SERVER:
    case ApplicationType.CLIENTANDSERVER:
    case ApplicationType.DISCOVERYSERVER:
      return true;
  }
  return false;
}


export { OPCUADiscoveryServer };
