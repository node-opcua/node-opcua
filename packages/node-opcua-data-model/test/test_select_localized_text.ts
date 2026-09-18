import should from "should";
import { LocalizedText, selectLocalizedText } from "../dist/index.js";

// OPC 10000-4 v1.05.07 §5.7.3 ActivateSession: "the Server returns the string whose locale id
// exactly matches the locale id with the highest priority in the Client-supplied list. If there
// are no exact matches, then the Server ignores the <country/region> component of the locale id,
// and returns the string whose <language> component matches ... If there still are no matches,
// then the Server returns the string that it has". See also §5.4 Locale Negotiation.
describe("selectLocalizedText", () => {
    const names = [
        new LocalizedText({ text: "Weather Station", locale: "en-US" }),
        new LocalizedText({ text: "Station météo", locale: "fr-FR" }),
        new LocalizedText({ text: "Wetterstation", locale: "de" })
    ];
    const pick = (preferredLocales: (string | null | undefined)[]) => selectLocalizedText(names, preferredLocales)?.text;

    it("returns undefined when texts is null, undefined or empty", () => {
        should(selectLocalizedText(null, ["en"])).be.undefined();
        should(selectLocalizedText(undefined, ["en"])).be.undefined();
        should(selectLocalizedText([], ["en"])).be.undefined();
    });

    it("takes the first element without preferred locales", () => {
        should(pick([])).eql("Weather Station");
        should(selectLocalizedText(names, null)).eql(names[0]);
        should(selectLocalizedText(names, undefined)).eql(names[0]);
    });

    it("takes the most preferred locale that has an exact translation", () => {
        should(pick(["fr-FR", "de"])).eql("Station météo");
        should(pick(["ja-JP", "de"])).eql("Wetterstation");
    });

    it("matches case-insensitively", () => {
        should(pick(["FR-fr"])).eql("Station météo");
    });

    it("falls back to a same-language match when there is no exact match (en ~ en-US both ways)", () => {
        should(pick(["fr"])).eql("Station météo");
        should(pick(["de-AT"])).eql("Wetterstation");
    });

    it("prefers an exact match over a same-language match earlier in priority order", () => {
        // "de" is an exact match for the German entry, so it wins even though "en-US" (a
        // same-language match for the English entry) comes first in the caller's own list.
        should(selectLocalizedText([...names].reverse(), ["de", "en-US"])?.text).eql("Wetterstation");
    });

    it("falls back to the first element when nothing matches", () => {
        should(pick(["ja-JP"])).eql("Weather Station");
    });

    it("ignores null/empty entries in preferredLocales", () => {
        should(pick([null, undefined, "", "fr-FR"] as unknown as string[])).eql("Station météo");
    });
});
