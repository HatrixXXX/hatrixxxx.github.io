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
    @{ Label = '博客文章'; Repository = '.private-content'; Folder = 'posts' },
    @{ Label = '随笔文章'; Repository = '.private-snippets'; Folder = 'snippets' },
    @{ Label = '计划文章'; Repository = '.private-plans'; Folder = 'plans' }
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

        $status = Git $directory 'status --porcelain=v1 -z --untracked-files=all' $true
        $entries = @([regex]::Split($status, "`0") | Where-Object { $_.Length -gt 0 })
        $markdownPath = '^' + [regex]::Escape($collection.Folder) + '/(?:[^/]+/)*[^/]+\.md$'
        foreach ($entry in $entries) {
            $state = $entry.Substring(0, 2)
            $path = $entry.Substring(3)
            if ($state -notin @(' M', 'M ', 'MM', 'A ', 'AM', '??') -or
                $path -cnotmatch $markdownPath) {
                throw "$($collection.Label)只允许新增或修改 $($collection.Folder)/ 下的 .md 文件：$path"
            }
        }
        if ($entries.Count -eq 0) { continue }

        $remoteHead = Git $directory 'rev-parse --verify refs/remotes/origin/master' $true $true
        if ($null -eq $remoteHead -and $collection.Repository -ne '.private-plans') {
            throw "$($collection.Label)缺少 origin/master，请先手动处理仓库状态"
        }
        if ($null -ne $remoteHead) {
            $head = (Git $directory 'rev-parse HEAD' $true).Trim()
            $upstreamName = (Git $directory 'rev-parse --abbrev-ref @{upstream}' $true).Trim()
            if ($upstreamName -cne 'origin/master' -or $head -cne $remoteHead.Trim()) {
                throw "$($collection.Label)本地 master 与 origin/master 不一致，请先手动处理已有提交"
            }
        }
        $pending += [pscustomobject]@{
            Label = $collection.Label
            Directory = $directory
            Folder = $collection.Folder
            FirstPush = ($null -eq $remoteHead)
        }
    }

    if ($pending.Count -eq 0) {
        Write-Host '博客、随笔和计划均没有待推送的 Markdown 改动'
        exit 0
    }
    foreach ($item in $pending) {
        Write-Host "正在提交并推送$($item.Label)..."
        Git $item.Directory ('add --all -- ' + $item.Folder + '/')
        Git $item.Directory ('-c core.hooksPath=/dev/null commit -m "content: update ' + $item.Folder + '"')
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
