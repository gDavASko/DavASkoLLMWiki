$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
node "$PSScriptRoot/lint-wiki.js"
exit $LASTEXITCODE
