import { DataValue } from "node-opcua-data-value";
import {
    BrowseDescription,
    BrowseDescriptionOptions,
    BrowseRequest,
    BrowseResponse,
    BrowseResult
} from "node-opcua-service-browse";
import {
    ReadValueId,
    ReadValueIdOptions
} from "node-opcua-service-read";

export type BrowseDescriptionLike = string | BrowseDescriptionOptions | BrowseDescription;
export type ReadValueIdLike = ReadValueId | ReadValueIdOptions;

export type ResponseCallback<T> = (err: Error | null, result?: T) => void;

export interface IBasicSession {
    browse(nodeToBrowse: BrowseDescriptionLike, callback: ResponseCallback<BrowseResult>): void;
    browse(nodesToBrowse: BrowseDescriptionLike[], callback: ResponseCallback<BrowseResult[]>): void;
    read(nodeToRead: ReadValueIdLike, callback: ResponseCallback<DataValue>): void;
    read(nodesToRead: ReadValueIdLike[], callback: ResponseCallback<DataValue[]>): void;
}
