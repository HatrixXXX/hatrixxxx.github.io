---
title: git和github相关记录
description: <摘要>
math: true
mermaid: true
image:
  path: https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/img/Snipaste_2026-07-12_14-27-47.png
---

持续记录 git 和 github 使用过程中，之前没有注意过的点。

## 初始化配置

初始化配置包括，下载 git、注册 github、配置 user 信息和代理，配置之后的信息会保存在.gitconfig 文件中。

配置命令：

```
git config --global user.name "your_name"
git config --global user.email "your_email"
git config --global http.proxy http://127.0.0.1:7890
git config --global https.proxy http://127.0.0.1:7890
```

127.0.0.1:7890 是 Clash 在本机开放的代理入口，不是 GitHub 的地址，也不是远程代理节点的地址。这个代理配置的意思是，告诉 Git 访问 HTTP/HTTPS 远程仓库时，把网络请求先交给本机 Clash。如果设置代理后关闭 Clash，Git 仍会尝试连接 127.0.0.1:7890，这时由于 Git 已经被固定配置为必须经过这个本地代理，往往直接失败。SSH 使用另一套网络程序和协议，和这个配置无关。

## HTTPS 和 SSH

这俩是访问远程仓库时的两种网络通讯协议，不影响 Git 功能，区别只是连接及认证方式。 个人长期使用通常可以选择 SSH；临时环境、服务器受限网络或希望少配置时，HTTPS 更方便。已有仓库也可以用命令 `git remote set-url origin <your_address>` 随时切换，仓库的连接方式（HTTPS 或 SSH）保存在每个本地仓库的远程地址配置中。

| 对比项       | HTTPS                            | SSH                           |
| ------------ | -------------------------------- | ----------------------------- |
| 地址格式     | https://github.com/user/repo.git | git@github.com: user/repo.git |
| 加密方式     | HTTPS/TLS 加密                   | SSH 加密                      |
| 克隆公开仓库 | 通常无需登录                     | 本机需配置 SSH key            |
| 访问私有仓库 | Token、凭据管理器或网页登录授权  | SSH key                       |
| 日常推送     | 需要凭据管理器保存认证           | 配好 key 后无需重复认证       |

执行 `git push` 命令时，大致会经过：根据远程地址选择 SSH 或 HTTPS→ 自动取得 SSH 私钥或 HTTPS Token→ 远程平台根据凭据识别账户 → 检查该账户是否有仓库写权限 → 有权限的情况下完成项远程仓库的推送。

HTTPS 在第一次推送的网页登录完成后，通常会由 Git Credential Manager、系统钥匙串或其它凭据助手保存 Token。SSH 需要在本机生成 SSH 密钥对，私钥留在本机，公钥添加到 GitHub、GitLab 或公司的 Git 服务器。SSH key 的管理，通常是一台机器一个，添加到 GitHub/GitLab 账户后，本台机器即可访问这个账户有权限的所有仓库。

一台机器可以有多个账户以及多个 key，因此在访问远程仓库遇到权限问题时，需要确认远程仓库识别到了本地的哪个账户；HTTPS 的凭据同理，也需要确认凭据管理器当前缓存的是哪一个账户。仓库“有权限”只代表某个远程账户有权限；推送时远程服务器还要确认：你当前到底以哪个账户、哪把 SSH key 或哪份 HTTPS 凭据登录。

SSH 认证主要有两个方向，SSH 私钥用于向服务器证明“我是谁”，known_hosts 保存的是本机曾经连接过的 SSH 服务器的身份信息，用来确认“对面的服务器是谁”，里面会写入 Github 的主机公钥。以后再次连接时，SSH 会对比服务器发来的公钥是否与 known_hosts 中保存的一致，不一致时会发出安全警告，这是为了防止中间人攻击，比如有人伪装成 GitHub 截获你的连接。

## git 工作流示意

![](https://cdn.jsdelivr.net/gh/HatrixXXX/Hatrix-s-Blog-Image/img/Git-Reference_Sheet.svg)

这张图是 Git 最经典的一张工作流示意图，它描述了代码从你修改到提交到远程仓库的整个生命周期，以及几个最常用命令分别作用在哪一步。

## 远程仓库名

执行 `git clone` 时，Git 通常自动把源仓库命名为 origin。远程仓库名只是当前本地仓库里的别名，不会改变服务器上的仓库名称。同一个本地仓库中的远程名称不能重复。除非有多个远程仓库，否则沿用 origin 最省事，因为部分脚本和文档默认使用这个名字。

一个本地 Git 仓库可以配置多个远程仓库，origin 只是克隆时默认创建的第一个远程名称，并不是唯一允许的名字。使用命令 `git remote -v` 可以查看本地仓库配置的所有远程仓库。

## checkout 和 switch

这俩的效果都是，让 HEAD 指向选定的分支或提交，并把暂存区和工作目录切换到该分支对应的版本。checkout 和 switch 操作都是在本地已有的分支和提交之间切换，是纯本地操作；clone、fetch、pull 等操作才涉及从远程获取内容。

对于一个已经存在的 master 分支：`git checkout master` 和 `git switch master` 的效果完全相同，都是让 HEAD 指向 master，并把暂存区和工作目录切换到该分支对应的版本。两者区别在于命令职责，`git switch` 是专用的分支切换命令，而 `git checkout` 除了切换分支外，还可以恢复文件，例如 `git checkout -- file.txt` 的效果是将 file.txt 恢复到暂存区的状态，`git checkout abc123 -- file.txt` 的效果是将 file.txt 恢复到 abc123 这次提交的状态。而现代 Git 专用的恢复文件命令是 `git restore`。另外，`git checkout <提交哈希> ` 会直接进入 detached HEAD；而 `git switch --detach <提交哈希>` 需要明确写 --detach，降低误操作概率。

## 游离头问题

HEAD 可以理解为 Git 的“当前位置指针”，用于指示现在检出的版本在哪里，以及指示新的提交应该添加到哪里。正常情况下创建新提交：提交前：HEAD -> master -> A，提交后：HEAD -> master -> B -> A（Git 提交的箭头是从新提交指向旧提交）。

detached HEAD 即“分离头指针”，表示 HEAD 没有指向某个本地分支，而是直接指向某次提交，这在查看旧版本、运行测试时很常见。detached HEAD 的风险在于，如果在 detached HEAD 状态下创建提交，新提交不属于任何分支；切换走后，再想找到会比较麻烦。因此如果已经在 detached HEAD 状态下做了有用的提交，应先创建分支保存它：

```
git switch -c my-new-branch
```

这行命令的意思是：以当前提交为起点，创建名为 my-new-branch 的本地分支，并立即切换到该分支。

## master 和 origin/master

origin 是远程仓库地址的本地别名，本地 master 是实际开发和提交的本地分支，本地 origin/master 是本地保存的远程 master 状态记录，远程 master 是 GitHub 服务器上真正的 master。origin/master 通常被称为“远程分支”，但更准确地说，它是保存在本地的远程跟踪分支，记录你上次与远程通信时，远程 master 所在的位置，不是服务器上的实时分支。

## commit amend

`git commit` 可以加--amend 参数，表示用当前暂存区和新的提交信息，重新生成最近一次提交，替换原来的提交。

```
git commit --amend # 打开编辑器修改提交信息
git commit --amend -m "正确的提交信息" # 直接指定新信息

git add test.py
git commit --amend --no-edit # 不修改提交信息，用于补充忘记提交的文件
```

另外，amend 只能修订当前 HEAD，修改更早的提交需要交互式 rebase。

## 分支

分支本质上是对提交的一种会自动移动的标签。

```
git branch -v # 查看所有本地分支
git branch -r # 查看所有本地保存的远程跟踪分支
git branch -a # 查看所有本地和本地保存的远程跟踪分支
```

## 标签

tag 是 Git 中的固定标签，不会随着新提交而自动向前移动，通常用来给某个重要提交起一个容易记住的名字。

```
git tag v1.0.0 # 给当前提交创建标签
git tag v1.0.0 abc123 # 给指定提交创建标签
git tag -d v1.0.0 # 删除本地标签
```

创建标签后，默认只存在于本地，如果需要让远程仓库上也存在，同样需要推送。

```
git push origin v1.0.0 # 推送指定标签
git push origin --tags # 推送所有本地标签
git push origin --delete v1.0.0 # 删除远程标签
```

## git log

git log 用于查看 Git 的提交历史，默认会从当前 HEAD 开始，沿着父提交向前查找，通常按从新到旧显示

```
完整提交哈希
作者姓名和邮箱
提交时间
提交信息
```

用 `git log` 命令可以查看当前本地和远程的各个分支分别处于哪个 commit 上，以及当前位于哪个分支，在哪个检出的版本上。注意 origin/master 只是最近一次 fetch/pull 后记录的远程状态，不一定代表服务器此刻的最新状态。常用简洁输出格式，每个提交显示一行：`git log --oneline`。

## git status

git status 用于查看当前 Git 仓库处于什么状态，反映 HEAD（最近提交）、暂存区和工作目录之间的状态差异，并输出以下信息

```
当前在哪个分支，或者是否处于 detached HEAD
本地分支是否领先或落后 upstream
哪些修改已经暂存
哪些修改尚未暂存
哪些文件尚未被 Git 跟踪
是否存在合并冲突
是否正在执行 merge、rebase、cherry-pick 等操作
```

## git diff

`git diff` 用于查看两个状态之间具体有哪些文件内容差异。

```
git diff # 默认查看暂存区与工作目录之间的差异，即已修改但还未暂存的部分
git diff --staged # 查看本地提交与暂存区的差异，即已暂存但还未提交的部分
git diff HEAD # 查看HEAD与工作目录之间的差异，即已修改未提交的所有改动
git diff -- file.txt # 查看某个文件的修改
git diff -- src/ # 查看某个目录的修改
git diff <提交1> <提交2> # 比较两个提交
git diff master feature # 比较两个分支
```

## git reset

git reset 的作用是：把当前分支、暂存区，必要时还有工作目录，重置到指定提交的状态。针对提交来说，作用是移动当前分支的位置；针对文件来说，作用是重置暂存区，常用于取消 git add。

针对提交的 reset 命令格式为 `git reset [模式] <目标提交>`，常见模式有 soft、mixed、hard 三种。假设当前提交历史为：HEAD -> master -> C -> B -> A，执行 `git reset [mode] HEAD~1` 之后（HEAD~1 表示当前提交的上一个提交，也就是 B）的效果分别如下：

- --soft：当前分支移动到目标提交，暂存区保持不变，工作目录保持不变。即 HEAD -> master -> B -> A，提交 C 不再属于 master 的当前历史，但 C 中的修改仍保留在暂存区，可以马上重新提交， 适合提交信息写错、提交内容需要重新组织等情况。
- --mixed（默认模式）：当前分支移动到目标提交，暂存区重置到目标提交，工作目录保持不变。master 回到 B，C 中的修改仍留在工作目录，修改不再位于暂存区，需要重新 git add。
- --hard：当前分支移动到目标提交，暂存区重置到目标提交，工作目录重置到目标提交。master 回到 B，暂存区恢复为 B，工作目录中的已跟踪文件恢复为 B，C 中的修改以及其他未提交的已跟踪文件修改都会被丢弃。

针对文件的 reset 命令格式为 `git reset -- file.txt`，这种写法不会移动分支，也不会修改工作目录文件，只会把 file.txt 从暂存区撤下来，相当于撤销了 `git add file.txt` 。不过现代 Git 推荐写成 `git restore --staged file.txt`，两者完全等价。取消全部暂存可以执行 `git reset`，这等价于 `git reset --mixed HEAD`，即当前分支不移动，只把整个暂存区恢复到 HEAD，工作目录修改仍保留。

如果是尚未推送的本地提交或者纯个人开发，可以使用 `git reset`，否则如果是已推送到远程的提交，尤其是多人协作开发时，不要随便使用针对提交的 reset，这可能会破坏别人的提交历史，这种情况建议使用 `git revert`。

## git revert

git revert 的作用是：通过创建一个新的提交，抵消某个旧提交引入的修改。它不会删除旧提交，也不会把分支指针向后移动，适合撤销已经推送到远程的提交。注意 revert 不是把仓库恢复到某个提交之前，而是反向应用某个提交引入的变化。

```
git revert HEAD # 抵消最近一次提交
git revert --no-commit HEAD # 只生成反向修改，不创建提交
git revert <commit_hash> # 抵消指定提交，通常会打开编辑器让用户确认新提交的信息
git revert --no-edit <commit_hash> # 抵消指定提交，跳过编辑器确认并使用默认信息
```

如果旧提交涉及的代码后来又被修改，则会产生冲突，建议手动解决。

```
git add <冲突文件>
git revert --continue
```

不想继续也可以取消整个 revert

```
git revert --abort
```

## git fetch

git fetch 的作用是：从远程仓库下载本地还没有的提交、分支和相关对象，并更新本地的远程跟踪分支，但不修改当前本地分支和工作目录，即只有本地记录的 origin/master 被更新；本地 master、HEAD 和工作目录都不会改变。

```
git fetch # 获取当前默认远程仓库
git fetch origin # 获取指定的远程仓库
git fetch --all # 获取所有已配置的远程仓库
```

## git merge

git merge 的作用是：把另一个分支的提交和修改整合到当前分支中，方向由当前分支决定。一个具体的例子：把 feature 合并进 master

```
git switch master
git merge feature
```

合并时存在以下几种情况：

- fast-forward 合并：master 没有产生新提交，即 feature 分支的改动已经是基于 master 分支最新的提交进行的，即

  ```
  A -> B  master
        \
         C -> D  feature
  ```

  此时 Git 只需要把 master 向前移动即可，不会产生额外的合并提交。

  ```
  A -> B -> C -> D
                 ↑
         master、feature
  ```

  使用 `git merge --ff-only feature` 命令，表示只允许这种合并，如果两个分支已经分叉则命令会停止。

- 普通 merge 合并：如果 master 分支和 feature 分支都有自己的新提交，即

  ```
         C  master
        /
  A -> B
        \
         D -> E  feature
  ```

  合并后 Git 会创建一个合并提交 M，M 有两个父提交，master 分支的提交更新为 M，feature 分支的提交保持不变。

  ```
         C --------\
        /           M  master
  A -> B            /
        \          /
         D -> E --/
                  ↑
                feature
  ```

- squash 合并：把 feature 分支的所有修改压成一次普通提交，这会得到功能分支的最终修改，但不会创建具有两个父提交的真正 merge commit，也不会记录分支之的合并关系。

  ```
  git switch master
  git merge --squash feature
  git commit -m "合并 feature 功能"
  ```

对于普通 merge，在 `git add <已解决冲突的文件>` 之后，也可以使用 `git commit` 命令完成合并提交，两者在普通 merge 时效果等价，唯一的区别在于 `git merge --continue` 会使用 Git 已准备好的默认合并提交信息；`git commit -m "..."` 可以指定合并提交信息。（所谓不普通的 merge，指的是 rebase 或 cherry-pick，这俩可能还有后续提交需要继续处理，不能简单用 git commit 代替整个继续流程）

如果要放弃本次 merge

```
git merge --abort
```

对于远程分支，`git merge` 本身不会连接远程服务器，应该先获取远程仓库的最新状态

```
git fetch origin
git switch master
git merge origin/master
```

## git rebase

git rebase 的作用是：把当前分支上的一组提交，重新应用到另一个提交之后，即更换这些提交的基础。一个具体的例子，把 feature 分支 rebase 到 master 分支

```
git switch feature
git rebase master
```

假设分支历史是：

```
        C  master
      /
A -> B
      \
        D -> E feature
```

Git 会找出 feature 独有的提交 D、E -> 将 feature 移动到 main 的 C -> 依次重新应用 D、E 的修改。rebase 之后结果如下，其中 D'、E' 是新提交，即使内容相同，由于父提交发生了变化，因此提交哈希也会变化。

```
A -> B -> C -> D' -> E'  feature
          ↑
        master
```

如果要放弃本次 rebase

```
git rebase --abort
```

rebase 会逐个重新应用提交，和 merge 一样可能遇到冲突。

另外，rebase 会改写提交历史，不要 rebase 已经推送且其他人可能基于它继续开发的提交，否则其他人的历史会与新历史不一致。因此，rebase 更适合整理尚未共享的本地提交，而 merge 适合共享历史。

## git stash

git stash 的作用是：把尚未提交的修改临时收起来，让工作目录恢复到较干净的状态，之后再把修改取回来。假设当前状态是：HEAD 为已提交的版本 A，暂存区为已经 git add 的版本 B，工作目录为继续修改之后的版本 C。

```
git stash push # 默认不会保存未跟踪文件和被.gitignore忽略的文件
git stash push -u # 保存未跟踪文件，但不会保存被.gitignore忽略的文件
git stash push -a # 保存未跟踪文件和被.gitignore忽略的文件
```

Git 会将暂存区和工作目录中已跟踪文件的修改保存到储藏区（注意和暂存区区分开），然后将暂存区和工作目录都恢复到 HEAD 的版本 A 状态，当前分支和 HEAD 不会移动，也不会产生当前分支上的提交。

查看储藏区内容

```
git stash list # 查看储藏列表
git stash show -p stash@{0} # 查看某一次具体的储藏内容
```

应用和删除储藏区内容

```
git stash apply # 应用最新储藏，但保留储藏记录
git stash apply stash@{1} # 应用指定储藏
git stash pop # 将最新储藏的内容恢复到工作区，默认不恢复暂存区，成功后删除储藏记录
git stash pop --index # 将最新储藏的内容恢复到工作区，并且恢复暂存区，成功后删除储藏记录
git stash drop stash@{0} # 删除指定储藏
```

如果 pop 发生冲突，Git 会保留该 stash，避免修改丢失。

`git stash` 常用于临时切换任务，假设本身在 feature 分支上，且存在未提交的更改

```
git stash push -u -m "某个功能开发到一半"
git switch master
# 处理其它事情
git switch feature
git stash pop
```

## 合并与冲突处理

开始合并前最好先检查工作区是否干净，如果有会导致冲突的未提交修改，Git 就会拒绝合并，稳妥做法是先提交或暂存

```
git stash push -u
git merge feature
git stash pop
```

Git 合并文件的方式是，找出两个分支的共同祖先，然后比较“共同祖先 -> 当前分支的修改”和“共同祖先 -> 被合并分支的修改”。如果修改位于不同文件或不同位置，Git 会自动合并；如果双方修改了同一部分内容，则会出现冲突。冲突文件中会出现如下标记：

```
  <<<<<<< HEAD
  当前分支的内容
  =======
  feature 分支的内容
  >>>>>>> feature
```

冲突的处理流程如下：

```
git status
# 手动修改冲突文件，删除冲突标记
git add <已解决冲突的文件>
git merge --continue
```

## git pull

git pull 的作用是：从远程仓库获取最新提交，并把它们整合到当前本地分支，相当于 `git fetch` + `git merge`。

upstream 是指某个本地分支默认跟踪和比较的远程分支

如果当前分支已经设置了 upstream：

git pull

例如之前执行过：

git push -u origin master

Git 就知道当前本地 master 对应 origin/master。

也可以明确指定远程和分支：

git pull origin master

这表示获取 origin 的 master，然后整合进当前所在的本地分支。

因此，如果当前位于 feature：

git pull origin master

它会把远程 master 整合进当前 feature，并不会自动切换到本地 master。要更新本地 master，应先执行：

git switch master
git pull

git pull 有时能保留不冲突的本地修改，但如果远程变化可能覆盖它们，Git 会拒绝或产生冲突。稳妥做法是先提交，或者临时保存：

git stash push -u -m "拉取前临时保存"
git pull
git stash pop

git push，可以加-u 参数设置本地分支的 upstream，后续如果 push / pull 到这个默认远程分支，只需要执行 `git push` / `git pull` 即可。

---

## 常见 git 命令

- `git init`：新建本地 git 仓库，没什么好说的
- `git add <file_name>`：将本地修改添加到暂存区，可以 i 全部添加也可以以文件为单位添加
- `git commit -m "<description>"`：将暂存区的修改提交到本地仓库
- `git remote add <remote_repo_name> <remote_repo_address>`：添加远程仓库地址并进行命名，默认约定是 `origin`
- `git push origin <branch_name>`：将本地仓库的修改提交到远程仓库
- `git clone <remote_repo_address>`：克隆远程仓库到本地
- `git switch <branch_name>`：切换到某个分支
- `git restore <file_name>`：将某个文件的改动从暂存区取消
- `git reset [mode] <target_commit>`：把当前分支 / 暂存区 / 工作目录，重置到指定提交的状态
- `git revert <target_hash>`：反向应用某个提交引入的变化，达到抵消某次提交的效果

- `git status`：
- `git log`：查看提交日志
- `git branch <branch_name>`
- `git merge <branch_name>`
- `git pull origin <branch_name>`
