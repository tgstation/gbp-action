import * as core from "@actions/core"
import * as github from "@actions/github"
import * as toml from "toml"
import { isMaintainer } from "../isMaintainer"
import { GithubLabel, GithubUser } from "../github"
import * as points from "../points"
import { Configuration } from "../configuration"

export async function merged(configuration: Configuration) {
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

    const octokit = github.getOctokit(core.getInput("token"))

    const oldBalance =
        (await points.readBalanceOf(
            octokit,
            github.context.payload.repository?.owner?.login!,
            github.context.payload.repository?.name!,
            configuration.branch,
            user.id,
        )) || 0

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

    await points.writeBalanceOf(
        octokit,
        configuration.branch,
        github.context.payload.repository?.owner?.login!,
        github.context.payload.repository?.name!,
        `Updating GBP from PR #${pullRequest.number} [ci skip]`,
        user.id,
        balance,
    )

    if (
        await isMaintainer(
            octokit,
            configuration.maintainer_team_slug,
            github.context.payload,
            user,
        )
    ) {
        core.info("Author is maintainer")
        return
    }

    // Only send comment after its ensured the GBP is saved
    let comment

    if (balance >= 0 && oldBalance < 0) {
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
