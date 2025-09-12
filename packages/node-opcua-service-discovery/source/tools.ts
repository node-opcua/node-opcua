import { ServiceConfig } from "sterfive-bonjour-service";


export function isSameService(a?: ServiceConfig, b?: ServiceConfig): boolean {
    if (!a && !b) {
        return true;
    }
    if (!a || !b) {
        return false;
    }
    return a.port === b.port && a.txt?.path === b.txt?.path && a.name === b.name && a.txt?.caps === b.txt?.caps;
}
export const serviceToString = (service: ServiceConfig) => {
    return (
        "host" +
        service.host +
        " type=" +
        service.type +
        service.name +
        " on port " +
        service.port +
        " txt " +
        JSON.stringify(service.txt)
    );
};