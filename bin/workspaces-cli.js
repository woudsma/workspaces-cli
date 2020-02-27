#!/usr/bin/env node

const os = require('os')
const { existsSync, readFileSync, appendFileSync } = require('fs')
const { execSync } = require('child_process')
const { Input, Select } = require('enquirer')
const readdir = require('@jsdevtools/readdir-enhanced')

const rcfile = `${os.homedir()}/.workspacesrc`
const ext = '.code-workspace'

const main = async () => {
  if (process.argv.includes("-h") || process.argv.includes("--help")) {
    console.log(`
    Usage:
      $ ws [-h|--help]

    Configuration
      Multiple root directories can be specified by adding them to WORKSPACES_ROOT_DIR in ~/.workspacesrc, seperated by comma.
      Example:
      # in ~/.workspacesrc
      WORKSPACES_ROOT_DIR=/Users/woudsma/Projects,/Users/woudsma/Company/clients

      The default search depth can be changed by adding READDIR_DEPTH=<depth> to ~/.workspacesrc.
      Example:
      # Recommended READDIR_DEPTH=1 (default)
      echo READDIR_DEPTH=2 >> ~/.workspacesrc
    `);
    process.exit(0)
  }

  const config = await new Promise((resolve, reject) => {
    if (existsSync(rcfile)) {
      resolve(readFileSync(rcfile).toString());
    } else {
      console.log(`No configuration found in ${rcfile}\nCreating ${rcfile}`);

      const inputPrompt = new Input({
        message: `Enter workspaces root directory, e.g. ~/Projects`,
        default: "~/"
      });

      inputPrompt
        .run()
        .then(input => {
          const workspacesRootDir = input.replace("~/", `${os.homedir()}/`);
          appendFileSync(rcfile, `WORKSPACES_ROOT_DIR=${workspacesRootDir}`);
          resolve(readFileSync(rcfile).toString());
        })
        .catch(err => reject(err));
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

  const choices = [].concat(...WORKSPACES_ROOT_DIR
    .split(',')
    .filter(Boolean)
    .map(dir => readdir
      .sync(dir, { deep: parseFloat(READDIR_DEPTH) })
      .filter(filepath => filepath.includes(ext))
      .map(workspacePath => ({
        workspace: `${workspacePath.replace(ext, '')}`,
        path: `${dir}/${workspacePath}`,
      }))))

  const selectPrompt = new Select({
    message: 'Select workspace',
    choices: choices.map(({ workspace }) => workspace)
  })

  selectPrompt.run()
    .then(choice => choices
      .find(({ workspace, path }) => choice === workspace
        && execSync(`code ${path}`)))
    .catch(console.error)
}

process.on('uncaughtException', err => {
  console.error(err)
  process.exit(1)
})

main()
