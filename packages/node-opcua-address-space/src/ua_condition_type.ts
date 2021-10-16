import { UAMethod, UAObjectType } from "node-opcua-address-space-base";

export interface UAConditionType extends UAObjectType {
    disable: UAMethod;
    enable: UAMethod;
    conditionRefresh: UAMethod;
    conditionRefresh2: UAMethod;
    addComment: UAMethod;
}
