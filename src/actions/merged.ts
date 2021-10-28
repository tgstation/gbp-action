import { GithubPullRequest } from "../github"
import * as points from "../points"
import { Configuration } from "../configuration"
import { Mediator } from "../mediators/mediator"

export async function merged(
    configuration: Configuration,
    mediator: Mediator,
    pullRequest: GithubPullRequest,
    basePath?: string,
) {
    if (!pullRequest.merged) {
        mediator.info("Pull request was closed, not merged.")
        return
    }

    const { labels, user } = pullRequest
    const labelNames = labels.map((label) => label.name)

    const balanceSheet = await points.readBalanceFile(basePath)
    const oldBalance =
        (balanceSheet && points.readBalances(balanceSheet)[user.id]) ?? 20

    let balance
    let pointsReceived = 0

    if (
        configuration.reset_label !== undefined &&
        labelNames.indexOf(configuration.reset_label) !== -1
    ) {
        balance = 0
    } else {
        pointsReceived = points.getPointsFromLabels(configuration, labelNames)

        if (pointsReceived === 0) {
            return
        }

        balance = oldBalance + pointsReceived
    }

    mediator.newPointDifference(pullRequest.number, user, pointsReceived)

    if (await mediator.isMaintainer(pullRequest.user)) {
        mediator.info("Author is maintainer")
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
        await mediator.postComment(comment)
    }
}
