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

describe("getPointsFromLabels", () => {
    const configuration = {
        no_balance_label: "none",
        points: new Map([
            ["+5", 5],
            ["+3", 3],
            ["-1", -1],
            ["-3", -3],
            ["-5", -5],
        ]),
    }

    describe("high_vs_low", () => {
        it("should compare the highest label to the lowest label", () => {
            expect(
                points.getPointsFromLabels(
                    {
                        ...configuration,
                        collection_method: "high_vs_low",
                    },
                    ["+5", "+3", "-1", "doesn't exist", "doesn't exist", "-3"],
                ),
            ).toBe(2)
        })

        it("should work with one label", () => {
            expect(
                points.getPointsFromLabels(
                    {
                        ...configuration,
                        collection_method: "high_vs_low",
                    },
                    ["+5"],
                ),
            ).toBe(5)

            expect(
                points.getPointsFromLabels(
                    {
                        ...configuration,
                        collection_method: "high_vs_low",
                    },
                    ["-5"],
                ),
            ).toBe(-5)

            expect(
                points.getPointsFromLabels(
                    {
                        ...configuration,
                        collection_method: "high_vs_low",
                    },
                    ["+5", "doesn't exist"],
                ),
            ).toBe(5)
        })

        it("should work with only values of one parity", () => {
            expect(
                points.getPointsFromLabels(
                    {
                        ...configuration,
                        collection_method: "high_vs_low",
                    },
                    ["+5", "+3"],
                ),
            ).toBe(5)

            expect(
                points.getPointsFromLabels(
                    {
                        ...configuration,
                        collection_method: "high_vs_low",
                    },
                    ["-5", "-3"],
                ),
            ).toBe(-5)
        })

        it("should work with no known labels", () => {
            expect(
                points.getPointsFromLabels(
                    {
                        ...configuration,
                        collection_method: "high_vs_low",
                    },
                    ["doesn't exist", "this one doesn't either"],
                ),
            ).toBe(0)
        })
    })

    test("sum", () => {
        expect(
            points.getPointsFromLabels(
                {
                    ...configuration,
                    collection_method: "sum",
                },
                ["+5", "+3", "-1", "doesn't exist", "-5"],
            ),
        ).toBe(2)
    })

    it("should recognize no_balance_label", () => {
        expect(
            points.getPointsFromLabels(configuration, [
                "+5",
                "+3",
                "-1",
                "none",
                "-5",
            ]),
        ).toBe(0)
    })
})
