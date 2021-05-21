import { 
    CreateSubscriptionRequestOptions,
    CreateSubscriptionResponse,
    CreateMonitoredItemsRequestOptions,
    CreateMonitoredItemsResponse,
} from "node-opcua-service-subscription";
import { 
    ResponseCallback 
} from "./basic_session_interface";

/**
 * @module node-opcua-pseudo-session
 */
export interface IBasicSessionWithSubscription {
    
    createSubscription(options: CreateSubscriptionRequestOptions, callback: ResponseCallback<CreateSubscriptionResponse>): void;
    createSubscription(options: CreateSubscriptionRequestOptions): Promise<CreateSubscriptionResponse>;
  
    // setMonitoringMode(options: SetMonitoringModeRequestLike, callback: ResponseCallback<SetMonitoringModeResponse>): void;
    // setMonitoringMode(options: SetMonitoringModeRequestLike): Promise<SetMonitoringModeResponse>;
  
    createMonitoredItems(options: CreateMonitoredItemsRequestOptions, callback: ResponseCallback<CreateMonitoredItemsResponse>): void;
    createMonitoredItems(options: CreateMonitoredItemsRequestOptions): Promise<CreateMonitoredItemsResponse>;
  }
