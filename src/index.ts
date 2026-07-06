import * as core from '@actions/core'
import * as github from '@actions/github'
import {collect} from './actions/collect'
import {merged} from './actions/merged'
import {opened} from './actions/opened'
import {Configuration, readConfiguration} from './configuration'
import {GithubPullRequest, GithubUser} from './github'
import {GithubMediator} from './mediators/github'
import {EOL} from 'os'

async function run(): Promise<void> {
    const directory = core.getInput('directory', {
        required: false
    })

    const configuration = await readConfiguration(directory).catch(
        async (reason): Promise<Configuration> => {
            return Promise.reject(
                `Couldn't read configuration file.\n${reason}`
            )
        }
    )

    const mediator = new GithubMediator(
        configuration,
        github.context.payload,
        directory
    )

    if (
        core.getInput('collect', {
            required: false
        }) === 'true'
    ) {
        return collect(mediator)
    }

    const pullRequest = github.context.payload.pull_request as GithubPullRequest

    if (pullRequest === undefined) {
        return Promise.reject('No pull request detected.')
    }

    switch (github.context.payload.action) {
        case 'opened':
            return opened(configuration, mediator, pullRequest, directory)
        case 'closed':
            const mentioned: GithubUser[] = [pullRequest.user]

            //find all names between :cl: and the new line to give credit for
            let cl_index = pullRequest.body.lastIndexOf(':cl:')
            if (cl_index != -1) {
                cl_index += 4
                const nl_index = pullRequest.body.indexOf(EOL, cl_index)
                if (nl_index != -1) {
                    let contributor = ''
                    for (let i = cl_index; i < nl_index; i++) {
                        const char = pullRequest.body.charAt(i)
                        if (
                            char == ',' ||
                            char == ' '
                        ) //delimiters the pr author can use to seperate names by
                        {
                            contributor = contributor.trim()
                            if (contributor.length == 0) {
                                contributor = ''
                                continue
                            }

                            const user: GithubUser | undefined =
                                await mediator.getUserByName(contributor)
                            if (user) {
                                if (user.id != pullRequest.user.id) {
                                    mentioned.push(user)
                                } else {
                                    mediator.info(
                                        'Author should not mentioned again in the changelog'
                                    )
                                }
                            } else {
                                mediator.info(`${contributor} does not exist`)
                            }

                            contributor = ''
                        } else {
                            contributor += char
                        }
                    }
                }
            }

            return merged(
                configuration,
                mediator,
                pullRequest,
                mentioned,
                directory
            )
        default:
            core.info(`Unknown action: ${github.context.payload.action}`)
    }
}

run().catch(problem => {
    core.setFailed(problem.toString())
})
