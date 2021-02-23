import * as core from "@actions/core"
import * as github from "@actions/github"
import * as toml from "toml"
import { readConfiguration } from "./configuration"
import { GithubLabel, GithubUser } from "./github"
import * as points from "./points"

async function run() {
    const configuration = await readConfiguration().catch((reason) => {
        return Promise.reject(`Couldn't read configuration file.\n${reason}`)
    })

    const pullRequest = github.context.payload.pull_request
    if (pullRequest === undefined) {
        return Promise.reject(`No pull request was provided.`)
    }

    if (!pullRequest.merged) {
        core.info("Pull request was closed, not merged.")
        return
    }

    const labels: GithubLabel[] = pullRequest.labels
    const labelNames = labels.map((label) => label.name)
    const user: GithubUser = pullRequest.user

    const balanceSheet = await points.readBalanceFile()
    const oldBalance =
        (balanceSheet && points.readBalances(balanceSheet)[user.id]) || 0

    let balance
    let pointsReceived = 0

    if (
        configuration.reset_label !== undefined &&
        labelNames.indexOf(configuration.reset_label) !== -1
    ) {
        balance = 0
    } else {
        const pointsReceived = points.getPointsFromLabels(
            configuration,
            labelNames,
        )
        balance = oldBalance + pointsReceived

        if (pointsReceived === 0) {
            return
        }
    }

    const newOutput = points.setBalance(balanceSheet, user, balance)
    try {
        toml.parse(newOutput)
    } catch {
        return Promise.reject(
            `setBalance resulted in invalid output: ${newOutput}`,
        )
    }

    const octokit = github.getOctokit(core.getInput("token"))

    const fileContentsParams = {
        owner: github.context.payload.repository?.owner?.login!,
        repo: github.context.payload.repository?.name!,
        path: ".github/gbp-balances.toml",
    }

    const sha = await octokit.repos
        .getContent(fileContentsParams)
        .then((contents) => {
            const data = contents.data
            return Array.isArray(data) ? undefined : data.sha
        })
        .catch(() => {
            // Most likely 404
            return undefined
        })

    await octokit.repos.createOrUpdateFileContents({
        ...fileContentsParams,
        message: `Updating GBP from PR #${pullRequest.number} [ci skip]`,
        content: Buffer.from(newOutput, "binary").toString("base64"),
        sha,
    })

    // Only send comment after its ensured the GBP is saved
    // TODO: Don't send for maintainers (commit access)
    let comment

    if (balance > 0 && oldBalance < 0) {
        comment =
            `Your Fix/Feature pull request delta is now above zero (${balance}). ` +
            "Feel free to make Feature/Balance PRs."
    } else if (balance < 0 && pointsReceived < 0) {
        comment =
            `Your Fix/Feature pull request is currently below zero (${balance}). ` +
            "Maintainers may close future Feature/Balance PRs. " +
            "Fixing issues or helping to improve the codebase will raise this score."
    }

    if (comment !== undefined) {
        await octokit.issues.createComment({
            owner: github.context.payload.repository?.owner?.login!,
            repo: github.context.payload.repository?.name!,
            issue_number: pullRequest.number,
            body: comment,
        })
    }
}

run().catch((problem) => {
    core.setFailed(problem.toString())
})
