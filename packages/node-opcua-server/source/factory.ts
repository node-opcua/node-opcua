/**
 * @module node-opcua-server
 */
import * as _ from "underscore";

import { assert } from "node-opcua-assert";
import { ExtensionObject } from "node-opcua-extension-object";
import { constructObject } from "node-opcua-factory";
import { ExpandedNodeId } from "node-opcua-nodeid";

export class Factory {
    public engine: any;

    constructor(engine: any) {
        assert(_.isObject(engine));
        this.engine = engine;
    }

    public constructObject(id: ExpandedNodeId): ExtensionObject {
        return constructObject(id);
    }
}
