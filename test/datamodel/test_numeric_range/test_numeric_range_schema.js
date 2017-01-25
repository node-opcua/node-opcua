
import {
    next_available_id
} from "lib/misc/factories";


const ObjWithNumericRange_Schema = {

    id: next_available_id(),
    name: "ObjWithNumericRange",
    fields: [
        {name: "title", fieldType: "UAString"},
        {
            name: "numericRange",
            fieldType: "NumericRange"
        }
    ]
};
export { ObjWithNumericRange_Schema };
