import { Announcement } from "./Announcement";
import {
    ServiceConfig
} from "sterfive-bonjour-service";


/**
 * Convert an OPCUA mDNS Announcement into a ServiceConfig
 * @param announcement 
 * @returns 
 */
export function announcementToServiceConfig(announcement: Announcement): ServiceConfig {
    const serviceConfig: ServiceConfig = {
        name: announcement.name,
        port: announcement.port,
        protocol: "tcp",
        host: announcement.host,
        txt: {
            caps: announcement.capabilities.sort().join(","),
            path: announcement.path
        },
        type: "opcua-tcp"
    };

    return serviceConfig;
}
