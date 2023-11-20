export interface ISessionWithTransportSettings {
    getTransportSettings?: () => { maxMessageSize: 0 };
}
export function getTransportMaxMessageSize(session: ISessionWithTransportSettings): number {
    return session.getTransportSettings ? session.getTransportSettings().maxMessageSize : 0;
}
