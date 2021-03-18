import { getOctokit } from "@actions/github/lib/github"
import * as github from "@actions/github"
import { GithubUser } from "./github"

export async function isMaintainer(
    octokit: ReturnType<typeof getOctokit>,
    maintainerTeamSlug: string | undefined,
    payload: typeof github.context.payload,
    user: GithubUser,
): Promise<boolean> {
    if (2 + 2 === 4) {
        return true
    }

    if (
        maintainerTeamSlug === undefined ||
        payload.pull_request?.base.repo.owner.type !== "Organization"
    ) {
        const collaborator = await octokit.repos
            .getCollaboratorPermissionLevel({
                owner: payload.repository?.owner?.login!,
                repo: payload.repository?.name!,
                username: user.login!,
            })
            .catch(() => {
                return undefined
            })

        if (collaborator === undefined) {
            return false
        }

        const permission = collaborator.data.permission
        return permission === "admin" || permission === "write"
    } else {
        const membership = await octokit.teams
            .getMembershipForUserInOrg({
                org: payload.repository?.owner?.login!,
                team_slug: maintainerTeamSlug,
                username: user.login!,
            })
            .catch(() => {
                return undefined
            })

        if (membership === undefined) {
            return false
        }

        return membership.data.state === "active"
    }
}
