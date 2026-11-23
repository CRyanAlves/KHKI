const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const version = '5.6.3';
const directoryName = 'apache-jmeter-' + version;
const toolsDirectory = path.join(__dirname, 'tools');

function getJmeterHome(environment = process.env) {
  if (environment.JMETER_HOME) return path.resolve(environment.JMETER_HOME);
  const local = path.join(toolsDirectory, directoryName);
  return fs.existsSync(path.join(local, 'bin', 'ApacheJMeter.jar')) ? local : path.join(os.homedir(), 'tools', directoryName);
}

module.exports = { version, directoryName, toolsDirectory, getJmeterHome };