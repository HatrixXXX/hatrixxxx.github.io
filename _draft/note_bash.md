# Bash 笔记

# Shell、Bash、脚本和 Shebang

在终端中，`zaira@Zaira` 这类内容通常是 shell 提示符的一部分，用来显示当前用户和主机名。shell 以交互方式运行时，会在等待用户输入命令时显示提示符；普通用户的提示符通常是 `$`，如果 shell 以 root 用户，也就是管理权限用户身份运行，提示符通常会变成 `#`。在终端里可以用 `Ctrl + L` 清屏。

Shell 是一种特殊的解释器，主要用来解释和执行命令。这里的解释器指的是一个能够读取某种语言或命令，然后把它解释并执行的程序。shell 解释的是命令行语言，例如 `cd /tmp`、`ls -l`、`echo hello`，解析之后会调用相应的系统程序执行。Python、Node、Ruby 这类解释器更偏向执行对应编程语言的代码，而 shell 更偏向执行系统命令。

Bash 是 shell 的一种，全名是 Bourne Again Shell。它既可以让用户在终端里输入命令，也可以执行 shell 脚本，执行脚本时会把脚本里的命令一行一行解释并执行。除了 Bash，常见 shell 还有 `sh`、`zsh`、`fish`、`dash`、`ksh` 和 `csh`。它们之间的关系可以理解为：解释器是泛称，shell 是解释器的一类，bash 是 shell 这一类中的一个具体程序。所以 bash 是 shell，也是一种解释器，但“解释器”“shell”“bash”不是同一层概念。

如果按常见用途粗略分类，解释器或运行时可以包括 shell 解释器，比如 `sh`、`bash`、`zsh`、`fish`、`dash`、`ksh`、`csh`；编程语言解释器，比如 `python`、`ruby`、`perl`、`php`、`lua`；JavaScript 运行时，比如 `node`、`deno`、`bun`；数据库交互解释器，比如 `psql`、`mysql`、`sqlite3`；文本处理解释器，比如 `awk`、`sed`；以及其他专用解释器或工具，比如 `Rscript`、`matlab`、`make`。这种分类不是严格的数学分类，只是按常见用途帮助理解。

脚本是一个文本文件，里面写了一系列命令或代码。shell 脚本就是写给 shell 执行的脚本。文件后缀本身不决定脚本语法，`.sh`、`.bash`、`.zsh` 通常都属于 shell 脚本，但对应解释器可能不同，语法有重叠也有差异。真正决定直接执行时用哪个解释器的是脚本第一行的 shebang。

Shebang 是脚本文件第一行的特殊声明，作用是告诉系统：当用户直接执行这个文件时，应该使用哪个解释器来运行它。`#!` 就是 shebang，其中 `#` 有时被称为 hash，`!` 有时被称为 bang。比如 `#!/bin/bash` 表示使用 `/bin/bash` 这个 bash 解释器执行脚本；`#!/usr/bin/env bash` 表示先运行 `/usr/bin/env`，由它在当前 `PATH` 中查找 `bash`，再用找到的 bash 执行脚本。这样写主要是为了可移植性，因为不同系统里 bash 的位置可能不同。`/usr/bin/env` 本身是一个程序，常见用途有两个：一是打印当前进程里的环境变量，二是在当前环境下运行命令，例如 `env bash`。

Shebang 只在直接执行脚本时生效，例如 `./set_sdk.sh`。如果写的是 `source ./set_sdk.sh` 或 `. ./set_sdk.sh`，脚本不是由 shebang 负责启动解释器，而是由当前 shell 直接读取并执行。`which bash` 查的是当前环境变量 `PATH` 里的目录，它会按顺序寻找名为 `bash` 的可执行文件，找到第一个就输出。

# 命令解析、执行方式和进程关系

Bash 命令通常遵循 `command [选项] 参数` 这样的形式。其中 `command` 是命令本身，选项用于改变命令行为，参数是命令作用的对象。常见命令包括 `date`、`pwd`、`ls` 和 `echo`。你在 shell 里输入一行，例如 `cmake --version`，shell 会先解析这行文本，把第一个词 `cmake` 当作命令名，把后面的 `--version` 当作参数，然后再按规则判断 `cmake` 到底是什么。

命令名可能来自几类地方。`cd`、`source`、`export`、`unset` 这类是 shell 内建命令，由 bash 自己实现；`if`、`then`、`case`、`for`、`while` 这类是 shell 语法关键字；`ls`、`cmake`、`python`、`gcc` 这类通常是外部可执行程序，shell 会到 `PATH` 里查找；`my_func` 可能是你自己定义的 shell 函数；`ll` 也可能是别名，例如 `alias ll='ls -l'`。如果在 shell 顶层直接输入 `hello world`，shell 会把 `hello` 当作命令名，把 `world` 当作参数，而不会把它当成普通字符串；如果找不到叫 `hello` 的命令，就会报 `hello: command not found`。要输出字符串，需要使用 `echo` 这类命令。

Shell 脚本有两种常见执行方式。一种是新进程执行脚本，例如 `bash ./set_sdk.sh` 或直接运行 `./set_sdk.sh`，这种方式会启动一个新的 shell 进程来执行脚本，脚本里的操作只影响这个新进程和它的子进程，脚本跑完后新进程退出，当前终端不会被改变。另一种是在当前 shell 执行脚本，例如 `source ./set_sdk.sh`，或者等价写法 `. ./set_sdk.sh`，这种方式不会启动新的 shell，而是让当前终端 shell 直接读取并执行脚本里的命令，所以脚本对变量、环境变量、当前目录等的修改会留在当前终端中。

当前终端里的 shell 本身就是一个进程。你在里面执行 `bash ./build.sh`、`cmake ...`、`python ...` 这类命令时，这些命令通常会变成当前 shell 的子进程。环境变量的传递方向是父进程到子进程，也就是当前 shell 可以把已经导出的环境变量传给子进程，子进程可以继承父进程环境变量，但子进程不能反过来修改父进程的环境变量。

外部程序是否可执行，主要看两点：文件存在，并且有可执行权限。如果权限里有 `x`，说明可以执行。二进制程序可以直接执行；脚本文件通常还需要 shebang，告诉系统直接执行这个脚本文件时应该用什么解释器。

# 变量、参数展开和环境变量

Bash 脚本中的注释以 `#` 开头。变量可以用来存储数据，并且可以在脚本中读取、访问和操作这些数据。Bash 中没有严格的数据类型，变量既可以存储数值，也可以存储单个字符或字符串。变量赋值时，等号两边不能有空格，否则 Bash 会把等号前面的内容当成命令，把后面的内容当成参数。

```bash
the_path="/tmp/test"
echo "$the_path"
```

引用变量时使用 `$变量名` 的形式，例如 `$the_path`。实际写脚本时通常建议给变量加双引号，也就是写成 `"$the_path"`，这样即使变量内容包含空格，也不容易出错。加双引号还能防止空格、换行、通配符引起的拆分和展开。`read the_path` 可以读取用户输入，并把输入内容保存到 `the_path` 变量中，后面就可以通过 `"$the_path"` 使用这个变量。

脚本和函数接收参数时，`$0` 表示当前脚本文件名，`$1` 表示第一个参数，`$2` 表示第二个参数，以此类推，`$1` 到 `$9` 表示前 9 个参数。函数内部也可以用 `$1`、`$2` 等访问调用函数时传入的参数。

在 Bash 里，`${...}` 是变量或参数展开，`$(...)` 是命令替换，也就是执行括号里的命令，把输出结果填到当前位置。例如 `$(pwd)` 会执行 `pwd` 并取它的输出。`${var:-fallback}` 是 Bash 的参数展开语法，不是项目自定义语法；它的意思是：如果 `var` 已定义且非空，就取 `var` 的值，如果 `var` 未定义或为空，就取 `fallback`。`${!var_name}` 是 Bash 的间接变量展开，意思是把 `var_name` 的值当成另一个变量名，再取那个变量的值；`${!var_name:-}` 则是在间接取值时，如果目标变量没设置或为空，就使用空字符串。

`--` 是很多命令约定使用的选项结束标记，意思是从这里开始，后面的内容都当作普通参数，不要再当作选项解析。`&&` 表示前一个命令成功了，才执行后一个命令；`||` 表示前一个命令失败了，才执行后一个命令。

```bash
command1 && command2
command1 || command2
```

环境变量是一类进程携带的配置变量。每个进程启动时，都会带着一组“名字=值”的字符串，例如 `PATH=/usr/bin:/bin`、`HOME=/data/users/huangruixiang`、`USER=huangruixiang`、`SI_SDK_ROOT=/share_data/sicx_sdk/release/latest`。当你在这个 shell 里启动子进程，比如 `cmake ...`、`bash ./build.sh`、`python ...`，这些子进程会继承当前 shell 中已经 `export` 出去的环境变量，程序可以读取这些变量来决定自己的行为。

环境变量名字没有一个系统统一注册表，本质上名字就是字符串，关键看有没有程序认识并使用它。常见系统或登录环境变量通常由登录系统、shell、终端环境设置，例如 `PATH`、`HOME`、`USER`、`LOGNAME`、`SHELL`、`PWD`、`OLDPWD`、`LANG`、`LC_*`、`TERM`。Bash 自己也维护一些变量，例如 `BASH_SOURCE`、`BASH_VERSION`、`BASH`、`UID`、`RANDOM`、`SECONDS`，其中 `BASH_SOURCE` 是 Bash 提供的数组变量，用来记录当前正在执行或被引用的脚本文件来源，它通常不是给子进程继承用的普通环境变量。

工具、语言和构建系统也会约定一些环境变量，例如 `LD_LIBRARY_PATH` 用来影响动态链接器查找 `.so`，`LIBRARY_PATH` 用来影响编译链接时找库，`CPATH` 用来影响编译器找头文件，`PKG_CONFIG_PATH` 用来影响 `pkg-config` 查找 `.pc` 文件，`CMAKE_PREFIX_PATH` 用来影响 CMake 找依赖，`PYTHONPATH` 用来影响 Python 找模块，`CONDA_PREFIX` 表示当前 Conda 环境，`CUDA_HOME` 表示 CUDA 安装路径。项目或 SDK 也可以自定义环境变量，例如 `set_sdk.sh` 里的 `SI_SDK_ROOT`、`SIPU_SDK_PATH`、`SIPU_HOME`、`SI_CROSS_COMPILE_PATH`、`MMA_DTE_ROOT`、`SIRT_LOG_LEVEL`，它们的意义由对应 SDK、构建脚本、CMake 文件或程序自己规定。

自己定义变量也很简单。`MY_VAR=hello` 只是当前 shell 的普通变量，子进程通常看不到；`export MY_VAR=hello` 则会把它导出成环境变量，子进程可以继承。变量名是不是系统自带不重要，只要被 `export`，就可以传给子进程；至于子进程里的程序认不认识、会不会使用这个变量，是另一回事。

`PATH` 是非常重要的环境变量。它的作用是：当你输入一个命令但没有写绝对路径时，shell 应该去哪些目录查找这个命令，并运行找到的第一个可执行文件。`PATH` 的值用冒号 `:` 分隔，这是 Unix / Linux 约定的格式，不是 Bash 独有的特殊语法；这里的冒号类似 CSV 里的逗号，只是分隔符。把某个目录加到 `PATH` 最前面，后续执行命令时会优先使用这个目录里的工具，例如优先使用 SDK 提供的交叉编译器或特定版本的 CMake，而不是系统默认版本。

`set_sdk.sh` 中的 `_mma_dte_prepend_path` 可以理解为一个“把某个目录加到某个环境变量最前面”的通用函数。它的第一个参数 `dir` 是目录，第二个参数 `var_name` 是环境变量名，函数会读取这个环境变量当前的值；如果 `dir` 存在，并且还不在这个环境变量里，就把 `dir` 加到变量最前面。这个项目里会把 SDK 交叉编译工具链、仓库旁边的 `cmake-3.30.3/bin` 加入 `PATH` 前面，也会把 Conda 的 `lib` 目录加入 `LD_LIBRARY_PATH` 前面。`export MMA_DTE_ROOT="${_mma_dte_set_sdk_dir}"` 则是项目自定义一个环境变量，用来表示项目根目录。

# 输入、输出、管道和重定向

Bash 收集输入的方式主要有两种：一种是读取用户输入并存储在变量中，常用命令是 `read`；另一种是从文件中读取。例如下面的写法是把 `input.txt` 作为整个 `while` 循环的输入来源，循环每次读取一行并打印出来：

```bash
while read line
do
  echo "$line"
done < input.txt
```

输出也有两种常见方式：一种是直接打印到终端，另一种是写入文件。`echo` 默认会在输出后换行，如果加上 `-n` 参数，就可以不换行。重定向操作符可以把命令输出写到文件里，其中 `>` 会覆盖文件内容，如果文件已经存在，原内容会被替换；`>>` 会把内容追加到文件末尾，不覆盖已有内容。`<` 可以让命令从文件读取输入，`<<` 可以写 here-document。通过这些方式，可以把任意命令的输入输出接到文件或脚本片段上。

```bash
echo "hello" > output.txt
echo "world" >> output.txt
```

Linux 里常见三个标准通道：`0` 是 `stdin` 标准输入，`1` 是 `stdout` 标准输出，`2` 是 `stderr` 标准错误。单独的 `2` 表示标准错误这个文件描述符编号，`&2` 表示引用 2 号文件描述符。`echo "error" >&2` 的意思是把 `echo` 默认写向标准输出的内容，重定向到当前标准错误指向的位置。`>` 和 `>&` 都是重定向，但右边含义不同：`>` 的右边通常是文件，`>&` 的右边是文件描述符。

`|` 是管道符，作用是把左边命令的标准输出交给右边命令作为输入。使用管道时，左边命令的标准输出通常不会直接显示在屏幕上，而是传给右边命令继续处理。

```bash
ps aux | grep nginx
grep "error" log.txt | wc -l
cat names.txt | sort | uniq
```

其中 `ps aux | grep nginx` 用于从所有进程中搜索 `nginx`，`grep "error" log.txt | wc -l` 用于统计包含某个词的行数，`cat names.txt | sort | uniq` 用于排序并去重。`cat log.txt | grep error` 也能工作，但这个例子不是特别好，因为 `grep` 本身可以直接读取文件，所以更直接的写法是 `grep error log.txt`。默认情况下，错误输出 `stderr` 不会进入管道；如果想把错误输出也传给管道右边，可以使用 `2>&1` 或 `|&`。

```bash
ls not_exist 2>&1 | grep "No such"
ls not_exist |& grep "No such"
```

# 常见 Linux / Unix 命令和查找方式

常见命令包括 `cd`、`ls`、`mkdir`、`touch`、`rm`、`cp`、`mv`、`echo`、`cat`、`grep`、`chmod`、`sudo`、`df` 和 `ps`。其中 `cat` 用来连接并打印文件内容，`grep` 用来在文件中搜索指定模式，`df` 用来显示可用磁盘空间，`ps` 用来显示正在运行的进程信息。

`grep` 的基本用法是从文件或输入中查找匹配内容。例如 `grep "error" log.txt` 表示在 `log.txt` 中查找包含 `error` 的行，`grep -r "main" ./src` 表示在 `src` 目录及其子目录中递归搜索 `main`。`grep` 常见选项中，`-n` 显示行号，`-i` 忽略大小写，`-v` 反向匹配，`-r` 递归搜索目录，`-l` 只显示文件名不显示具体匹配内容，`-c` 统计匹配行数，`-E` 使用扩展正则表达式，`-w` 匹配完整单词，`-o` 只输出匹配到的部分而不是整行。

`df -h` 可以用人类可读的格式显示磁盘使用情况，也可以在后面接路径，用来查看指定目录所在分区的磁盘空间。`ps aux` 可以查看所有进程的详细信息，其中 `aux` 是 BSD 风格参数，可以理解为 `a`、`u`、`x` 三个参数合在一起。`ps -e` 也可以显示所有进程，`ps -f` 显示完整格式，`ps -u` 可以查看某个用户的进程，`ps -p` 可以查看指定 PID 的进程。实际使用中，`ps aux` 经常配合 `grep` 查找进程，例如 `ps aux | grep nginx`，意思是先列出所有进程，然后从中搜索 `nginx`，可以用来查看某个程序是否正在运行。

在 Linux / Unix 命令里，参数风格大致可以分为 System V / POSIX 风格和 BSD 风格。System V / POSIX 风格通常带短横线，例如 `-e`、`-f`；BSD 风格通常不带短横线，例如 `aux`。

文件判断时经常会遇到“普通文件”这个概念。普通文件就是我们平时说的正常文件，里面存数据内容，可以读写，比如脚本、文本、图片、二进制程序等。`set_sdk.sh`、`main.cpp`、`README.md`、`image.png`、`a.out` 通常都属于普通文件。与普通文件相对的还有目录，例如 `/home/user/project`；符号链接，例如 `link_to_file`；设备文件，例如 `/dev/null`；管道文件 FIFO；以及用于进程间通信的 socket。

# 条件判断、循环、case 和函数

Bash 中可以使用 `if`、`elif`、`else`、`fi` 写条件语句。`if` 后面本来就可以直接跟命令，命令成功就进入对应分支；`[[ ... ]]` 通常用于 Bash 自己的条件判断。不能写成 `if [[ command -v cmake ]]; then` 来判断命令是否存在，因为 `[[ ... ]]` 里面不会执行 `command -v cmake`，它会把这些内容当成字符串或表达式处理。正确思路是让 `if` 直接执行命令，例如 `if command -v cmake >/dev/null; then ... fi`。

```bash
if [[ $score -ge 90 ]]; then
  echo "优秀"
elif [[ $score -ge 60 ]]; then
  echo "及格"
else
  echo "不及格"
fi
```

使用条件判断时要注意，中括号两边需要有空格。数字比较常用 `-eq`、`-ne`、`-gt`、`-lt`、`-ge`、`-le`，分别表示等于、不等于、大于、小于、大于等于、小于等于。字符串判断中，`==` 表示字符串相等，`!=` 表示字符串不相等，`-z` 表示字符串为空，`-n` 表示字符串非空。文件判断中，`-f` 用来判断是否是普通文件，`-d` 用来判断是否是存在的目录，`-e` 用来判断是否存在，文件或目录都算，`-x` 用来判断是否可执行。

```bash
[[ $a -eq $b ]]       # 数字等于
[[ $name == "Tom" ]]  # 字符串等于
[[ -z $name ]]        # 字符串为空
[[ -f a.txt ]]        # 判断 a.txt 是否是普通文件
[[ -d test ]]         # 判断 test 是否是目录
[[ -e a.txt ]]        # 判断 a.txt 是否存在
[[ -x script.sh ]]    # 判断 script.sh 是否可执行
```

`[ ... ]` 是更传统的写法，兼容 `sh`；`[[ ... ]]` 是 Bash 的增强版，更安全，也更好用。一个重要区别是：使用 `[ ... ]` 时，变量通常必须加双引号，否则变量为空或包含空格时可能出错；而 `[[ ... ]]` 对变量是否加引号更宽容。逻辑运算也可以用于条件判断，例如 AND 和 OR，在传统写法中常见形式是 `-a` 和 `-o`。

Bash 中常见循环有 `while` 和 `for`。`while` 循环适合在条件成立时反复执行某段代码。这里的 `((...))` 是 Bash 里的算术运算语法，专门用于整数运算；在 `((...))` 里面，变量可以不写 `$`，括号两边也可以不写空格。

```bash
i=1
while [[ $i -le 10 ]]; do
  echo "$i"
  (( i++ ))
done
```

`while` 语句也可以和重定向一起使用，例如 `while read line ... done < input.txt`，就是让整个循环从文件中读取输入。`for` 循环不能像 `while` 那样直接接 `[[ ... ]]` 条件。Bash 中的 `for` 主要有两大类写法：一种是 `for 变量 in 列表; do ... done`，另一种是 C 风格的 `for (( 初始化; 条件; 更新 )); do ... done`。

```bash
for i in 1 2 3; do echo "$i"; done
for i in {1..6}; do echo "$i"; done
for i in {1..10..2}; do echo "$i"; done
for f in *.txt; do echo "$f"; done
for x in $list; do echo "$x"; done
for x in "${arr[@]}"; do echo "$x"; done
for x in $(命令); do echo "$x"; done
for arg; do echo "$arg"; done
for ((i=1; i<=10; i++)); do echo "$i"; done
```

其中 `for i in 1 2 3` 是普通列表循环，`{1..6}` 是大括号范围，`{1..10..2}` 是带步长的范围，`*.txt` 是通配符文件列表，`"${arr[@]}"` 用来遍历数组，`$(命令)` 用来遍历命令输出但不总是推荐，`for arg; do ... done` 用来遍历脚本参数。最常见的其实主要是三种：`in` 加数字列表、文件通配符列表、C 风格数字循环。

`case` 语句适合根据某个变量的不同取值执行不同代码。在 `case` 语句中，双分号 `;;` 用来分隔每个模式对应的代码块，星号 `*` 代表默认情况，也就是没有任何指定模式匹配表达式时执行的分支，`case` 语句最后用 `esac` 结束。

```bash
fruit="apple"

case $fruit in
  "apple")
    echo "This is a red fruit."
    ;;
  "banana")
    echo "This is a yellow fruit."
    ;;
  "orange")
    echo "This is an orange fruit."
    ;;
  *)
    echo "Unknown fruit."
    ;;
esac
```

Bash 中可以定义函数，把一组命令封装起来，方便重复调用。函数内部如果不用 `local` 声明变量，变量默认是全局的；使用 `local` 可以让变量只在函数内部生效。函数也可以接收参数，函数内部同样可以用 `$1`、`$2` 等访问传入参数。

```bash
function who() {
  echo -n "I'm "
  whoami
}

sayHello() {
  echo "你好，$1"
}

sayHello Tom
sayHello Jerry
```

# Cron、调试和脚本书写细节

Cron 是 Linux / Unix 里的定时任务系统，它的作用是让系统在指定时间自动执行某些命令或脚本。`crontab` 工具用于添加和编辑 cron 作业。cron 的调度语法通常由五个时间字段加一个要执行的命令组成，五个字段分别代表分钟、小时、日、月、周几。

```bash
* * * * * sh /path/to/script.sh
0 0 * * * /path/to/script.sh
*/5 * * * * /path/to/script.sh
0 6 * * 1-5 /path/to/script.sh
0 0 1-7 * * /path/to/script.sh
0 12 1 * * /path/to/script.sh
```

上面的例子里，`0 0 * * *` 表示每天午夜运行脚本，`*/5 * * * *` 表示每 5 分钟运行脚本，`0 6 * * 1-5` 表示星期一到星期五每天早上 6 点运行脚本，`0 0 1-7 * *` 表示每个月的前 7 天运行脚本，`0 12 1 * *` 表示每个月第一天中午 12 点运行脚本。

调试 Bash 脚本时，一个很有用的技巧是在脚本开头设置 `set -x`。这个选项会启用调试模式，让 Bash 在终端中打印它即将执行的每个命令，并以 `+` 符号作为前缀，这有助于识别脚本中错误发生的位置。Bash 执行命令后会设置一个退出码，用来表示命令执行结果，可以使用 `$?` 查看最近一条命令的退出码；退出码为 `0` 表示成功，其他值通常表示出错。另一个常用调试方法是在代码中插入 `echo` 语句，用来观察程序执行到了哪里，以及变量当前传递的值是什么。如果希望脚本中的任意命令失败时立即退出，可以使用 `set -e`。

Bash 和 C 语言不同，不要求每句话都以分号结尾。但如果两个或多个语句写在同一行，就需要用分号分隔，否则解释器可能会把它们视为一条语句。反斜杠 `\` 可以用于行尾续行：如果一行太长，可以在不引起歧义的情况下，在行尾加上反斜杠，这样上下两行会被 Bash 当作同一条语句处理。
