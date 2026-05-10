import {promises as fs} from 'fs'

export async function readFile(basePath: string): Promise<string> {
    let handle: fs.FileHandle | null = null
    try {
        handle = await fs.open(basePath, 'r')

        return Promise.resolve(
            await handle.readFile({
                encoding: 'utf-8'
            })
        )
    } catch (e) {
        return Promise.reject(`Error reading file: ${e}`)
    } finally {
        if (handle) {
            await handle.close()
        }
    }
}
