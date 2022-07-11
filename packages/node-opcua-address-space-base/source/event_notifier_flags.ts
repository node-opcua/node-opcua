export enum EventNotifierFlags {
    SubscribeToEvents = 1 << 0,
    Reserved = 1 << 1,
    HistoryRead = 1 << 2,
    HistoryWrite = 1 << 3,
    None = 0x0
}
