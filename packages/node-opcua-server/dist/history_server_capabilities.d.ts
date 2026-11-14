export interface HistoryServerCapabilitiesOptions {
    accessHistoryDataCapability?: boolean;
    accessHistoryEventsCapability?: boolean;
    maxReturnDataValues?: number;
    maxReturnEventValues?: number;
    insertDataCapability?: boolean;
    replaceDataCapability?: boolean;
    updateDataCapability?: boolean;
    deleteRawCapability?: boolean;
    deleteAtTimeCapability?: boolean;
    insertEventCapability?: boolean;
    replaceEventCapability?: boolean;
    updateEventCapability?: boolean;
    deleteEventCapability?: boolean;
    insertAnnotationCapability?: boolean;
}
/**
 */
export declare class HistoryServerCapabilities {
    accessHistoryDataCapability: boolean;
    accessHistoryEventsCapability: boolean;
    maxReturnDataValues: number;
    maxReturnEventValues: number;
    insertDataCapability: boolean;
    replaceDataCapability: boolean;
    updateDataCapability: boolean;
    deleteRawCapability: boolean;
    deleteAtTimeCapability: boolean;
    insertEventCapability: boolean;
    replaceEventCapability: boolean;
    updateEventCapability: boolean;
    deleteEventCapability: boolean;
    insertAnnotationCapability: boolean;
    constructor(options?: HistoryServerCapabilitiesOptions);
}
//# sourceMappingURL=history_server_capabilities.d.ts.map