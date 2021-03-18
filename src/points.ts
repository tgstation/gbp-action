import { promises as fs } from "fs"
import { isRight } from "fp-ts/lib/Either"
import * as path from "path"
import * as t from "io-ts"
import nodegit, { Repository } from "nodegit"
import * as os from "os"
import * as toml from "toml"
import { Configuration } from "./configuration"
import { GithubUser } from "./github"
import { getOctokit } from "@actions/github"

const GIT_ENOTFOUND = -3
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
    branch: string,
    id: number,
): Promise<number | undefined> {
    return nodegit.Repository.open("./.git")
        .then((repo) => repo.getBranchCommit(branch))
        .then((commit) =>
            commit.getEntry(path.join(POINTS_DIRECTORY, `${id}.txt`)),
        )
        .then((entry) => entry.getBlob())
        .then((blob) => {
            const contents = blob.toString()
            const points = parseInt(contents, 10)
            if (Number.isNaN(points)) {
                return Promise.reject(`Points is somehow NaN: ${contents}`)
            }

            return points
        })
        .catch((problem: { errno: number }) => {
            if (problem.errno === GIT_ENOTFOUND) {
                return undefined
            } else {
                return Promise.reject(problem)
            }
        })
}

export async function writeBalanceOf(
    branch: string,
    owner: string,
    repo: string,
    message: string,
    userId: number,
    points: number,
    octokit: ReturnType<typeof getOctokit>,
): Promise<void> {
    const repository = await nodegit.Repository.open("./.git")

    // nodegit is only used for GETTING the repository.
    // We use the GitHub API for writing files as it's a lot less hassle.
    // With nodegit, we'd need to clone to a temporary location, work on that,
    // copy over authentication information, then push.
    // It has to be done in a temporary folder otherwise it'll mess up local tests.
    // It's a better idea to do this, it lets us write tests for points, but it is
    // significantly more work.
    const branchExists = await repository
        .getBranchCommit(branch)
        .then(() => true)
        .catch((problem: { errno: number }) => {
            if (problem.errno === GIT_ENOTFOUND) {
                return false
            } else {
                return Promise.reject(problem)
            }
        })

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
