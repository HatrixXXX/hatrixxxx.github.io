# 图像迁移管线

这套脚本扫描 `_posts`、`_draft` 和 `_tabs` 中的 jsDelivr 图床链接。`audit` 只生成报告；`apply` 生成 WebP、改写博客引用并写入 manifest；`prune` 默认生成删除计划，收到明确确认后才删除原图。

## 环境与路径

以下命令使用 Windows PowerShell。先设置两个工作树的绝对路径：

```powershell
$BlogRoot = (Resolve-Path 'E:\CollegeData\hatrixxxx.github.io-image-optimization').Path
$ImageRoot = (Resolve-Path 'E:\CollegeData\Hatrix-s-Blog-Image-optimization').Path
Set-Location $BlogRoot
npm ci
npm run test:images
```

命令参数以当前帮助为准：

```powershell
npm run images -- --help
```

## audit：只读扫描

`audit` 可以在脏工作树中运行。它读取博客引用和图床文件，只写 `--report` 指定的 JSON；不会改写 Markdown、生成图片或删除文件。

```powershell
$AuditReport = Join-Path $BlogRoot 'reports\image-pipeline-audit.json'
npm run images -- audit `
  --blog-root $BlogRoot `
  --image-root $ImageRoot `
  --report $AuditReport
```

检查报告中的缺失源文件、输出路径冲突、引用位置和跳过原因。`audit` 不编码临时图片，报告只列来源字节数和转换资格，不预测输出大小。实际输出大小和节省量由 `apply` 写入 manifest。报告目录已被 Git 忽略，不要把审计报告当作 `tools/image-pipeline/manifest.json` 使用。

## apply：生成文件并迁移引用

`apply` 启动前要求两个工作树都干净。下面的检查只要打印出一行内容，就不要运行 `apply`：

```powershell
$BlogChanges = @(git -C $BlogRoot status --porcelain)
$ImageChanges = @(git -C $ImageRoot status --porcelain)
if ($BlogChanges.Count -ne 0) {
  $BlogChanges
  throw '博客工作树不干净'
}
if ($ImageChanges.Count -ne 0) {
  $ImageChanges
  throw '图床工作树不干净'
}
```

`apply` 会读取现有 manifest，把已采用的完整图和缩略图映射回原图，只转换新增原图。所有既有 adopted outputs 必须通过路径、字节数、格式、尺寸和页数检查。输入没有变化时，重复执行不会改图片、博客文件或 manifest。

```powershell
npm run images -- apply `
  --blog-root $BlogRoot `
  --image-root $ImageRoot
```

`apply` 完成以下写入：

- 完整图写入 `img/optimized/<源文件名（含原扩展名）>.webp`；例如 `img/foo/bar.png` 生成 `img/optimized/bar.png.webp`；
- 发布文章的封面缩略图写入 `img/thumbnails/<源文件名（含原扩展名）>.webp`，尺寸为 640×336；
- 博客引用改为采用的完整图 URL，并在发布封面下增加 `image.thumbnail`；
- 结果写入 `tools/image-pipeline/manifest.json`。

manifest schema v3 用两个字段区分提交：`sourceImageCommit` 是 apply 前读取原图时的图床快照，`publishedImageCommit` 在 apply 后保持 `null`。每个 entry 的 `source` 记录格式、宽高和页数；动画高度是单帧高度。输出提交发布并通过 `stamp` 校验后，`publishedImageCommit` 才会写入完整 SHA。

输出路径只保留源文件名，不保留源目录。脚本会拒绝同名输出冲突。完整图只有在尺寸、动画元数据和文件大小检查通过时才会采用；否则博客继续引用原图，原因记录在 manifest 中。

## 发布顺序与远程检查

先提交并发布图床新增文件，再改动博客。图床提交只能新增 `img/optimized/` 和 `img/thumbnails/`；不要在这个阶段删除原图。

当前迁移使用以下快照：

- `backup/pre-image-optimization-20260901`：`caf983fb140c110416eb3f4042fefd05d1929369`，保存优化前的图床；
- `backup/pre-image-cleanup-20260901`：`e15c25684e1f90a634b33a18f64857d2792317a0`，保存更早的清理前状态。

从远端核对备份分支，不依赖本地 remote-tracking 分支：

```powershell
git -C $ImageRoot ls-remote --heads origin `
  refs/heads/backup/pre-image-optimization-20260901 `
  refs/heads/backup/pre-image-cleanup-20260901
```

图床新增提交发布后，从远端默认分支读取完整 SHA，再执行 stamp。stamp 会逐个检查 adopted output 的路径、字节数和 Git blob；校验未全部通过时不会改 manifest。

```powershell
$PublishedImageCommit = ((git -C $ImageRoot ls-remote origin refs/heads/master) -split '\s+')[0]
if ($PublishedImageCommit -notmatch '^[0-9a-f]{40}$') {
  throw '无法读取图床远端 master 的完整提交 SHA'
}
npm run images -- stamp `
  --blog-root $BlogRoot `
  --image-root $ImageRoot `
  --image-commit $PublishedImageCommit
```

jsDelivr 的无版本 URL 跟随默认分支，分支缓存可能晚于 GitHub。固定 commit URL 不随分支移动，应先用它确认文件，再检查无版本 URL。不要在无版本 URL 尚未返回新文件时部署博客引用。

下面的 PowerShell 会 GET manifest 中所有已采用输出，并检查状态码、媒体类型和响应字节数。固定 URL 只使用 stamp 写入的 `publishedImageCommit`；字段为空或格式错误时立即停止。

```powershell
Add-Type -AssemblyName System.Net.Http
$ManifestPath = Join-Path $BlogRoot 'tools\image-pipeline\manifest.json'
$PipelineManifest = Get-Content -Raw -Encoding UTF8 $ManifestPath | ConvertFrom-Json
$ImageCommit = [string]$PipelineManifest.publishedImageCommit
if ($ImageCommit -notmatch '^[0-9a-f]{40}$') {
  throw 'manifest.publishedImageCommit 缺失或不是完整 SHA；先运行 stamp'
}
$HttpClient = [System.Net.Http.HttpClient]::new()

try {
  foreach ($ManifestEntry in $PipelineManifest.entries) {
    foreach ($PipelineOutput in @($ManifestEntry.full, $ManifestEntry.thumbnail)) {
      if (-not $PipelineOutput.adopted) { continue }

      $UnversionedUrl = [string]$PipelineOutput.url
      $FixedUrl = $UnversionedUrl.Replace(
        '/Hatrix-s-Blog-Image/',
        "/Hatrix-s-Blog-Image@$ImageCommit/"
      )

      foreach ($ImageUrl in @($UnversionedUrl, $FixedUrl)) {
        $Response = $HttpClient.GetAsync($ImageUrl).GetAwaiter().GetResult()
        $ResponseBytes = $Response.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
        $MediaType = $Response.Content.Headers.ContentType.MediaType
        if (-not $Response.IsSuccessStatusCode) {
          throw "HTTP $([int]$Response.StatusCode): $ImageUrl"
        }
        if ($MediaType -ne 'image/webp') {
          throw "媒体类型错误 $MediaType：$ImageUrl"
        }
        if ($ResponseBytes.LongLength -ne [long]$PipelineOutput.outputBytes) {
          throw "字节数错误 $($ResponseBytes.LongLength)：$ImageUrl"
        }
      }
    }
  }
}
finally {
  $HttpClient.Dispose()
}
```

验证博客时重新运行 `audit`，并检查发布封面都有 `image.thumbnail`、manifest 采用过的源路径已经没有引用、保留的原图仍能访问、所有新路径都存在于已发布的图床提交。

## prune：删除无引用原图

`prune` 要求两个工作树干净，并要求 `--report`。不传 `--confirm-prune` 时只做预检并写 dry-run 报告。预检包括 manifest schema v3、完整的 `publishedImageCommit`、该提交中的全部 adopted outputs，以及每个候选源文件的安全路径和字节数。任一项失败都不会删除文件。

```powershell
$BlogChanges = @(git -C $BlogRoot status --porcelain)
$ImageChanges = @(git -C $ImageRoot status --porcelain)
if ($BlogChanges.Count -ne 0 -or $ImageChanges.Count -ne 0) {
  throw 'prune 要求博客和图床工作树都干净'
}

npm run images -- prune `
  --blog-root $BlogRoot `
  --image-root $ImageRoot `
  --report (Join-Path $BlogRoot 'reports\image-pipeline-prune.json')
```

报告中的 `candidates` 按路径排序，逐项包含 `path` 和 `bytes`，`totalBytes` 是总字节数。dry-run 的 `mode` 为 `dry-run`，`status` 为 `planned`。核对报告并再次取得删除许可后，追加确认参数：

```powershell
npm run images -- prune `
  --blog-root $BlogRoot `
  --image-root $ImageRoot `
  --report (Join-Path $BlogRoot 'reports\image-pipeline-prune.json') `
  --confirm-prune
```

确认模式在完成全部预检后才开始删除。成功报告的 `status` 为 `completed`，`deleted` 列出实际删除路径。提交前检查图床差异，确认没有删除保留项或新输出。

## 回滚

如果尚未运行 `prune`，原图仍在图床。先定位迁移提交，在博客工作树生成 revert 提交；审阅并发布该提交后，博客会重新引用原图。

```powershell
$BlogChanges = @(git -C $BlogRoot status --porcelain)
if ($BlogChanges.Count -ne 0) {
  $BlogChanges
  throw 'revert 前博客工作树必须干净'
}
$BlogMigrationCommit = (git -C $BlogRoot log -1 --format=%H `
  --grep='^perf: migrate blog images to optimized variants$').Trim()
if (-not $BlogMigrationCommit) { throw '找不到博客迁移提交' }
git -C $BlogRoot revert $BlogMigrationCommit
```

如已运行 `prune`，先从优化前备份分支恢复 manifest 批准删除的原图。这个命令只恢复源路径，不覆盖 `img/optimized/` 和 `img/thumbnails/`。

```powershell
$ImageChanges = @(git -C $ImageRoot status --porcelain)
if ($ImageChanges.Count -ne 0) {
  $ImageChanges
  throw '恢复原图前图床工作树必须干净'
}
$BackupRef = 'refs/heads/backup/pre-image-optimization-20260901'
git -C $ImageRoot fetch origin `
  "${BackupRef}:refs/remotes/origin/backup/pre-image-optimization-20260901"
$PipelineManifest = Get-Content -Raw -Encoding UTF8 `
  (Join-Path $BlogRoot 'tools\image-pipeline\manifest.json') | ConvertFrom-Json
$RestorePaths = @(
  $PipelineManifest.entries |
    Where-Object { $_.full.adopted } |
    ForEach-Object { $_.sourcePath }
)
git -C $ImageRoot restore `
  --source origin/backup/pre-image-optimization-20260901 `
  -- $RestorePaths
git -C $ImageRoot diff --stat
```

审阅恢复内容，提交并发布图床恢复提交。确认无版本 jsDelivr URL 可以重新读取原图后，再 revert 并发布博客迁移提交。不要先切回博客引用再恢复原图。
