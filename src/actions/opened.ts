import * as core from "@actions/core"
import * as github from "@actions/github"
import { Configuration } from "../configuration"
import { GithubUser } from "../github"
import { isMaintainer } from "../isMaintainer"
import * as points from "../points"

export async function opened(configuration: Configuration) {
    const pullRequest = github.context.payload.pull_request
    if (pullRequest === undefined) {
        return Promise.reject(`No pull request was provided.`)
    }

    const octokit = github.getOctokit(core.getInput("token"))

    const user: GithubUser = pullRequest.user
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

    const balanceSheet = await points.readBalanceFile()
    const userBalance =
        (balanceSheet && points.readBalances(balanceSheet)[user.id]) || 0

    if (userBalance < 0) {
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
