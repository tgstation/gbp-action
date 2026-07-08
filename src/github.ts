// Types that @actions/github doesn't provide for some reason
export type GithubLabel = {
    name: string
}

export type GithubUser = {
    id: number
    login: string
}

// @github/actions *does* have this, but it's too lax
export type GithubPullRequest = {
    labels: GithubLabel[]
    merged: boolean
    number: number
    user: GithubUser
}
