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

const execShellCommand = (command: string, cwd?: string) => {
    return new Promise((resolve, reject) => {
        exec(command, { cwd }, (error, stdout) => {
            if (error) {
                reject(error)
            } else {
                resolve(stdout)
            }
        })
    })
}

const createCatchFileNotFound = <T>(value: T) => {
    return (error: { code: unknown }) => {
        if (error.code !== "EEXIST" && error.code !== "ENOENT") {
            return Promise.reject(error)
        } else {
            return Promise.resolve(value)
        }
    }
}

const catchFileNotFound = createCatchFileNotFound(undefined)

export class GithubMediator implements Mediator {
    configuration: Configuration
    directory?: string
    octokit: ReturnType<typeof getOctokit>
    payload: typeof github.context.payload

    constructor(
        configuration: Configuration,
        payload: typeof github.context.payload,
        directory?: string,
    ) {
        this.configuration = configuration
        this.directory = directory
        this.payload = payload

        this.octokit = github.getOctokit(core.getInput("token"))
    }

    execShellCommand(command: string) {
        return execShellCommand(command, this.directory)
    }

    async getPointDifferences(): Promise<Map<GithubUser, number>> {
        const differencesDirectory = this.joinDirectory(DIRECTORY)
        const filenames = await fs
            .readdir(differencesDirectory)
            .catch(createCatchFileNotFound<string[]>([]))

        return Promise.all(
            filenames.map((filename) => {
                filename = path.join(differencesDirectory, filename)

                return fs
                    .open(filename, "r")
                    .then((file) => {
                        return file.readFile({
                            encoding: "utf-8",
                        })
                    })
                    .then(JSON.parse)
                    .then((contentObject) => {
                        const valueEither =
                            pointDifferenceSchema.decode(contentObject)

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
                        await fs.unlink(filename)
                        return undefined
                    })
            }),
        )
            .then(filterUndefined)
            .then((pointDifferences) => {
                const pointDifferencesById = new Map<number, number>()

                // Track usernames separately in case someone changed username halfway through
                const usernames = new Map<number, string>()

                for (const difference of Object.values(pointDifferences)) {
                    const user: GithubUser = difference.user

                    pointDifferencesById.set(
                        user.id,
                        (pointDifferencesById.get(user.id) || 0) +
                            difference.difference,
                    )

                    usernames.set(user.id, user.login)
                }

                return new Map(
                    [...pointDifferencesById.entries()].map(
                        ([userId, pointDifference]) => {
                            return [
                                {
                                    id: userId,
                                    login: usernames.get(userId)!,
                                },
                                pointDifference,
                            ]
                        },
                    ),
                )
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

            // Don't just pass in `user`, since there's a lot more than just these two fields
            user: {
                id: user.id,
                login: user.login,
            },
        }

        await fs.mkdir(this.joinDirectory(DIRECTORY)).catch(catchFileNotFound)

        this.octokit.repos.createOrUpdateFileContents({
            branch: core.getInput("branch", {
                required: false,
            }),
            content: Buffer.from(JSON.stringify(pointDifferenceData)).toString(
                "base64",
            ),
            owner: github.context.payload.repository?.owner?.login!,
            repo: github.context.payload.repository?.name!,
            message: `Updating GBP balances for #${id}`,
            path: getFilenameForId(id),
        })
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

        let balanceSheet = await readBalanceFile(this.directory)
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
        } catch (exception) {
            return Promise.reject(
                `setBalance resulted in invalid output\n${exception}\nBalance sheet:\n${balanceSheet}`,
            )
        }

        await Promise.all([
            writeBalanceFile(balanceSheet, this.directory),
            fs
                .readdir(this.joinDirectory(DIRECTORY))
                .then((filenames) => {
                    return Promise.all(
                        filenames.map((filename) =>
                            fs.unlink(this.joinDirectory(DIRECTORY, filename)),
                        ),
                    )
                })
                .catch(catchFileNotFound),
        ])

        await this.execShellCommand("git add .")
        await this.execShellCommand(
            `git commit -m "Updating ${pointDifferences.size} GBP score(s)"`,
        )
        await this.execShellCommand("git push origin HEAD")
    }

    joinDirectory(...paths: string[]): string {
        return this.directory
            ? path.join(this.directory, ...paths)
            : path.join(...paths)
    }
}
