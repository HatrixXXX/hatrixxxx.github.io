@echo off
setlocal
chcp 65001 >nul
set "PULL_PRIVATE_REPOS_FILE=%~f0"
powershell.exe -NoProfile -Command "$s=[IO.File]::ReadAllText($env:PULL_PRIVATE_REPOS_FILE,[Text.Encoding]::UTF8); $mark='# POWERSHELL START'; $i=$s.LastIndexOf($mark); if($i -lt 0){throw 'Embedded script missing'}; Invoke-Expression $s.Substring($i+$mark.Length)"
set "pull_exit_code=%ERRORLEVEL%"
echo.
pause
exit /b %pull_exit_code%
# POWERSHELL START
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$siteDir = Split-Path -Parent $env:PULL_PRIVATE_REPOS_FILE
$repositories = @(
    @{ Label = '博客文章'; Folder = '.private-content' },
    @{ Label = '随笔文章'; Folder = '.private-snippets' },
    @{ Label = '计划文章'; Folder = '.private-plans' }
)

$updated = 0
$unchanged = 0
$localAhead = 0
$failed = 0

foreach ($repository in $repositories) {
    $directory = Join-Path $siteDir $repository.Folder
    Write-Host "正在检查$($repository.Label)..."

    try {
        if (-not (Test-Path -LiteralPath (Join-Path $directory '.git'))) {
            throw "缺少仓库：$directory"
        }

        [string]$branch = & git -C $directory branch --show-current
        if ($LASTEXITCODE -ne 0 -or $branch.Trim() -cne 'master') {
            throw '当前分支不是 master，请手动检查'
        }

        [string]$upstream = & git -C $directory rev-parse --abbrev-ref '@{upstream}' 2>$null
        if ($LASTEXITCODE -ne 0 -or $upstream.Trim() -cne 'origin/master') {
            throw '本地 master 未跟踪 origin/master，请手动检查'
        }

        $changes = @(& git -C $directory status --porcelain=v1 --untracked-files=all)
        if ($LASTEXITCODE -ne 0) { throw '无法读取工作区状态' }
        if ($changes.Count -gt 0) {
            throw '存在未提交或未跟踪的文件，已跳过以保留本地改动'
        }

        & git -C $directory fetch --no-tags origin master
        if ($LASTEXITCODE -ne 0) { throw '从 origin 获取更新失败' }

        $counts = ((& git -C $directory rev-list --left-right --count 'HEAD...origin/master') -join ' ').Trim() -split '\s+'
        if ($LASTEXITCODE -ne 0 -or $counts.Count -ne 2) { throw '无法比较本地与远端提交' }
        $ahead = [int]$counts[0]
        $behind = [int]$counts[1]

        if ($ahead -gt 0 -and $behind -gt 0) {
            throw '本地与远端提交已分叉，未自动合并'
        }
        if ($behind -gt 0) {
            & git -C $directory merge --ff-only origin/master
            if ($LASTEXITCODE -ne 0) { throw '无法快进到 origin/master' }
            Write-Host "已更新$($repository.Label)：拉取 $behind 个提交"
            $updated++
        } elseif ($ahead -gt 0) {
            Write-Host "$($repository.Label)没有远端更新；本地另有 $ahead 个未推送提交"
            $localAhead++
        } else {
            Write-Host "$($repository.Label)已是最新"
            $unchanged++
        }
    } catch {
        Write-Warning "$($repository.Label)：$($_.Exception.Message)"
        $failed++
    }
}

Write-Host "完成：更新 $updated 个，已是最新 $unchanged 个，本地超前 $localAhead 个，跳过或失败 $failed 个。"
if ($failed -gt 0) { exit 1 }
exit 0
