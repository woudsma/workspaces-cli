#!/usr/bin/env node

const os = require('os')
const { existsSync, readFileSync, appendFileSync } = require('fs')
const { execSync, spawnSync } = require('child_process')
const { Input, Select } = require('enquirer')
const readdir = require('@jsdevtools/readdir-enhanced')

const FLAG_HELP = process.argv.includes('-h') || process.argv.includes('--help')
const rcfile = `${os.homedir()}/.workspacesrc`
const ext = '.code-workspace'

const main = async () => {
  if (FLAG_HELP) {
    console.log(`
    Usage:
      $ ws [-h|--help]

    Configuration
      Multiple root directories can be specified by adding them to WORKSPACES_ROOT_DIR in ~/.workspacesrc, seperated by comma.
      Example:
      # In ~/.workspacesrc
      WORKSPACES_ROOT_DIR=/Users/woudsma/Projects,/Users/woudsma/Company/clients

      Turn off the subshell when selecting a workspace
      # USE_SUBSHELL=true (default)
      echo USE_SUBSHELL=false >> ~/.workspacesrc

      The default search depth can be changed by adding READDIR_DEPTH=<depth> to ~/.workspacesrc.
      Example:
      # READDIR_DEPTH=1 (default)
      echo READDIR_DEPTH=2 >> ~/.workspacesrc
    `)
    process.exit(0)
  }

  const config = await new Promise((resolve, reject) => {
    if (existsSync(rcfile)) {
      resolve(readFileSync(rcfile).toString())
    } else {
      console.log(`No configuration found in ${rcfile}\nCreating ${rcfile}`)

      const inputPrompt = new Input({
        message: `Enter workspaces root directory, e.g. ~/Projects`,
        default: '~/'
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
    USE_SUBSHELL = true,
    READDIR_DEPTH = 1,
  } = config
    .split('\n')
    .map(e => e.split('='))
    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})

  console.log('Workspaces root directory:', WORKSPACES_ROOT_DIR)

  const choices = [].concat(...WORKSPACES_ROOT_DIR
    .split(',')
    .filter(Boolean)
    .map(dir => readdir
      .sync(dir, { deep: Number(READDIR_DEPTH) })
      .filter(filepath => filepath.includes(ext))
      .map(workspacePath => ({
        workspace: `[${dir.split('/').pop()}] ${workspacePath.replace(ext, '')}`,
        path: `${dir}/${workspacePath}`,
        cwd: `${dir}/${workspacePath.split('/').slice(0, -1).join('/')}`
      }))))

  const selectPrompt = new Select({
    message: 'Select workspace',
    choices: choices.map(({ workspace }) => workspace),
  })

  selectPrompt.run()
    .then(choice => choices
      .find(({ workspace, path, cwd }) => choice === workspace
        && execSync(`code ${path}`)
        && JSON.parse(USE_SUBSHELL)
        && (console.log('Entering workspace directory in a subshell'), true)
        && (console.log(cwd), true)
        && (console.log(`Enter 'exit' to exit subshell`), true)
        && spawnSync(process.env.SHELL, ['-i'], {
          cwd,
          env: process.env,
          stdio: 'inherit',
        })))
    .catch(console.error)
}

process.on('uncaughtException', err => {
  console.error(err)
  process.exit(1)
})

main()
