import * as core from "@actions/core"
import * as github from "@actions/github"

async function run() {
    console.log(JSON.stringify(github.context.issue))
}

run()
