import * as points from "./points"

describe("readBalanceOf", () => {
    it("should be able to read points from branches that don't exist", async () => {
        expect(
            await points.readBalanceOf("this-branch-will-never-exist", 100),
        ).toBe(undefined)
    })
})
