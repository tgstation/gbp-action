import { GithubUser } from "../github"
import { Mediator, PullRequestId } from "./mediator"

type PostCommentCallback = (comment: string) => void

export class VirtualMediator implements Mediator {
    onPostComment?: PostCommentCallback

    pointDifferences: Map<
        PullRequestId,
        {
            user: GithubUser
            pointDifference: number
        }
    > = new Map()

    constructor(onPostComment?: PostCommentCallback) {
        this.onPostComment = onPostComment
    }

    async getPointDifferences(): Promise<Map<GithubUser, number>> {
        return Promise.resolve(
            new Map(
                [...this.pointDifferences.values()].map((value) => {
                    return [value.user, value.pointDifference]
                }),
            ),
        )
    }

    async isMaintainer(user: GithubUser): Promise<boolean> {
        // Job security
        return user.login === "Mothblocks"
    }

    async newPointDifference(
        id: PullRequestId,
        user: GithubUser,
        pointDifference: number,
    ) {
        this.pointDifferences.set(id, {
            user,
            pointDifference,
        })
    }

    async postComment(comment: string) {
        if (this.onPostComment !== undefined) {
            this.onPostComment(comment)
        }
    }

    async writePointDifferences(
        _pointDifferences: Map<GithubUser, number>,
    ): Promise<void> {
        this.pointDifferences = new Map()
    }

    info(message: string) {
        console.info(message)
    }
}
