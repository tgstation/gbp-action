import * as core from "@actions/core"
import * as github from "@actions/github"
import { getOctokit } from "@actions/github"
import { exec } from "child_process"
import { isRight } from "fp-ts/lib/Either"
import { promises as fs } from "fs"
import * as t from "io-ts"
import path from "path"
import toml from "toml"
import { Configuration } from "../configuration"
import { filterUndefined } from "../filterUndefined"
import { GithubUser } from "../github"
import {
    readBalanceFile,
    readBalances,
    setBalance,
    writeBalanceFile,
} from "../points"
import { Mediator, PullRequestId } from "./mediator"

const pointDifferenceSchema = t.interface({
    user: t.strict({
        id: t.number,
        login: t.string,
    }),

    difference: t.number,
})

const DIRECTORY = "point-differences"

const getFilenameForId = (id: PullRequestId): string =>
    `${DIRECTORY}/${id}.json`

const execShellCommand = (command: string) => {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout) => {
            if (error) {
                reject(error)
            } else {
                resolve(stdout)
            }
        })
    })
}

export class GithubMediator implements Mediator {
    configuration: Configuration
    octokit: ReturnType<typeof getOctokit>
    payload: typeof github.context.payload

    constructor(
        configuration: Configuration,
        payload: typeof github.context.payload,
    ) {
        this.configuration = configuration
        this.payload = payload

        this.octokit = github.getOctokit(core.getInput("token"))
    }

    async getPointDifferences(): Promise<Map<GithubUser, number>> {
        const filenames = await fs.readdir(DIRECTORY)

        return Promise.all(
            filenames.map((filename) =>
                fs
                    .open(path.join(DIRECTORY, filename), "r")
                    .then((file) => {
                        return file.readFile({
                            encoding: "utf-8",
                        })
                    })
                    .then(JSON.parse)
                    .then((contentObject) => {
                        const valueEither = pointDifferenceSchema.decode(
                            contentObject,
                        )

                        if (isRight(valueEither)) {
                            return valueEither.right
                        } else {
                            throw valueEither.left
                        }
                    })
                    .catch(async (problem) => {
                        core.error(
                            `${filename} was not in the right format! ${problem}`,
                        )
                        await fs.rm(filename)
                        return undefined
                    }),
            ),
        )
            .then(filterUndefined)
            .then((pointDifferences) => {
                const pointDifferenceResult = new Map()

                // Track usernames separately in case someone changed username halfway through
                const usernames = new Map()

                for (const difference of Object.values(pointDifferences)) {
                    const user: GithubUser = difference.user

                    pointDifferenceResult.set(
                        user.id,
                        (pointDifferenceResult.get(user.id) || 0) +
                            difference.difference,
                    )

                    usernames.set(user.id, user.login)
                }

                return pointDifferenceResult
            })
    }

    info(message: string) {
        core.info(message)
    }

    async isMaintainer(user: GithubUser): Promise<boolean> {
        const maintainerTeamSlug = this.configuration.maintainer_team_slug
        const payload = this.payload
        const octokit = this.octokit

        if (
            maintainerTeamSlug === undefined ||
            payload.pull_request?.base.repo.owner.type !== "Organization"
        ) {
            const collaborator = await octokit.repos
                .getCollaboratorPermissionLevel({
                    owner: payload.repository?.owner?.login!,
                    repo: payload.repository?.name!,
                    username: user.login!,
                })
                .catch(() => {
                    return undefined
                })

            if (collaborator === undefined) {
                return false
            }

            const permission = collaborator.data.permission
            return permission === "admin" || permission === "write"
        } else {
            const membership = await octokit.teams
                .getMembershipForUserInOrg({
                    org: payload.repository?.owner?.login!,
                    team_slug: maintainerTeamSlug,
                    username: user.login!,
                })
                .catch(() => {
                    return undefined
                })

            if (membership === undefined) {
                return false
            }

            return membership.data.state === "active"
        }
    }

    async newPointDifference(
        id: PullRequestId,
        user: GithubUser,
        pointDifference: number,
    ) {
        const pointDifferenceData: t.TypeOf<typeof pointDifferenceSchema> = {
            difference: pointDifference,
            user,
        }

        await fs.writeFile(
            getFilenameForId(id),
            JSON.stringify(pointDifferenceData),
            { encoding: "utf-8" },
        )

        // This should never fail, but we're about to send it to a shell command, for pete's sake.
        if (typeof id !== "number") {
            return Promise.reject(`Didn't get a numerical id: ${id}`)
        }

        // Highway to the danger zone!
        await execShellCommand(`git add ${DIRECTORY}`)
        await execShellCommand(
            `git commit -m "Updating GBP balance for #${id}"`,
        )
        await execShellCommand("git push origin HEAD")
    }

    async postComment(comment: string) {
        this.octokit.issues.createComment({
            owner: github.context.payload.repository?.owner?.login!,
            repo: github.context.payload.repository?.name!,
            issue_number: this.payload.pull_request!.number,
            body: comment,
        })
    }

    async writePointDifferences(pointDifferences: Map<GithubUser, number>) {
        if (pointDifferences.size === 0) {
            core.info("No point differences.")
            return
        }

        let balanceSheet = await readBalanceFile()
        const balances = balanceSheet ? readBalances(balanceSheet) : {}

        for (const [user, points] of pointDifferences.entries()) {
            balanceSheet = setBalance(
                balanceSheet,
                user,
                (balances[user.id] || 0) + points,
            )
        }

        if (balanceSheet === undefined) {
            return
        }

        try {
            toml.parse(balanceSheet)
        } catch {
            return Promise.reject(
                `setBalance resulted in invalid output: ${balanceSheet}`,
            )
        }

        await Promise.all([
            writeBalanceFile(balanceSheet),
            fs.readdir(DIRECTORY).then((filenames) => {
                return Promise.all(filenames.map((filename) => fs.rm(filename)))
            }),
        ])

        await execShellCommand("git add .")
        await execShellCommand(
            `git commit -m "Updating ${pointDifferences.size} GBP scores"`,
        )
        await execShellCommand("git push origin HEAD")
    }
}
