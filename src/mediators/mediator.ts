import { GithubUser } from "../github"

export type PullRequestId = number

export interface Mediator {
    getPointDifferences(): Promise<Map<GithubUser, number>>

    info(message: string): void

    isMaintainer(user: GithubUser): Promise<boolean>

    newPointDifference(
        id: PullRequestId,
        user: GithubUser,
        pointDifference: number,
    ): Promise<void>

    postComment(comment: string): Promise<void>

    writePointDifferences(
        pointDifferences: Map<GithubUser, number>,
    ): Promise<void>
}
