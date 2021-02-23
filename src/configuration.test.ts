import * as configuration from "./configuration"

it("should load the configuration", async () => {
    const config = await configuration.readConfiguration()
    expect(config.points.get("give points")).toBe(10)
    expect(config.points.get("lose points")).toBe(-10)
    expect(config.no_balance_label).toBe("GBP: No balance")
    expect(config.reset_label).toBe("GBP: Reset")
})

it("should work without optional fields", () => {
    const config = configuration.parseConfig(`
	no_balance_label = "GBP: No balance"

	[points]
	`)

    expect(config.no_balance_label).toBe("GBP: No balance")
    expect(config.reset_label).toBeUndefined()
})
