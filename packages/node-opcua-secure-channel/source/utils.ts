/* eslint-disable max-statements */
/* eslint-disable complexity */
import * as chalk from "chalk";
import { timestamp } from "node-opcua-utils";
import { assert } from "node-opcua-assert";

import {
    BrowseNextRequest,
    BrowseNextResponse,
    BrowseRequest,
    BrowseResponse,
    ReadRequest,
    ReadResponse,
    WriteRequest,
    WriteResponse,
    CreateMonitoredItemsRequest,
    CreateMonitoredItemsResponse,
    RegisterNodesRequest,
    RegisterNodesResponse,
    TranslateBrowsePathsToNodeIdsRequest,
    TranslateBrowsePathsToNodeIdsResponse,
    PublishResponse,
    DataChangeNotification,
    EventNotificationList,
    StatusChangeNotification,
    OpenSecureChannelRequest,
    SecurityTokenRequestType,
    MessageSecurityMode,
    CreateSessionRequest,
    CreateSessionResponse,
    ActivateSessionRequest,
    AnonymousIdentityToken,
    UserNameIdentityToken,
    X509IdentityToken,
    ActivateSessionResponse,
    PublishRequest
} from "node-opcua-types";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { Request, Response } from "./common";
import { SecurityPolicy } from ".";

const clientFlag = (process.env?.NODEOPCUADEBUG?.match(/CLIENT{([^}]*)}/) || [])[1] || "";
const serverFlag = (process.env?.NODEOPCUADEBUG?.match(/SERVER{([^}]*)}/) || [])[1] || "";
const filter = new RegExp((process.env?.NODEOPCUADEBUG?.match(/FILTER{([^}]*)}/) || [])[1] || ".*");

// console.log("serverFlag", serverFlag);
// console.log("clientFlag", clientFlag);
export const doTraceServerMessage = serverFlag.match(/TRACE/);
export const doTraceRequest = serverFlag.match(/REQUEST/);
export const doTraceResponse = serverFlag.match(/RESPONSE/);
export const doPerfMonitoring = serverFlag.match(/PERF/);


// eslint-disable-next-line prefer-const
export let doTraceClientMessage = clientFlag.match(/TRACE/);
// eslint-disable-next-line prefer-const
export let doTraceClientRequestContent = clientFlag.match(/REQUEST/);
// eslint-disable-next-line prefer-const
export let doTraceClientResponseContent = clientFlag.match(/RESPONSE/);

export const doTraceStatistics = process.env.NODEOPCUADEBUG && !!process.env.NODEOPCUADEBUG.match("STATS");
// const doPerfMonitoring = process.env.NODEOPCUADEBUG && process.env.NODEOPCUADEBUG.indexOf("PERF") >= 0;
export const dumpSecurityHeader = process.env.NODEOPCUADEBUG && !!process.env.NODEOPCUADEBUG.match("SECURITY");

export interface ServerTransactionStatistics {
    bytesRead: number;
    bytesWritten: number;
    lap_reception: number;
    lap_processing: number;
    lap_emission: number;
}

// istanbul ignore next
export function _dump_transaction_statistics(stats?: ServerTransactionStatistics): void {
    if (stats) {
        console.log("                Bytes Read : ", stats.bytesRead);
        console.log("             Bytes Written : ", stats.bytesWritten);
        if (doPerfMonitoring) {
            console.log("   time to receive request : ", (stats.lap_reception / 1000).toFixed(3), " sec");
            console.log("   time to process request : ", (stats.lap_processing / 1000).toFixed(3), " sec");
            console.log("   time to send response   : ", (stats.lap_emission / 1000).toFixed(3), " sec");
        }
    }
}

export interface ClientTransactionStatistics {
    dump: () => void;
    request: Request;
    response: Response;
    bytesRead: number;
    bytesWritten: number;
    lap_transaction: number;
    lap_sending_request: number;
    lap_waiting_response: number;
    lap_receiving_response: number;
    lap_processing_response: number;
}

export function _dump_client_transaction_statistics(stats: ClientTransactionStatistics): void {
    function w(str: string | number) {
        return str.toString().padStart(12, " ").substring(0, 12);
    }

    console.log(chalk.green.bold("--------------------------------------------------------------------->> Stats"));
    console.log(
        "   request                   : ",
        chalk.yellow(stats.request.schema.name.toString()),
        " / ",
        chalk.yellow(stats.response.schema.name.toString()),
        " - ",
        stats.request.requestHeader.requestHandle,
        "/",
        stats.response.responseHeader.requestHandle,
        stats.response.responseHeader.serviceResult.toString()
    );
    console.log("   Bytes Read                : ", w(stats.bytesRead), " bytes");
    console.log("   Bytes Written             : ", w(stats.bytesWritten), " bytes");
    if (doPerfMonitoring) {
        console.log("   transaction duration      : ", w(stats.lap_transaction.toFixed(3)), " milliseconds");
        console.log("   time to send request      : ", w(stats.lap_sending_request.toFixed(3)), " milliseconds");
        console.log("   time waiting for response : ", w(stats.lap_waiting_response.toFixed(3)), " milliseconds");
        console.log("   time to receive response  : ", w(stats.lap_receiving_response.toFixed(3)), " milliseconds");
        console.log("   time processing response  : ", w(stats.lap_processing_response.toFixed(3)), " milliseconds");
    }
    console.log(chalk.green.bold("---------------------------------------------------------------------<< Stats"));
}

const nameLength = "TranslateBrowsePathsToNodeIdsResponse".length + 2;

function __get_extraInfo(req: Response | Request): string {
    if (req instanceof ReadRequest) {
        return " nodesToRead.length    =" + req.nodesToRead?.length;
    }
    if (req instanceof ReadResponse) {
        return " results.length        =" + req.results?.length;
    }
    if (req instanceof WriteRequest) {
        return " nodesToWrite.length   =" + req.nodesToWrite?.length;
    }
    if (req instanceof WriteResponse) {
        return " results.length        =" + req.results?.length;
    }
    if (req instanceof BrowseRequest) {
        return " nodesToBrowse.length  =" + req.nodesToBrowse?.length;
    }
    if (req instanceof BrowseResponse) {
        return " results.length        =" + req.results?.length;
    }
    if (req instanceof BrowseNextRequest) {
        return "                        "; // nodesToBrowse.length" + req.?.length;
    }
    if (req instanceof BrowseNextResponse) {
        return " results.length        =" + req.results?.length;
    }
    if (req instanceof CreateSessionRequest) {
        return " " + req.sessionName + " to:" + req.requestedSessionTimeout + "ms";
    }
    if (req instanceof CreateSessionResponse) {
        return " " + req.sessionId + " to:" + req.revisedSessionTimeout + "ms";
    }
    if (req instanceof ActivateSessionRequest) {
        if (req.userIdentityToken instanceof AnonymousIdentityToken) {
            return " Anonymous";
        } else if (req.userIdentityToken instanceof UserNameIdentityToken) {
            return " UserName";
        } else if (req.userIdentityToken instanceof X509IdentityToken) {
            return " X509";
        }
    }
    if (req instanceof ActivateSessionResponse) {
        return (req.results || []).map((p) => p.toString()).join(" ");
    }
    if (req instanceof CreateMonitoredItemsRequest) {
        return " itemsToCreate.length  =" + req.itemsToCreate?.length;
    }
    if (req instanceof CreateMonitoredItemsResponse) {
        return " results.length        =" + req.results?.length;
    }
    if (req instanceof TranslateBrowsePathsToNodeIdsRequest) {
        return " browsePaths.length    =" + req.browsePaths?.length;
    }
    if (req instanceof TranslateBrowsePathsToNodeIdsResponse) {
        return " results.length        =" + req.results?.length;
    }
    if (req instanceof RegisterNodesRequest) {
        return " nodesToRegister.length=" + req.nodesToRegister?.length;
    }
    if (req instanceof OpenSecureChannelRequest) {
        return (
            " " +
            SecurityTokenRequestType[req.requestType] +
            " " +
            MessageSecurityMode[req.securityMode] +
            " lt:" +
            req.requestedLifetime +
            "ms"
        );
    }
    if (req instanceof RegisterNodesResponse) {
        return " nodesToRegister.length=" + req.registeredNodeIds?.length;
    }
    if (req instanceof PublishRequest) {
        return " " + req.requestHeader.timeoutHint + "ms";
    }
    if (req instanceof PublishResponse) {
        let t = "";
        if (req.notificationMessage.notificationData) {
            for (const n of req.notificationMessage.notificationData) {
                t += n?.constructor?.name + " ";
                if (n instanceof DataChangeNotification) {
                    t += n.monitoredItems?.length;
                }
                if (n instanceof EventNotificationList) {
                    t += n.events?.length;
                }
                if (n instanceof StatusChangeNotification) {
                    t += n.status.toString();
                }
                t += " ";
                t = t.replace(/Notification/g, "Nt°");
            }
        }
        return " " + t + " seq#=" + req.notificationMessage.sequenceNumber;
    }
    return "";
}

function _get_extraInfo(req: Response | Request): string {
    return __get_extraInfo(req).padEnd(30);
}

function evaluateBinarySize(r: Request | Response): string {
    const e = r as any;
    const size = e.binaryStoreSize();
    return "s=" + ("" + size).padStart(6) + " ";
}

export function isGoodish(statusCode: StatusCode): boolean {
    return statusCode.value < 0x40000000;
}

function statusCodeToString(s: StatusCode): string {
    if (s === StatusCodes.Good) {
        return chalk.green(s.toString());
    } else if (isGoodish(s)) {
        return chalk.yellow(s.toString());
    } else {
        return chalk.red(s.toString());
    }
}

// istanbul ignore next
export function traceRequestMessage(request: Request, channelId: number, instance: number): void {
    if (doTraceServerMessage) {
        const extra = _get_extraInfo(request);
        const size = evaluateBinarySize(request);
        const requestId = request.requestHeader.requestHandle;
        console.log(
            chalk.green(timestamp(), "   >>>>> ------ S"),
            instance.toString().padStart(3),
            channelId.toString().padStart(3),
            requestId.toString().padStart(8),
            chalk.yellow(request.schema.name.padEnd(nameLength)),
            extra,
            size
        );
        if (doTraceRequest && filter && request.constructor.name.match(filter)) {
            console.log(request.toString());
            console.log(chalk.cyan("   >>>>> ------ \n"));
        }
    }
}

// istanbul ignore next
export function traceResponseMessage(response: Response, channelId: number, instance: number): void {
    assert(response.responseHeader.requestHandle >= 0);
    if (doTraceServerMessage) {
        const extra = _get_extraInfo(response);
        const size = evaluateBinarySize(response);
        const requestId = response.responseHeader.requestHandle;
        console.log(
            chalk.green.bold(timestamp(), "   <<<<< ------ S"),
            instance.toString().padStart(3),
            channelId.toString().padStart(3),
            requestId.toString().padStart(8),
            chalk.green.bold(response.schema.name.padEnd(nameLength)),
            extra,
            size,
            statusCodeToString(response.responseHeader.serviceResult)
        );
        if (doTraceResponse && filter && response.constructor.name.match(filter)) {
            console.log(response.toString());
            console.log(chalk.cyan.bold("       <<<<< ------n"));
        }
    }
}

// istanbul ignore next
// istanbul ignore next
export function traceClientRequestMessage(request: Request, channelId: number, instance: number): void {
    const extra = _get_extraInfo(request);
    const size = evaluateBinarySize(request);
    const requestId = request.requestHeader.requestHandle;
    console.log(
        chalk.cyan(timestamp(), "  >>>>>> ------ C"),
        instance.toString().padStart(3),
        channelId.toString().padStart(3),
        requestId.toString().padStart(8),
        request.schema.name.padEnd(nameLength),
        extra,
        size
    );
}

export function traceClientResponseMessage(response: Response, channelId: number, instance: number): void {
    const extra = _get_extraInfo(response);
    const size = evaluateBinarySize(response);
    const requestId = response.responseHeader.requestHandle;
    console.log(
        chalk.cyan.bold(timestamp(), "  <<<<<< ------ C"),
        instance.toString().padStart(3),
        channelId.toString().padStart(3),
        requestId.toString().padStart(8),
        response.schema.name.padEnd(nameLength),
        extra,
        size,
        statusCodeToString(response.responseHeader.serviceResult)
    );
}
