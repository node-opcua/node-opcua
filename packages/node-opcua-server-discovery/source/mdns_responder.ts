import assert from "node-opcua-assert";
import { make_debugLog } from "node-opcua-debug";
import { acquireBonjour, releaseBonjour, ServerOnNetwork } from "node-opcua-service-discovery";

const debugLog = make_debugLog(__filename);

const doDebug = false;

export class MDNSResponser {

    private bonjour: any;
    private recordId: number;
    private registeredServers: any[];
    private responser: any;
    private lastUpdateDate: Date = new Date();

    constructor() {

        this.registeredServers = [];

        this.bonjour = acquireBonjour();
        this.recordId = 0;

        this.responser = this.bonjour.find({
            protocol: "tcp",
            type: "opcua-tcp",
        });

        const addService = (service: any) => {
            if (doDebug) {
                debugLog(service);
            }
            // example:
            // {
            //     addresses: [ '172.18.207.145', 'fe80::d4e3:352c:9f8b:d0db' ],
            //     rawTxt: <Buffer 05 70 61 74 68 3d 08 63 61 70 73 3d 4c 44 53>,
            //     txt: { path: '', caps: 'LDS' },
            //     name: 'UA Local Discovery Server on STERFIVEPC2',
            //     fqdn: 'UA Local Discovery Server on STERFIVEPC2._opcua-tcp._tcp.local',
            //     host: 'STERFIVEPC2.local',
            //     referer:
            //     {
            //        address: '172.18.207.145',
            //        family: 'IPv4',
            //        port: 5353,
            //        size: 363
            //     },
            //     port: 4840,
            //     type: 'opcua-tcp',
            //     protocol: 'tcp',
            //  subtypes: []
            // },
            debugLog("a new OPCUA server has been registered");

            const recordId = ++this.recordId;
            const serverName = service.name;

            service.txt.caps = service.txt.caps || "";
            const serverCapabilities = service.txt.caps.split(",").map(
              (x: string) => x.toUpperCase()).sort();

            assert(serverCapabilities instanceof Array);

            const path = service.txt.path || "";
            const discoveryUrl = "opc.tcp://" + service.host + ":" + service.port + path;

            this.registeredServers.push(
              new ServerOnNetwork({
                  discoveryUrl,
                  recordId,
                  serverCapabilities,
                  serverName,
              }));
            this.lastUpdateDate = new Date(Date.now());
        };

        const removeService = (service: any) => {
            const serverName = service.name;
            debugLog("a OPCUA server has been unregistered ", serverName);
            const index = this.registeredServers.findIndex((server) => server.serverName = serverName);
            if (index === -1) {
                debugLog("Cannot find server with name ", serverName, " in registeredServers");
                return;
            }
            this.registeredServers.splice(index, 1); // reove element at index
            this.lastUpdateDate = new Date(Date.now());
        };

        this.responser.on("up", (service: any) => {
            // xx console.log("xxx responder up ",service);addService(service);
            addService(service);
        });

        this.responser.on("down", (service: any) => {
            removeService(service);
        });
    }
    public dispose() {
        this.bonjour = null;
        releaseBonjour();
    }
}
