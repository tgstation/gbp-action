import * as core from "@actions/core"
import * as github from "@actions/github"
import { merged } from "./actions/merged"
import { opened } from "./actions/opened"
import { readConfiguration } from "./configuration"

async function run() {
    const configuration = await readConfiguration().catch((reason) => {
        return Promise.reject(`Couldn't read configuration file.\n${reason}`)
    })

    switch (github.context.payload.action) {
        case "opened":
            return opened(configuration)
        case "closed":
            return merged(configuration)
        default:
            core.info(`Unknown action: ${github.context.payload.action}`)
    }
}

run().catch((problem) => {
    core.setFailed(problem.toString())
})
