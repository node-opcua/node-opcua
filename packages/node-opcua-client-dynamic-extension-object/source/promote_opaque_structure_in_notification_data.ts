import type { IBasicSessionAsync2 } from "node-opcua-pseudo-session";
import { DataChangeNotification, EventNotificationList, type NotificationData } from "node-opcua-types";
import { DataType, type Variant } from "node-opcua-variant";
import { promoteOpaqueStructure } from "./promote_opaque_structure";

export async function promoteOpaqueStructureInNotificationData(
    session: IBasicSessionAsync2,
    notificationData: NotificationData[]
): Promise<void> {
    const dataValuesToPromote: { value: Variant }[] = [];
    for (const notification of notificationData) {
        if (!notification) {
            continue;
        }
        if (notification instanceof DataChangeNotification) {
            if (notification.monitoredItems) {
                for (const monitoredItem of notification.monitoredItems) {
                    if (monitoredItem.value.value && monitoredItem.value.value.dataType === DataType.ExtensionObject) {
                        dataValuesToPromote.push(monitoredItem.value);
                    }
                }
            }
        } else if (notification instanceof EventNotificationList) {
            if (notification.events) {
                for (const events of notification.events) {
                    if (events.eventFields) {
                        for (const eventField of events.eventFields) {
                            if (eventField.dataType === DataType.ExtensionObject) {
                                dataValuesToPromote.push({ value: eventField });
                            }
                        }
                    }
                }
            }
        }
    }
    await promoteOpaqueStructure(session, dataValuesToPromote);
}
