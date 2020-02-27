#!/usr/bin/env node

const os = require('os')
const { existsSync, readFileSync, appendFileSync } = require('fs')
const { execSync } = require('child_process')
const { Input, Select } = require('enquirer')
const readdir = require('@jsdevtools/readdir-enhanced')

const rcfile = `${os.homedir()}/.workspacesrc`
const ext = '.code-workspace'

const main = async () => {
  const config = await new Promise((resolve, reject) => {
    if (existsSync(rcfile)) {
      resolve(readFileSync(rcfile).toString())
    } else {
      console.log(`No configuration found in ${rcfile}\nCreating ${rcfile}`)

      const inputPrompt = new Input({
        message: `Enter workspaces root directory, e.g. ~/Projects`,
        default: '~/',
      })

      inputPrompt.run()
        .then(input => {
          const workspacesRootDir = input.replace('~/', `${os.homedir()}/`)
          appendFileSync(rcfile, `WORKSPACES_ROOT_DIR=${workspacesRootDir}`)
          resolve(readFileSync(rcfile).toString())
        })
        .catch(err => reject(err))
    }
  })

  const {
    WORKSPACES_ROOT_DIR = os.homedir(),
    READDIR_DEPTH = 1,
  } = config
    .split('\n')
    .map(e => e.split('='))
    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})

  console.log('Workspaces root directory:', WORKSPACES_ROOT_DIR)

  const prompt = new Select({
    message: 'Select workspace',
    choices: readdir
      .sync(WORKSPACES_ROOT_DIR, { deep: READDIR_DEPTH })
      .filter(filepath => filepath.includes(ext))
      .map(workspacePath => workspacePath.replace(ext, '')),
  })

  prompt.run()
    .then(workspace => execSync(`code ${WORKSPACES_ROOT_DIR}/${workspace}${ext}`))
    .catch(console.error)
}

process.on('uncaughtException', err => {
  console.error(err)
  process.exit(1)
})

main()
