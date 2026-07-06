import {GithubPullRequest, GithubUser} from '../github'
import * as points from '../points'
import {Configuration} from '../configuration'
import {Mediator} from '../mediators/mediator'

export async function merged(
    configuration: Configuration,
    mediator: Mediator,
    pullRequest: GithubPullRequest,
    mentioned: GithubUser[],
    basePath?: string
): Promise<void> {
    if (!pullRequest.merged) {
        mediator.info('Pull request was closed, not merged.')
        return
    }

    const {labels} = pullRequest
    const labelNames = labels.map(label => label.name)

    const balanceSheet = await points.readBalanceFile(basePath)
    const balances = balanceSheet
        ? points.readBalances(balanceSheet)
        : undefined

    const labelPoints = points.getPointsFromLabels(configuration, labelNames)
    const reset =
        configuration.reset_label !== undefined &&
        labelNames.includes(configuration.reset_label)

    let comment

    for (const user of mentioned) {
        const oldBalance = (balances && balances[user.id]) || 0

        let balance
        let pointsReceived = 0

        if (reset) {
            // Force pointsReceived up enough to make balance default
            pointsReceived = -oldBalance
        } else {
            pointsReceived = labelPoints
        }

        if (pointsReceived === 0) {
            continue
        }
        balance = oldBalance + pointsReceived

        mediator.newPointDifference(pullRequest.number, user, pointsReceived)

        if (await mediator.isMaintainer(user)) {
            mediator.info('Author is maintainer')
            continue
        }

        // Only send comment after its ensured the GBP is saved
        if (user.id == pullRequest.user.id) {
            if (balance >= 0 && oldBalance < 0) {
                comment =
                    `Your Fix/Feature pull request delta is now above zero (${balance}). ` +
                    'Feel free to make Feature/Balance PRs.'
            } else if (balance < 0 && pointsReceived < 0) {
                comment =
                    `Your Fix/Feature pull request is currently below zero (${balance}). ` +
                    'Maintainers may close future Feature/Balance PRs. ' +
                    'Fixing issues or helping to improve the codebase will raise this score.'
            }
        }
    }

    if (comment !== undefined) {
        await mediator.postComment(comment)
    }
}
