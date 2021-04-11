import { promises as fs } from "fs"
import { isRight } from "fp-ts/lib/Either"
import * as t from "io-ts"
import * as toml from "toml"
import path from "path"

const CONFIG_FILE = "./.github/gbp.toml"

export type Configuration = {
    maintainer_team_slug?: string
    no_balance_label?: string
    reset_label?: string

    points: Map<string, number>
}

const configurationSchema = t.intersection([
    t.partial({
        no_balance_label: t.string,
        reset_label: t.string,
    }),

    t.interface({
        points: t.record(t.string, t.number),
    }),
])

export function parseConfig(configurationText: string): Configuration {
    const valueEither = configurationSchema.decode(
        toml.parse(configurationText),
    )

    if (isRight(valueEither)) {
        const value = valueEither.right

        return {
            ...value,
            points: new Map(Object.entries(value.points)),
        }
    } else {
        throw valueEither.left
    }
}

export async function readConfiguration(
    basePath?: string,
): Promise<Configuration> {
    const configFile = await fs.readFile(
        basePath ? path.join(basePath, CONFIG_FILE) : CONFIG_FILE,
        {
            encoding: "utf-8",
        },
    )

    return parseConfig(configFile)
}
