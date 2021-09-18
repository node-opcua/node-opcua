import { UAFolder, UAServer } from "node-opcua-nodeset-ua";
export interface UAObjectsFolder extends UAFolder {
    server: UAServer;
}

export interface UARootFolder extends UAFolder {
    objects: UAObjectsFolder;
    types: UAFolder;
    views: UAFolder;
}
