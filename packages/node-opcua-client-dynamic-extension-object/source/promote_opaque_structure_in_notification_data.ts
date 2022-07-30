import { NotificationData, DataChangeNotification, EventNotificationList } from "node-opcua-types";
import { Variant, DataType } from "node-opcua-variant";
import { IBasicSession } from "node-opcua-pseudo-session";
import { promoteOpaqueStructure } from "./promote_opaque_structure";

export async function promoteOpaqueStructureInNotificationData(
    session: IBasicSession,
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
                        // eslint-disable-next-line max-depth
                        for (const eventField of events.eventFields) {
                            // eslint-disable-next-line max-depth
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
