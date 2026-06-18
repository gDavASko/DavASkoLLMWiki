param()

$ErrorActionPreference = "Stop"

$ScriptDir  = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$RulesDir   = Join-Path $ScriptDir "Assets\DavASko\davasko-ai-docs\llm-wiki\raw\ide-rules"

if (-not (Test-Path $RulesDir)) {
    Write-Error "ide-rules directory not found: $RulesDir`nRun: git submodule update --init --recursive"
    exit 1
}

$utf8Bom = New-Object System.Text.UTF8Encoding($true)

# Function to copy file ensuring UTF-8 with BOM
function Copy-TextFileUtf8Bom {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Source,

        [Parameter(Mandatory = $true)]
        [string] $Destination
    )

    if (-not (Test-Path -LiteralPath $Source)) {
        return
    }

    $destinationDir = Split-Path -Parent $Destination
    if (-not [string]::IsNullOrWhiteSpace($destinationDir)) {
        if (-not (Test-Path $destinationDir)) {
            New-Item -ItemType Directory -Force -Path $destinationDir | Out-Null
        }
    }

    $content = [System.IO.File]::ReadAllText($Source)
    [System.IO.File]::WriteAllText($Destination, $content, $utf8Bom)
}

# Function to recursively copy folders ensuring all txt/md/json files are UTF-8 with BOM (excluding .meta files)
function Copy-DirectoryUtf8Bom {
    param(
        [Parameter(Mandatory = $true)]
        [string] $SourceDir,

        [Parameter(Mandatory = $true)]
        [string] $DestDir
    )

    if (-not (Test-Path -LiteralPath $SourceDir)) { return }

    if (-not (Test-Path $DestDir)) {
        New-Item -ItemType Directory -Force -Path $DestDir | Out-Null
    }

    # Copy files
    Get-ChildItem -LiteralPath $SourceDir -File | ForEach-Object {
        if ($_.Extension -eq ".meta") { return }
        $srcFile = $_.FullName
        $dstFile = Join-Path $DestDir $_.Name
        if ($_.Extension -in @(".md", ".txt", ".json", ".ps1", ".mdc", ".yml", ".yaml")) {
            Copy-TextFileUtf8Bom -Source $srcFile -Destination $dstFile
        } else {
            Copy-Item -Path $srcFile -Destination $dstFile -Force
        }
    }

    # Recurse subdirectories
    Get-ChildItem -LiteralPath $SourceDir -Directory | ForEach-Object {
        $srcSub = $_.FullName
        $dstSub = Join-Path $DestDir $_.Name
        Copy-DirectoryUtf8Bom -SourceDir $srcSub -DestDir $dstSub
    }
}

Write-Host ""
Write-Host "=== sync-ai-rules ===" -ForegroundColor Cyan
Write-Host "Source rules dir: $RulesDir" -ForegroundColor DarkGray
Write-Host "Source skills dir: $SkillsDir" -ForegroundColor DarkGray
Write-Host ""

# 1. Synchronize main rules
$Targets = @(
    # IDE rules
    [PSCustomObject]@{ Src = ".cursorrules";            Dst = ".cursorrules"                    },
    [PSCustomObject]@{ Src = "GEMINI.md";               Dst = "GEMINI.md"                       },
    [PSCustomObject]@{ Src = ".windsurfrules";          Dst = ".windsurfrules"                  },
    [PSCustomObject]@{ Src = ".clinerules";             Dst = ".clinerules"                     },
    [PSCustomObject]@{ Src = "copilot-instructions.md"; Dst = ".github\copilot-instructions.md" },
    [PSCustomObject]@{ Src = "AGENTS.md";               Dst = "AGENTS.md"                       },
    [PSCustomObject]@{ Src = "CLAUDE.md";               Dst = "CLAUDE.md"                       }
)

foreach ($T in $Targets) {
    $SrcPath = Join-Path $RulesDir $T.Src
    $DstPath = Join-Path $ScriptDir $T.Dst

    if (-not (Test-Path $SrcPath)) {
        Write-Host "  [SKIP] $($T.Src) - not found in submodule" -ForegroundColor Yellow
        continue
    }

    Copy-TextFileUtf8Bom -Source $SrcPath -Destination $DstPath
    Write-Host "  [OK] $($T.Src)  ->  $($T.Dst)" -ForegroundColor Green
}

# 2. Synchronize Claude Commands (from llm-wiki/raw/claude-commands/ to .claude/commands/)
$ClaudeCmdsSource = Join-Path $ScriptDir "Assets\DavASko\davasko-ai-docs\llm-wiki\raw\claude-commands"
$ClaudeCmdsDest = Join-Path $ScriptDir ".claude\commands"
if (Test-Path $ClaudeCmdsSource) {
    if (-not (Test-Path $ClaudeCmdsDest)) {
        New-Item -ItemType Directory -Force -Path $ClaudeCmdsDest | Out-Null
    }
    Get-ChildItem -LiteralPath $ClaudeCmdsSource -Filter "*.md" | ForEach-Object {
        $srcFile = $_.FullName
        $dstFile = Join-Path $ClaudeCmdsDest $_.Name
        Copy-TextFileUtf8Bom -Source $srcFile -Destination $dstFile
        Write-Host "  [OK] claude-command: $($_.Name)  ->  .claude\commands\$($_.Name)" -ForegroundColor Green
    }
}

# 3. Synchronize Skills from all layers (llm-wiki, unity-wiki, davasko-wiki)
$SkillsDirs = @(
    (Join-Path $ScriptDir "Assets\DavASko\davasko-ai-docs\llm-wiki\raw\ai-skills~"),
    (Join-Path $ScriptDir "Assets\DavASko\davasko-ai-docs\unity-wiki\raw\ai-skills~"),
    (Join-Path $ScriptDir "Assets\DavASko\davasko-ai-docs\davasko-wiki\raw\ai-skills~")
)

$AllSkillDirs = @()
foreach ($SDir in $SkillsDirs) {
    if (Test-Path $SDir) {
        $AllSkillDirs += Get-ChildItem -LiteralPath $SDir -Directory
    }
}

$ActiveSkillNames = $AllSkillDirs | ForEach-Object { $_.Name }

Write-Host ""
Write-Host "Active skills list: $($ActiveSkillNames -join ', ')" -ForegroundColor DarkGray
Write-Host "Synchronizing $($AllSkillDirs.Count) skills..." -ForegroundColor Cyan

# Cleanup obsolete skills in target directories to avoid orphans
$SkillDestFolders = @(".agents\skills", ".codex\skills", ".claude\skills", ".gemini\skills")
foreach ($Folder in $SkillDestFolders) {
    $TargetFolder = Join-Path $ScriptDir $Folder
    if (Test-Path $TargetFolder) {
        Get-ChildItem -LiteralPath $TargetFolder -Directory | ForEach-Object {
            if ($_.Name -notin $ActiveSkillNames) {
                Remove-Item -Path $_.FullName -Recurse -Force
                Write-Host "  [CLEAN] Removed obsolete skill folder: $Folder\$($_.Name)" -ForegroundColor Yellow
            }
        }
    }
}

# Cleanup obsolete single rule files
$SingleFileRuleDestinations = @(
    [PSCustomObject]@{ Dir = ".claude\commands";                 Ext = ".md"           },
    [PSCustomObject]@{ Dir = ".cursor\rules";                  Ext = ".mdc"          },
    [PSCustomObject]@{ Dir = ".windsurf\rules";                 Ext = ".md"           },
    [PSCustomObject]@{ Dir = ".cline\rules";                    Ext = ".md"           },
    [PSCustomObject]@{ Dir = ".roo\rules";                      Ext = ".md"           },
    [PSCustomObject]@{ Dir = ".github\instructions";             Ext = ".instructions.md" }
)

$ClaudeCmdNames = @()
if (Test-Path $ClaudeCmdsSource) {
    $ClaudeCmdNames = Get-ChildItem -LiteralPath $ClaudeCmdsSource -Filter "*.md" | ForEach-Object { $_.BaseName }
}

foreach ($FD in $SingleFileRuleDestinations) {
    $TargetDir = Join-Path $ScriptDir $FD.Dir
    if (Test-Path $TargetDir) {
        Get-ChildItem -LiteralPath $TargetDir -File | ForEach-Object {
            $BaseName = $_.BaseName
            if ($FD.Ext -eq ".instructions.md") {
                if ($_.Name -like "*.instructions.md") {
                    $BaseName = $_.Name -replace "\.instructions\.md$", ""
                } else {
                    return
                }
            }
            # Avoid deleting Claude command playbooks
            if ($FD.Dir -eq ".claude\commands") {
                if ($BaseName -in $ClaudeCmdNames) {
                    return
                }
            }
            # Only clean up files that represent skills (we identify them if they have matching extensions and are not in active list)
            if ($_.Extension -eq $FD.Ext -or ($FD.Ext -eq ".instructions.md" -and $_.Name -like "*.instructions.md")) {
                if ($BaseName -notin $ActiveSkillNames) {
                    Remove-Item -Path $_.FullName -Force
                    Write-Host "  [CLEAN] Removed obsolete rule file: $($FD.Dir)\$($_.Name)" -ForegroundColor Yellow
                }
            }
        }
    }
}

# Sync all active skills
foreach ($SD in $AllSkillDirs) {
    $SkillName = $SD.Name
    $SkillMdPath = Join-Path $SD.FullName "SKILL.md"

    if (-not (Test-Path $SkillMdPath)) {
        continue
    }

    # Directories destinations (recursive copy)
    $DirDestinations = @(
        (Join-Path $ScriptDir ".agents\skills\$SkillName")
        (Join-Path $ScriptDir ".codex\skills\$SkillName")
        (Join-Path $ScriptDir ".claude\skills\$SkillName")
        (Join-Path $ScriptDir ".gemini\skills\$SkillName")
    )

    foreach ($Dest in $DirDestinations) {
        Copy-DirectoryUtf8Bom -SourceDir $SD.FullName -DestDir $Dest
    }

    # Single file destinations (copy SKILL.md with target extension)
    $FileDestinations = @(
        [PSCustomObject]@{ Path = (Join-Path $ScriptDir ".claude\commands\$SkillName.md");                 Ext = ".md"           }
        [PSCustomObject]@{ Path = (Join-Path $ScriptDir ".cursor\rules\$SkillName.mdc");                  Ext = ".mdc"          }
        [PSCustomObject]@{ Path = (Join-Path $ScriptDir ".windsurf\rules\$SkillName.md");                 Ext = ".md"           }
        [PSCustomObject]@{ Path = (Join-Path $ScriptDir ".cline\rules\$SkillName.md");                    Ext = ".md"           }
        [PSCustomObject]@{ Path = (Join-Path $ScriptDir ".roo\rules\$SkillName.md");                      Ext = ".md"           }
        [PSCustomObject]@{ Path = (Join-Path $ScriptDir ".github\instructions\$SkillName.instructions.md"); Ext = ".instructions.md" }
    )

    foreach ($FD in $FileDestinations) {
        Copy-TextFileUtf8Bom -Source $SkillMdPath -Destination $FD.Path
    }

    Write-Host "  [OK] Skill '$SkillName' synced." -ForegroundColor DarkGreen
}

Write-Host ""
Write-Host "Done! All files and skills synced." -ForegroundColor Cyan
Write-Host ""
