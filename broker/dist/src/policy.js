import fs from "node:fs";
import Ajv from "ajv/dist/2020.js";
import path from "node:path";
export function loadActions(actionsPath) {
    const raw = fs.readFileSync(actionsPath, "utf8");
    const json = JSON.parse(raw);
    const schemaPath = process.env.BROKER_ACTIONS_SCHEMA_PATH
        ?? path.resolve(path.dirname(actionsPath), "actions.schema.json");
    const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
    const ajv = new Ajv({ allErrors: true, strict: true });
    const validate = ajv.compile(schema);
    if (!validate(json)) {
        const errors = validate.errors?.map(e => `${e.instancePath} ${e.message}`).join("\n");
        throw new Error(`Invalid actions config:\n${errors}`);
    }
    return json;
}
