import * as path from "path"
import { Configuration } from "./configuration"
import { getOctokit } from "@actions/github"

const POINTS_DIRECTORY = "points"

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
    const filePath = path.join(POINTS_DIRECTORY, `${userId}.txt`)

    const sha = await octokit.repos
        .getContent({
            owner,
            repo,
            path: filePath,
        })
        .then((contents) => {
            const data = contents.data
            return Array.isArray(data) ? undefined : data.sha
        })
        .catch(() => {
            // Most likely 404
            return undefined
        })

    console.log(`existing sha: ${sha}`)

    await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        branch,
        message,
        content: Buffer.from(points.toString(), "binary").toString("base64"),
        path: filePath,
        sha,
    })
}
