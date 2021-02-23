import { GithubUser } from "./github"
import * as points from "./points"

describe("setBalance", () => {
    const user: GithubUser = {
        id: 100,
        login: "Mothblocks",
    }

    const earlierThanUser: GithubUser = {
        id: 50,
        login: "stylemistake",
    }

    const laterThanUser: GithubUser = {
        id: 200,
        login: "optimumtact",
    }

    it("should be able to start from scratch", () => {
        expect(points.setBalance(undefined, user, 5)).toBe(
            `${points.HEADER}100 = 5 # Mothblocks`,
        )
    })

    it("should be able to replace existing users", () => {
        let output = points.setBalance(undefined, user, 5)
        output = points.setBalance(output, user, 10)
        expect(output).toBe(`${points.HEADER}100 = 10 # Mothblocks`)
    })

    it("should add new users", () => {
        let output = points.setBalance(undefined, earlierThanUser, 5)
        output = points.setBalance(output, laterThanUser, 15)

        expect(output).toBe(
            points.HEADER +
                ["50 = 5 # stylemistake", "200 = 15 # optimumtact"].join("\n"),
        )

        output = points.setBalance(output, user, 10)
        expect(output).toBe(
            points.HEADER +
                [
                    "50 = 5 # stylemistake",
                    "100 = 10 # Mothblocks",
                    "200 = 15 # optimumtact",
                ].join("\n"),
        )
    })
})
