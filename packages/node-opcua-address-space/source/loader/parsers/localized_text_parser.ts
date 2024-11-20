import { coerceLocalizedText, LocalizedTextOptions, LocalizedText } from "node-opcua-data-model";
import { ReaderStateParserLike } from "node-opcua-xml2json";

type LocalizedTextParserLikeL1 = ReaderStateParserLike & {
    localizedText: LocalizedTextOptions;
    value: LocalizedText | null;
};
type LocalizedTextParserLikeL2 = { parent: LocalizedTextParserLikeL1; text: string };

export const localizedText_parser = {
    LocalizedText: {
        init(this: LocalizedTextParserLikeL1) {
            this.localizedText = { locale: undefined, text: undefined };
            this.value = null;
        },
        parser: {
            Locale: {
                finish(this: LocalizedTextParserLikeL2) {
                    this.parent.localizedText = this.parent.localizedText || { text: undefined};
                    this.parent.localizedText.locale = this.text.trim();
                }
            },
            Text: {
                finish(this: LocalizedTextParserLikeL2) {
                    this.parent.localizedText = this.parent.localizedText || { text: undefined };
                    this.parent.localizedText.text = this.text.trim();
                }
            }
        },
        finish(this: LocalizedTextParserLikeL1) {
            this.value = coerceLocalizedText(this.localizedText);
        }
    }
};
