/**
 * @module node-opcua-address-space
 */
import { BrowseDirection } from "node-opcua-data-model";

export function adjustBrowseDirection(
    browseDirection: BrowseDirection | null | undefined,
    defaultValue: BrowseDirection
): BrowseDirection {
    // istanbul ignore next
    if (browseDirection === null || browseDirection === undefined) {
        return defaultValue;
    }
    return browseDirection;
}
