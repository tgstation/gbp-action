import * as core from "@actions/core"
import * as github from "@actions/github"
import { Configuration } from "../configuration"
import { GithubLabel, GithubPullRequest } from "../github"
import { Mediator } from "../mediators/mediator"
import * as points from "../points"

export async function opened(
    configuration: Configuration,
    mediator: Mediator,
    pullRequest: GithubPullRequest,
    basePath?: string,
) {
    const octokit = github.getOctokit(core.getInput("token"))

    if (mediator.isMaintainer(pullRequest.user)) {
        core.info("Author is maintainer")
        return
    }

    const balanceSheet = await points.readBalanceFile(basePath)
    const userBalance =
        (balanceSheet &&
            points.readBalances(balanceSheet)[pullRequest.user.id]) ||
        0

    const labels: GithubLabel[] = pullRequest.labels
    const labelNames = labels.map((label) => label.name)

    const pointsReceived = points.getPointsFromLabels(configuration, labelNames)

    if (userBalance < 0 && pointsReceived <= 0) {
        await octokit.issues.createComment({
            owner: github.context.payload.repository?.owner?.login!,
            repo: github.context.payload.repository?.name!,
            issue_number: pullRequest.number,
            body:
                `You currently have a negative Fix/Feature pull request delta of ${userBalance}. ` +
                "Maintainers may close this PR at will. Fixing issues or improving the codebase " +
                "will improve this score.",
        })
    }
}
