import { Mediator } from "../mediators/mediator"

export async function collect(mediator: Mediator) {
    const pointDifferences = await mediator.getPointDifferences()
    return mediator.writePointDifferences(pointDifferences)
}
