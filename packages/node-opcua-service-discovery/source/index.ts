/**
 * @module node-opcua-service-discovery
 */

export {
    RegisteredServer,
    RegisterServerRequest,
    RegisterServerResponse,
    MdnsDiscoveryConfiguration,
    RegisterServer2Request,
    RegisterServer2Response,

    RegisterServerRequestOptions,
    RegisterServer2RequestOptions,

    FindServersRequest,
    FindServersRequestOptions,
    FindServersResponse,

    FindServersOnNetworkRequest,
    FindServersOnNetworkRequestOptions,
    FindServersOnNetworkResponse,

    ServerOnNetwork
} from "node-opcua-types";

export { serverCapabilities } from "./server_capabilities";
export {
    Announcement,
    BonjourHolder,
    isSameService as sameService,
    _announceServerOnMulticastSubnet,
    announcementToServiceConfig,
    serviceToString,
}from "./bonjour";
