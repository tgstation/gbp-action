import * as Joi from "joi"
import * as toml from "toml"
import { promises as fs } from "fs"

export type Configuration = {
    no_balance_label?: string
    reset_label?: string

    points: Map<string, number>
}

const configurationSchema = Joi.object({
    no_balance_label: Joi.string().optional(),
    reset_label: Joi.string().optional(),

    points: Joi.object().pattern(Joi.string(), Joi.number()),
})

export async function readConfiguration(): Promise<Configuration> {
    const configFile = await fs.readFile("./.github/gbp.toml", {
        encoding: "utf-8",
    })

    const data = toml.parse(configFile)
    const value = await configurationSchema.validateAsync(data)

    return {
        no_balance_label: value.no_balance_label,
        reset_label: value.reset_label,

        points: new Map(Object.entries(value.points)),
    }
}
