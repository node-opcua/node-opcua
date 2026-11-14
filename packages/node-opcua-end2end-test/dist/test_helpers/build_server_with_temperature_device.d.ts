import "should";
import { OPCUAServer, type OPCUAServerOptions, type UAVariable } from "node-opcua";
export interface ExtraServerProperties {
    temperatureVariableId: UAVariable;
    pumpSpeed: UAVariable;
    asyncWriteNode: UAVariable;
    set_point_temperature: number;
}
/**
 * @method build_server_with_temperature_device
 *
 * create and start a fake OPCUA Server that exposes a temperature set point variable.
 *
 *    the SetPoint temperature can be set on the server side by accessing the
 *    'set_point_temperature'  of the return server object.
 *
 *    the SetPoint temperature can be accessed as a Read/Write variable by a opcua client
 *    as "Root/MyDevices/SetPointTemperature". The node id of this variable is stored into
 *    the 'temperatureVariableId' of the server object.
 *
 * @param options {options}
 * @param [options.add_simulation = false] {Boolean} add the simulation nodes in the server
 * @param done {callback}
 * @return {OPCUAServer}
 */
export declare function build_server_with_temperature_device(options: OPCUAServerOptions & {
    port?: number;
    add_simulation?: boolean;
}): Promise<OPCUAServer & ExtraServerProperties>;
export declare function _build_server_with_temperature_device(server_: OPCUAServer, options: {
    port?: number;
    add_simulation?: boolean;
}): Promise<OPCUAServer & ExtraServerProperties>;
//# sourceMappingURL=build_server_with_temperature_device.d.ts.map