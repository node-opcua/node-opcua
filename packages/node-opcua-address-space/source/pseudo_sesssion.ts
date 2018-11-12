import * as _ from "underscore";

import { assert } from "node-opcua-assert";
import { DataValue } from "node-opcua-data-value";
import {
    resolveNodeId
} from "node-opcua-nodeid";
import {
    BrowseDescriptionLike,
    IBasicSession,
    ReadValueIdLike,
    ResponseCallback
} from "node-opcua-pseudo-session";
import {
    BrowseDescription,
    BrowseDescriptionOptions,
    BrowseRequest,
    BrowseResponse,
    BrowseResult
} from "node-opcua-service-browse";
import { StatusCodes } from "node-opcua-status-code";
import { AddressSpace } from "./address_space_ts";
import { SessionContext } from "./session_context";

/**
 * Pseudo session is an helper object that exposes the same async methods
 * than the ClientSession. It can be used on a server address space.
 *
 * Code reused !
 * The primary benefit of this object  is that its makes advanced OPCUA
 * operations that uses browse, translate, read, write etc similar
 * whether we work inside a server or through a client session.
 *
 * @param addressSpace {AddressSpace}
 * @constructor
 */
export class PseudoSession implements IBasicSession {

    private addressSpace: AddressSpace;

    constructor(addressSpace: AddressSpace) {
        this.addressSpace = addressSpace;
    }

    public browse(nodeToBrowse: BrowseDescriptionLike, callback: ResponseCallback<BrowseResult>): void;
    public browse(nodesToBrowse: BrowseDescriptionLike[], callback: ResponseCallback<BrowseResult[]>): void;
    public browse(nodesToBrowse: any, callback: ResponseCallback<any>): void {

        const isArray = _.isArray(nodesToBrowse);
        if (!isArray) {
            nodesToBrowse = [nodesToBrowse];
        }
        const results: BrowseResult[] = [];
        nodesToBrowse.forEach((browseDescription: BrowseDescription) => {
            browseDescription.referenceTypeId = resolveNodeId(browseDescription.referenceTypeId);
            browseDescription = new BrowseDescription(browseDescription);
            const nodeId = resolveNodeId(browseDescription.nodeId);
            const r = this.addressSpace.browseSingleNode(nodeId, browseDescription);
            results.push(r);
        });
        callback(null, isArray ? results : results[0]);
    }

    public read(nodeToRead: ReadValueIdLike, callback: ResponseCallback<DataValue>): void;
    public read(nodesToRead: ReadValueIdLike[], callback: ResponseCallback<DataValue[]>): void;
    public read(nodesToRead: any, callback: ResponseCallback<any>): void {

        const isArray = _.isArray(nodesToRead);
        if (!isArray) {
            nodesToRead = [nodesToRead];
        }

        // xx const context = new SessionContext({ session: null });
        const dataValues = nodesToRead.map((nodeToRead: ReadValueIdLike) => {

            assert(!!nodeToRead.nodeId, "expecting a nodeId");
            assert(!!nodeToRead.attributeId, "expecting a attributeId");

            const nodeId = nodeToRead.nodeId!;
            const attributeId = nodeToRead.attributeId!;
            const indexRange = nodeToRead.indexRange;
            const dataEncoding = nodeToRead.dataEncoding;
            const obj = this.addressSpace.findNode(nodeId);
            if (!obj) {
                return new DataValue({ statusCode: StatusCodes.BadNodeIdUnknown });
            }
            const context = SessionContext.defaultContext;
            const dataValue = obj.readAttribute(context, attributeId, indexRange, dataEncoding);
            return dataValue;
        });

        callback(null, isArray ? dataValues : dataValues[0]);
    }
}
