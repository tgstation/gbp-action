import { promises as fs } from "fs"
import { isRight } from "fp-ts/lib/Either"
import * as path from "path"
import * as t from "io-ts"
import * as os from "os"
import * as toml from "toml"
import { Configuration } from "./configuration"
import { GithubUser } from "./github"
import { getOctokit } from "@actions/github"

const POINTS_DIRECTORY = "points"
// https://github.community/t/create-orphan-branch-using-octokit-api-1984/157029/2
const SHA1_EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"
const README =
    "This branch is used and automatically managed by [gbp-action](https://github.com/tgstation/gbp-action). \
    Don't touch it yourself unless you know what you're doing."

export function getPointsFromLabels(
    configuration: Configuration,
    labels: string[],
): number {
    let points = 0
    for (const label of labels) {
        if (label === configuration.no_balance_label) {
            points = 0
            break
        } else {
            points += configuration.points.get(label) || 0
        }
    }

    return points
}

function getUserId(line: string): number | undefined {
    const userId = parseInt(line.split(" ")[0], 10)
    if (Number.isNaN(userId)) {
        return undefined
    }

    return userId
}

export function readBalanceOf(
    octokit: ReturnType<typeof getOctokit>,
    owner: string,
    repo: string,
    branch: string,
    id: number,
): Promise<number | undefined> {
    return octokit.repos
        .getContent({
            owner,
            repo,
            path: path.join(POINTS_DIRECTORY, `${id}.txt`),
            ref: branch,
        })
        .then((content) => {
            const data = content.data as {
                content: string
            }

            const points = parseInt(data.content, 10)
            if (Number.isNaN(points)) {
                return Promise.reject(`Points is somehow NaN: ${content}`)
            }
        })
        .catch(() => undefined)
}

export async function writeBalanceOf(
    octokit: ReturnType<typeof getOctokit>,
    branch: string,
    owner: string,
    repo: string,
    message: string,
    userId: number,
    points: number,
): Promise<void> {
    const branchExists = await octokit.git
        .getRef({
            owner,
            repo,
            ref: `heads/${branch}`,
        })
        .then(() => true)
        .catch(() => false)

    if (!branchExists) {
        await octokit.git.createRef({
            owner,
            repo,
            ref: `refs/heads/${branch}`,
            sha: SHA1_EMPTY_TREE,
        })

        await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            branch,
            path: "README.md",
            message: "Initial commit",
            content: README,
        })
    }

    await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        branch,
        message,
        path: path.join(POINTS_DIRECTORY, `${userId}.txt`),
        content: points.toString(),
    })
}
