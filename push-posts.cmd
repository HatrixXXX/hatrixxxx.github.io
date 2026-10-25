@echo off
setlocal
set "PUBLISH_POSTS_FILE=%~f0"
powershell.exe -NoProfile -Command "$s=[IO.File]::ReadAllText($env:PUBLISH_POSTS_FILE,[Text.Encoding]::UTF8); $mark='# POWERSHELL START'; $i=$s.LastIndexOf($mark); if($i -lt 0){throw 'Embedded script missing'}; Invoke-Expression $s.Substring($i+$mark.Length)"
set "publish_exit_code=%ERRORLEVEL%"
echo.
pause
exit /b %publish_exit_code%
# POWERSHELL START
$siteDir = Split-Path -Parent $env:PUBLISH_POSTS_FILE
$collections = @(
    @{ Label = '博客文章'; Repository = '.private-blogs'; Folder = 'posts' },
    @{ Label = '随笔文章'; Repository = '.private-snippets'; Folder = 'snippets' },
    @{ Label = '秘境文章'; Repository = '.private-sanctuary'; Folder = 'sanctuary' }
)

function Git([string]$directory, [string]$arguments, [bool]$capture = $false, [bool]$allowFailure = $false) {
    $info = [Diagnostics.ProcessStartInfo]::new()
    $info.FileName = 'git'
    $info.WorkingDirectory = $directory
    $info.Arguments = $arguments
    $info.UseShellExecute = $false
    $info.RedirectStandardOutput = $capture
    $info.RedirectStandardError = $allowFailure
    if ($capture) { $info.StandardOutputEncoding = [Text.Encoding]::UTF8 }
    $process = [Diagnostics.Process]::Start($info)
    $output = if ($capture) { $process.StandardOutput.ReadToEnd() } else { '' }
    if ($allowFailure) { $null = $process.StandardError.ReadToEnd() }
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) {
        if ($allowFailure) { return $null }
        throw "git $arguments 失败：$directory"
    }
    return $output
}

try {
    $pending = @()
    foreach ($collection in $collections) {
        $directory = Join-Path $siteDir $collection.Repository
        if (-not (Test-Path -LiteralPath (Join-Path $directory '.git'))) {
            throw "缺少私有仓库：$directory"
        }
        if ((Git $directory 'branch --show-current' $true).Trim() -cne 'master') {
            throw "$($collection.Label)私有仓库必须位于 master 分支"
        }

        $status = Git $directory 'status --porcelain=v1 -z --untracked-files=all --no-renames' $true
        $entries = @([regex]::Split($status, "`0") | Where-Object { $_.Length -gt 0 })
        foreach ($entry in $entries) {
            $state = $entry.Substring(0, 2)
            if ($state -in @('DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU')) {
                throw "$($collection.Label)存在尚未解决的合并冲突：$($entry.Substring(3))"
            }
        }
        $hasWorkingChanges = $entries.Count -gt 0

        $remoteHead = Git $directory 'rev-parse --verify refs/remotes/origin/master' $true $true
        if ($null -eq $remoteHead -and $collection.Repository -ne '.private-sanctuary') {
            if (-not $hasWorkingChanges) { continue }
            throw "$($collection.Label)缺少 origin/master，请先手动处理仓库状态"
        }
        $hasCommittedChanges = $null -eq $remoteHead
        if ($null -ne $remoteHead) {
            $head = (Git $directory 'rev-parse HEAD' $true).Trim()
            $remoteCommit = $remoteHead.Trim()
            $upstreamName = (Git $directory 'rev-parse --abbrev-ref @{upstream}' $true).Trim()
            if ($upstreamName -cne 'origin/master') {
                throw "$($collection.Label)本地 master 与 origin/master 不一致，请先手动处理已有提交"
            }
            $hasCommittedChanges = $head -cne $remoteCommit
            if ($hasCommittedChanges) {
                $base = (Git $directory ('merge-base ' + $remoteCommit + ' ' + $head) $true).Trim()
                if ($base -cne $remoteCommit) {
                    throw "$($collection.Label)本地 master 与 origin/master 不一致，请先手动处理已有提交"
                }
            }
        }
        if (-not $hasWorkingChanges -and -not $hasCommittedChanges) { continue }
        $pending += [pscustomobject]@{
            Label = $collection.Label
            Directory = $directory
            Folder = $collection.Folder
            FirstPush = ($null -eq $remoteHead)
            HasWorkingChanges = $hasWorkingChanges
        }
    }

    if ($pending.Count -eq 0) {
        Write-Host '三个私有仓库均没有待推送的改动'
        exit 0
    }
    foreach ($item in $pending) {
        Write-Host "正在提交并推送$($item.Label)..."
        if ($item.HasWorkingChanges) {
            Git $item.Directory 'add --all'
            Git $item.Directory '-c core.hooksPath=/dev/null commit -m "chore: update private repository"'
        }
        if ($item.FirstPush) {
            Git $item.Directory 'push -u origin master'
        } else {
            Git $item.Directory 'push origin master'
        }
    }
} catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}
