import * as core from "@actions/core"
import * as github from "@actions/github"
import { readConfiguration } from "./configuration"
import { GithubLabel, GithubUser } from "./github"
import { getPointsFromLabels } from "./points"

async function run() {
    const configuration = await readConfiguration().catch((reason) => {
        core.setFailed(`Couldn't read configuration file.\n${reason}`)
        process.exit(1)
    })

    const pullRequest = github.context.payload.pull_request
    if (pullRequest === undefined) {
        core.setFailed(`No pull request was provided.`)
        process.exit(1)
    }

    const labels: GithubLabel[] = pullRequest.labels
    const labelNames = labels.map((label) => label.name)
    const user: GithubUser = pullRequest.user

    if (
        configuration.reset_label !== undefined &&
        labelNames.indexOf(configuration.reset_label) !== -1
    ) {
        core.setFailed("NYI: GBP: Reset")
        process.exit(1)
    }

    const points = getPointsFromLabels(configuration, labelNames)
}

run()
