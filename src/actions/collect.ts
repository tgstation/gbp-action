import {Mediator} from '../mediators/mediator'

export async function collect(mediator: Mediator): Promise<void> {
    const pointDifferences = await mediator.getPointDifferences()
    return mediator.writePointDifferences(pointDifferences)
}
