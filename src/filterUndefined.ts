export const filterUndefined = <T>(values: (T | undefined)[]): T[] => {
    return values.filter((value) => value !== undefined) as T[]
}
