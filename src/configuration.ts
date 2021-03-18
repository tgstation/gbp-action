import { promises as fs } from "fs"
import { isRight } from "fp-ts/lib/Either"
import * as t from "io-ts"
import * as toml from "toml"

const BLACKLISTED_NAMES = new Set(["master", "main"])
const DEFAULT_BRANCH = "gbp-balances"

export type Configuration = {
    maintainer_team_slug?: string
    no_balance_label?: string
    reset_label?: string
    branch: string

    points: Map<string, number>
}

const configurationSchema = t.intersection([
    t.partial({
        branch: t.string,
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

        if (value.branch !== undefined && BLACKLISTED_NAMES.has(value.branch)) {
            throw `${value.branch} is a blacklisted name, as it is certainly not what you want. \
                The branches gbp-action uses should be used EXCLUSIVELY for gbp-actions. \
                The action will wipe the branch COMPLETELY, and use it just to store balances. \
            `
        }

        return {
            branch: DEFAULT_BRANCH,
            ...value,
            points: new Map(Object.entries(value.points)),
        }
    } else {
        throw valueEither.left
    }
}

export async function readConfiguration(): Promise<Configuration> {
    const configFile = await fs.readFile("./.github/gbp.toml", {
        encoding: "utf-8",
    })

    return parseConfig(configFile)
}
