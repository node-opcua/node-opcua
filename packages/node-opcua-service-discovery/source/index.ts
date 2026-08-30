/**
 * @module node-opcua-service-discovery
 */

export type {
    FindServersOnNetworkRequestOptions,
    FindServersRequestOptions,
    RegisterServer2RequestOptions,
    RegisterServerRequestOptions
} from "node-opcua-types";
export {
    FindServersOnNetworkRequest,
    FindServersOnNetworkResponse,
    FindServersRequest,
    FindServersResponse,
    MdnsDiscoveryConfiguration,
    RegisteredServer,
    RegisterServer2Request,
    RegisterServer2Response,
    RegisterServerRequest,
    RegisterServerResponse,
    ServerOnNetwork
} from "node-opcua-types";
export { Announcement } from "./Announcement";
export { announcementToServiceConfig } from "./announcement_to_service_config";
export { BonjourHolder } from "./bonjourHolder";
export { serverCapabilities } from "./server_capabilities";
export {
    isSameService,
    serviceToString
} from "./tools";
