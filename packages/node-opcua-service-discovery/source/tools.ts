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
        "\n   host" +
        service.host +
        "\n   type=" +
        service.type +
        service.name +
        "\n    on port " +
        service.port +
        "\n    txt " +
        JSON.stringify(service.txt) +
        "\n   ttl=" + service.ttl +
        "\n   ip=" + (service.ip!) 
    );
};