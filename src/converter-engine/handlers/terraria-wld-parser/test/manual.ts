import { FileReader, FileSaver } from '../src/index'
import { fileLoader } from '../src/platform/node'
import { appendFile } from 'node:fs/promises'

const testFilePath = './test.wld'
const outputFilePath = './output.wld'

async function test() {
  const input = await fileLoader(testFilePath)
  const reader = await new FileReader().loadBuffer(input)
  const world = reader.parse()

  const output = new FileSaver().save(world)
  await appendFile(outputFilePath, Buffer.from(output))
}

test()
