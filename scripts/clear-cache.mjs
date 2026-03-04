import { rmSync, existsSync } from 'fs'
import { join } from 'path'

const nextDir = join(process.cwd(), '.next')
if (existsSync(nextDir)) {
  rmSync(nextDir, { recursive: true, force: true })
  console.log('Cleared .next cache directory')
} else {
  console.log('.next directory does not exist')
}
