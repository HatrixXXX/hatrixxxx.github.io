# 自研 AI 芯片 GEMM 算子入门体系笔记

> 资料范围：`C:\Users\hrxic\Downloads` 下 47 个 PDF + 1 个 xlsx，并整合 `note_sipu.md` 的 MMA DTE 笔记。  
> 抽取结果：48/48 成功，约 263 万字符。  
> 目标读者：刚加入计算库团队、负责 GEMM/PE 算子调优的新人。

这份笔记不是把飞书文档逐页搬运一遍，而是把文档中的事实组织成一条主线：

```text
上层模型/框架 OP
  -> PyTorch/vLLM/sglang dispatch
  -> C++ wrapper / OPLib / SiKernel
  -> scc 编译 + runtime/driver launch
  -> RV Core 发射 RVV/Tile builtin
  -> Tile Core / TMAC / TLSU / TDTE / L2B / DRAM 执行
  -> gtest / Arch Model / ESL / DV / RTL / EMU / PMU 验证
```

全文里有三类表述：

- **文档事实**：来自本地 SiPU/OP/验证文档。
- **通用原理**：来自计算机体系结构、GEMM、RISC-V、CUDA/CUTLASS 等通用资料。
- **类比推断**：借 CUDA/GPU 解释 SiPU，但不把 CUDA 机制误认为 SiPU 机制。

## 0. 先给结论：你要理解的系统是什么

SiPU 这套体系可以先用一句话抓住：

**它是一个 RISC-V/RVV 控制执行环境，加上面向矩阵和 tile 数据的专用 Tile Core；软件栈从 PyTorch/vLLM 的 OP 接入一路降到 SiKernel，再通过 runtime/driver/ERT launch 到 PE 上运行。GEMM 调优的核心，是让 TMAC 尽量连续计算，同时用 L2B 和 DTE 隐藏 DRAM 搬运延迟。**

不要一开始就把它完全当 CUDA GPU。CUDA 的 `grid/block/thread/shared memory/global memory` 可以帮助建立直觉，但 SiPU 的真实性能模型更接近：

- 单 PE 内只有 2 个 RV Core + 1 个 Tile Core。
- Tile 指令、DTE、TLSU、TMAC 等 pipeline 需要显式同步。
- 同类执行部件不是无限并行，很多地方是按序发射、CPU-like pipeline。
- 高性能不是“开更多线程”这么简单，而是减少依赖、提高 loop-level parallelism、用 double/multi-buffer 让搬运和计算重叠。

对于 GEMM，新人最重要的 20 个概念是：

1. `M/N/K` 三个维度分别代表输出行、输出列、归约维。
2. GEMM 性能本质是计算密度和数据复用。
3. TMAC/TMMA 是 GEMM 的核心计算单元。
4. Tile Register 是 GEMM 的核心驻留资源。
5. C tile 最好跨 K chunk 留在 TReg 中累加。
6. A/B 数据要尽量按 TMAC 需要的 tile layout 和 K 连续排布进入 TReg。
7. L2B 是 PE 附近的 shared/local memory，是 DRAM 到 TMAC 的 staging 区。
8. DTE 用于 DRAM/L2B/tile format 间的大块异步搬运。
9. tensormap 描述 DTE 对多维 tensor 的访问方式。
10. 直接从 DRAM 喂 MMA 通常不理想。
11. double buffer/multi-buffer 用来隐藏 DTE 搬运延迟。
12. unroll 用来隐藏 load 到 MMA 的延迟。
13. unroll 受 TReg、load tag、icache、指令发射等资源限制，不是越大越好。
14. K 维切分会带来 reduce，通常优先切 M/N。
15. 对齐要求会直接影响 DTE/TLSU 性能。
16. `twait` 太早会阻断流水，太晚会读到未完成数据。
17. `tsync_*` 不等价于完整的 CUDA `__syncthreads()` 语义。
18. 性能分析要结合 trace、RTL 波形、PMU 计数，而不是只看端到端时间。
19. 框架 OP 不等于 kernel；很多 view/reshape 只是 metadata。
20. 算子调优要同时守住正确性、精度、资源占用、版本/环境可复现。

## 1. 文档地图

### 1.1 操作/开发类

| 文档 | 主题 | 优先级 | 与 GEMM/算子调优的关系 |
|---|---|---:|---|
| `SIPU Programming Guide.pdf` | SIPU 硬件资源、SDK/scc、kernel 属性、线程组织、DTE、同步、性能分析总指南 | 高 | 所有 kernel/GEMM 开发的入口 |
| `SIPU kernel代码开发手册.pdf` | sikernel 仓库结构、算子代码组织、构建、测试、MR 流程 | 高 | 落地写算子的第一份操作手册 |
| `高性能PE算子编程建议.pdf` | PE pipeline、依赖、访存、GEMM 示例、DTE 边搬边算 | 高 | GEMM 调优核心文档 |
| `PE DV 算子运行及分析方法.pdf` | PE 算子生成 vector、跑 DV、分析结果 | 高 | 性能/RTL 对齐入口 |
| `DV仿真结果分析方法.pdf` | ITrace/Verdi/波形分析 TMAC、DTE、stall | 高 | 定位 GEMM bubble 和依赖问题 |
| `单个 sikernel case 生成 arch_model vector dump 使用说明.pdf` | 单 case 生成 Arch Model vector dump | 高 | 缩小调试范围、交给 DV |
| `SiPU架构&软件协同开发环境.pdf` | sipu_sw 环境、构建、测试、test list | 高 | 跑通主线环境 |
| `tensormap接口使用说明.pdf` | DTE tensor map 编码接口 | 高 | GEMM 数据搬运和 tile/linear 转换关键 |
| `EMU环境PMU工具使用.pdf` | EMU/QEMU 中使用 PMU 抓性能计数 | 高 | 判断哪个硬件模块忙/空闲 |
| `OP 的开发文档.pdf` | PyTorch OP、shape/stride/dtype、算子实现记录 | 高 | OP 接入、框架语义、边界情况参考 |
| `CModel & RTL Simulation协同.pdf` | Co-Sim、Vector Sim、RTL/CModel 协同 | 中 | 联调、回归、vector 生成 |
| `SiKernel算子接入框架验证流程.pdf` | sikernel 接入 sglang/vLLM 验证流程 | 中 | 框架集成验证 |
| `vllm编译与算子接入流程.pdf` | vLLM SIPU 编译和 op list 接入 | 中 | LLM 场景接入 |
| `Gtest For Sikernel.pdf` | sikernel 使用 gtest 组织测试 | 中 | 正确性单测 |
| `SiPU架构验证测试集.pdf` | functional/performance test 结构与 golden | 中 | 测试集规范 |
| `SiPU架构&软件协同软件栈Bringup.pdf` | driver/runtime/kernel launch/CModel bringup | 中 | 理解运行链路 |
| `SiPU架构&软件协同开发代码CI方案.pdf` | sipu_sw、submodule、compiler、DV release 的 CI | 中 | 提交流程和回归 |
| `EMU-ZEBU搭建配置.pdf` | EMU/ZEBU 环境搭建、驱动 SDK、波形 | 中 | 硬件仿真按需 |
| `ZEBU EMU仿真测试流程.pdf` | 共享 ZEBU/EMU 环境下跑 sikernel | 中 | EMU 快速流程 |
| `SIPU 驱动与运行时 发布说明.pdf` | 驱动/运行时发布包、安装、验证 | 中 | 环境版本和限制 |
| `计算库 工作简记.pdf` | 周报式记录：GEMM、DV、DeepGEMM、vLLM 等进展 | 中 | 很有参考价值，但不是规范 |
| `计算库新人入职参考.pdf` | 新人服务器、工具、文档路线 | 中 | 入门导航 |
| `Arch Model Trace Log.pdf` | Arch Model trace 格式和开关 | 中 | 指令级定位 |
| `EMU-ZEBU固件配置方法.pdf` | EMU/QEMU 固件寄存器配置 | 低 | 环境异常时查 |
| `ESL block 初始流程.pdf` | ESL block interface/base/shell 生成流程 | 低 | ESL 模块开发时看 |
| `sipu_utils logging 使用说明.pdf` | logging API 和配置 | 低 | 调试辅助 |
| `sirt__config 模块.pdf` | sirt 配置管理模块 | 低 | 基础设施查表 |
| `如何使用AI Code.pdf` | AI coding 工具安装使用 | 低 | 与算子技术无直接关系 |

### 1.2 知识/架构类

| 文档 | 主题 | 优先级 | 与 GEMM/算子调优的关系 |
|---|---|---:|---|
| `Arch Model概述.pdf` | Arch Model 的 Sirt/GCS/CCS/BD/Spike/TileCore 模块 | 高 | 理解仿真和指令执行 |
| `SiPU Memory系统 之 地址管理.pdf` | VA/LA/PA、Cluster ID、DRAM/L2B 地址映射 | 高 | DTE、访存、对齐、interleaving 的基础 |
| `SIPU Tile Core常用指令归纳.pdf` | Tile load/store、MMA、move、wait、async copy | 高 | GEMM 编程核心查表 |
| `SIPU RV Core常用指令归纳.pdf` | RVV 数据类型、mask、tuple、访存、归约 | 中 | RVV 辅助计算、尾处理 |
| `SiPU ESL Modeling Methodology.pdf` | Arch/Function/Performance Model、RTL/EMU 方法论 | 中 | 理解模型和真实硬件边界 |
| `SiPU ESL Modeling总体方案.pdf` | ESL 建模总体方案、compiler/driver/trace dumper | 中 | 背景理解 |
| `SiPU ESL Model.pdf` | ESL 配置、trace、vector dump、perf report | 中 | 性能模型相关 |
| `SiPU ESL Model Framework.pdf` | ESL block、port、fifo、pipeline、counter | 中 | 分析模型内部时用 |
| `Tile Extension encoding 方案.pdf` | Tile 指令 encoding、TMMA、TMV、sync | 中 | 汇编/编译器/底层调试 |
| `Deepseek-v3 Op List.pdf` | DeepSeek-v3 OP 需求、FP8 GEMM、MLA/MoE | 中 | LLM GEMM/OP 需求清单 |
| `OPLib kernel list.pdf` | OPLib kernel 接口和支持形态 | 中 | 找已有 kernel 和接口 |
| `常用builtin快查表.pdf` | RVV 与 Tile builtin 对照 | 中 | 写 kernel 时快速查 |
| `同步接口汇总.xlsx` | 同步接口极简表 | 中 | 同步语义查表 |
| `RISC-V_Vector_(V)_Extension_Intrinsics_UM231_V1.5.pdf` | RVV intrinsic 详表 | 中 | RVV API 查表 |
| `riscv-v-spec-1.0.pdf` | RISC-V V 扩展规范 | 中 | RVV 原理和边界查证 |
| `SiKernelLaunch() proposal.pdf` | ERT、Kernel ABI、launch packet 提案 | 低中 | 理解 launch 背景，注意可能过时 |
| `SiPU Arch Model Integration.pdf` | Spike/tile extension 与 GCS/memory/kernel binary 集成 | 中 | Arch Model 调试 |
| `SiPU Arch Model.pdf` | Arch Model config/debug 简述 | 低 | 与概述重复 |
| `SiPU ESL Model Integration.pdf` | ESL module/tilecore integration 简表 | 低 | 较短，按需查 |
| `RISC-V Tile Extension 扩展指令集（Deprecated）.pdf` | 旧 Tile Extension 草案 | 低 | 只作历史背景，明确 deprecated |

### 1.3 推荐阅读顺序

如果只有 **1 天**：

1. `计算库新人入职参考`
2. `SIPU Programming Guide`
3. `高性能PE算子编程建议`
4. `SIPU kernel代码开发手册`
5. `PE DV 算子运行及分析方法`

如果有 **3 天**：

1. 新人/全局：`计算库新人入职参考` -> `SiPU ESL Modeling总体方案` -> `Arch Model概述`
2. 编程基础：`SIPU Programming Guide` -> `SiPU Memory系统 之 地址管理`
3. 指令查表：`SIPU Tile Core常用指令归纳` -> `SIPU RV Core常用指令归纳` -> `常用builtin快查表`
4. GEMM/DTE：`tensormap接口使用说明` -> `高性能PE算子编程建议`
5. 验证：`单个 sikernel case 生成 arch_model vector dump 使用说明` -> `PE DV 算子运行及分析方法` -> `DV仿真结果分析方法`

如果有 **1 周**：

1. 跑通一个现有 sikernel case。
2. 跑 Arch Model，拿到 vector dump。
3. 跑 PE DV，看 ITrace/波形。
4. 用 PMU 看一次 EMU 计数。
5. 读 `OP 的开发文档` 和 `Deepseek-v3 Op List`，理解真实 LLM workload 为什么会落到 GEMM、BMM、FP8 GEMM、MoE GEMM。
6. 对一个 GEMM case 做小改动：改 tile/block/chunk/unroll 或 load/MMA 顺序，记录正确性和性能变化。

## 2. 从第一性原理看 GEMM 为什么是 AI 芯片的核心

GEMM 是：

```text
C[M, N] = A[M, K] * B[K, N]
C[i, j] = sum_k A[i, k] * B[k, j]
```

对每个输出元素 `C[i,j]`，需要 `K` 次乘加。整个 GEMM 约有 `2*M*N*K` FLOPs。问题在于，算力很便宜，数据搬运很贵。高性能 GEMM 的核心不是“会不会写三重循环”，而是：

- A 的一个元素能不能被多个 N 方向的输出复用？
- B 的一个元素能不能被多个 M 方向的输出复用？
- C 的中间累加能不能留在寄存器里，不要每轮写回内存？
- DRAM 到本地 memory 的搬运能不能和计算重叠？
- 计算单元是否每个 cycle 都有活干？

这就是为什么 AI 芯片会设计：

- **矩阵乘单元**：例如 SiPU 的 TMAC/TMMA。
- **大块寄存器**：Tile Register 存 A/B/C tile。
- **本地 shared memory**：L2B 存热数据，降低 DRAM 延迟和带宽压力。
- **异步搬运引擎**：DTE 把 DRAM/L2B/tile format 搬运和转换从计算路径中分离。
- **显式同步和 barrier**：因为不同 pipeline 并行工作，软件必须告诉硬件何时可见、何时可消费。

CUDA/CUTLASS 的通用经验也相同：高性能 GEMM 是分层 tiling，数据从 global memory 到 shared memory，再到 register fragment，计算核心尽量连续发射 MMA。SiPU 的具体名字不同，但第一性原理相同：**让昂贵数据尽可能多复用，让昂贵计算单元尽可能少空转**。

## 3. SiPU 硬件架构：从可编程视角理解

### 3.1 层级关系

本地文档给出的编程视角可概括为：

```text
PEG
  ├─ PEC x 4
  │   ├─ PE x 4
  │   │   ├─ RV Core x 2
  │   │   ├─ Tile Core x 1
  │   │   │   ├─ TLSU: Tile load/store
  │   │   │   ├─ TMAC: matrix/MMA
  │   │   │   ├─ TALU: vector/tile arithmetic
  │   │   │   ├─ TSFU: special function
  │   │   │   ├─ TDTE/DTE: tensor/data transfer
  │   │   │   ├─ TMOV: Tile 与 RV/vector/scalar 搬运
  │   │   │   └─ Sync/Config/TCSR
  │   │   ├─ L2B/shared memory
  │   │   └─ Tile Register file
  │   └─ DRAM slice / interconnect
  └─ runtime/driver/firmware 可见的调度和内存资源
```

关键事实：

- 每个 PE 里有 2 个 RV Core 和 1 个 Tile Core。
- RV Core 执行 scalar/RVV 代码，也通过 builtin/ACE 路径发射 Tile 指令。
- Tile Core 执行 Tile load/store、MMA、ALU/SFU、DTE、sync 等。
- Tile Register 架构上有 256 个，每个 1024B。
- 编程上 TReg 按线程模式分配：默认双线程对称时每线程最多 80 个；单线程或非对称模式可让一个线程最多用 160 个。

这里要避免一个误解：**2 个 RV Core 不等于 2 个完整 GPU warp scheduler，也不等于 2 套 TMAC。** 单 PE 只有 1 个 Tile Core/TMAC 路径，高性能写法通常是一个线程/调度流尽量喂满 TMAC，另一个线程做 DTE 或辅助工作来隐藏延迟，而不是两边无脑同时发 MMA。

### 3.2 线程组织：grid / cluster / block

SiPU 代码模型接近 CUDA：

- `__global__` 标识 device kernel。
- `__device__` 标识 device 函数/变量。
- `__shared__` 使用 L2B/shared memory。
- kernel 通过 `<<<...>>>` 或 runtime launch API 启动。

但语义和规模要按 SiPU 文档理解：

- `grid` 是逻辑任务数，可大于物理资源数，总线程数有上限。
- `block` 通常最多 2 个线程，对应 PE 内 2 个 RV Core。
- `cluster` 在 cooperative launch 中用于跨 PE shared memory 互访，一个 cluster 可覆盖 PEC 内多个 PE。
- `clusterIdx`、`blockIdx`、`blockIdxInCluster`、`threadIdx` 决定当前线程负责哪个 tile 或数据块。

GEMM 的常见映射思路：

```text
一个逻辑 block/线程组 -> 负责一个 C 的 tile 或一组 C tile
M/N 维 -> 分给不同 PE/block
K 维 -> 在每个 PE 内循环累加
```

优先按 M/N 切分，是因为每个 PE 得到独立 C 子块，不需要跨 PE reduce。K 维切分会把同一个 C 的不同 K 段分给不同 PE，最后还要归约，调试和同步复杂度都高。

### 3.3 内存层级和地址空间

文档把存储体系称为两层分布式共享存储：

- L2B：Distributed Shared Memory，靠近 PE，类似本地 shared/local memory。
- DRAM：Distributed Global Memory，容量大、延迟高。
- Host memory：与 device 统一编址。

SiPU 使用 48-bit 统一编址，Host 和 Device 共用 256TB 地址空间。软件侧看到的是 VA，硬件执行时会经历：

```text
VA -> LA -> PA/IPA
```

其中：

- VA：软件看到的虚拟地址空间。
- LA：Cluster ID 已从虚拟 ID 映射到物理 ID 的逻辑地址。
- PA/IPA：硬件实际访问的物理/中间物理地址。

地址转换里最重要的点：

- Cluster ID 映射支持多进程、多 cluster 分配。
- DRAM 地址还涉及多进程地址偏移映射。
- GCS packet、PE/RV 指令、Tile TLSU、DTE 都可能产生访问请求。
- PE 内部通常在 MIF 出口统一做地址转换，不需要 TLSU/DTE 各自理解全部映射细节。

对 GEMM 的直接影响：

- 连续地址访问更容易打满 port/bank/interleaving。
- 破碎、index 访问会降低有效带宽。
- tensor slice、padding、layout 转换可能破坏对齐。
- 调试跨 PE 或 DTE 问题时，需要分清是 kernel 地址算错、tensormap 描述错，还是 VA/LA/PA 映射和环境配置问题。

注意一个文档口径差异：`SIPU Programming Guide` 写每 PE L2B 为 1MB；地址管理文档中固定格式/物理空间描述出现每 PE 2MB、每 PEC L2B 8MB 的口径。实际调优时必须以目标 SDK/芯片配置和当前平台为准。

### 3.4 ISA：RISC-V scalar + RVV + Tile Extension

SiPU 的可编程执行不是单一 ISA：

- RISC-V scalar：控制流、地址计算、普通标量逻辑。
- RVV：向量运算、mask、reduce、index/stride load/store、类型转换、描述符准备。
- Tile Extension：Tile load/store、TMMA/MMA、TALU/TSFU、move、DTE、sync、mbarrier 等。

Tile Extension 不是 RVV 的简单扩展子集。它面向 tile register 和矩阵/tensor 操作。RVV 更适合：

- 小规模向量辅助计算。
- index/坐标/tensormap 数据准备。
- 尾处理、mask/reduce。
- Tile 与 RV vector/scalar 之间的数据搬运。

Tile Core 更适合：

- 大块 tile load/store。
- MMA/TMAC。
- tile-level ALU/SFU。
- DTE 异步搬运和 format conversion。

对 GEMM 最关键的指令语义：

- Tile MMA 常见语义可理解为 `D = A * transpose(B) + D`。
- 文档强调矩阵乘只支持 K 连续排布。
- 这直接决定 A/B layout、K 对齐、DTE 转换和 tile shape 设计。

### 3.5 执行模型：它为什么不像普通 GPU warp/SIMT

`高性能PE算子编程建议` 的重点不是 CUDA 式 occupancy，而是 CPU-like pipeline 的依赖管理：

- decode 宽度有限。
- 同类运算部件数量有限。
- ACE/Tile 指令不可推测执行。
- 小循环、分支、间接跳转会产生明显 bubble。
- RAW/WAR/WAW、访存依赖、结构依赖会让后续指令无法流水。

这意味着 GEMM 调优的第一目标是：

```text
让 TMAC 连续执行
让 TLSU/DTE 不阻塞 TMAC
让 wait 只出现在真正需要消费数据之前
让 load 顺序和 MMA 消费顺序匹配
让 C accumulator 不频繁写回
```

### 3.6 同步模型

SiPU 同步至少分三层。

第一层：单线程内多 pipeline 同步。

- `twait_load_global/share`
- `twait_store_global/share`
- `twait_tacp_cg`
- `twait_mem`
- `ace_bsync` / `ace_nbsync`
- cache fence / invalidate

这些用于保证 Tile LSU、DTE、TMAC、RV pipeline 之间的生产者/消费者顺序。

第二层：多线程同步。

- `tsync_tb_sync/arrive`：block/TB 内，通常最多 2 线程。
- `tsync_tbc_sync/arrive`：cluster/TBC 内，最多覆盖 cluster 内线程。
- 没有简单的 device-wide barrier；跨更大范围通常需要 atomic、cooperative launch、kernel 切分等。

第三层：memory barrier。

- mbarrier 是位于 L2B/shared memory 或相关 memory 上的 barrier 数据结构。
- 支持 arrive/wait、计数器操作。
- DTE 可以参与 mbarrier 更新。
- 适合 producer-consumer、异步搬运完成通知。

关键警告：原始 `tsync_*` 只保证 Tile Core 指令同步，不自动提供完整 memory 同步，也不等价于 CUDA `__syncthreads()`。如果涉及 RV/Tile 互访、Tile 写 global 后 RV 读、DTE 写 L2B 后 TMAC 读，需要显式 wait、ACE sync 和必要的 cache 操作。

## 4. 软件栈：从 OP 到硬件执行

### 4.1 总链路

```text
PyTorch / vLLM / sglang
  -> dispatcher 找到 PrivateUse1/SIPU backend
  -> 框架侧处理 view/reshape/contiguous/broadcast/dtype/fallback
  -> C++ wrapper 整理 Tensor 指针、shape、stride、dtype、标量参数
  -> OPLib / SiKernel API
  -> scc/CMake 编译 host .so + device .elf
  -> runtime/sipurt: malloc/memcpy/module load/kernel launch/stream/event
  -> driver/KMD/UMD: device、ELF、symbol、queue、packet
  -> ERT/RV 侧建立 kernel 环境
  -> RV Core 执行 kernel，发射 RVV/Tile builtin
  -> Tile Core / DTE / L2B / DRAM 执行
```

其中不同层的职责要分清：

- 框架层负责 OP 语义。
- wrapper 层负责把动态 tensor 世界变成 kernel 可消费的规则参数。
- SiKernel/OPLib 负责可复用的设备算子接口。
- 编译器负责把 `.su`/device code 降到 SiPU 可执行 ELF 和指令。
- runtime/driver 负责资源分配、模块加载、参数下发、launch、同步。
- ERT 在 RV 侧建立真实执行环境。
- kernel 负责高性能计算和显式同步。

### 4.2 OP 不等于 kernel

框架里的一个 OP，有几种情况：

1. 只改 metadata：`view`、`view_as`、部分 `reshape`、`as_strided`。
2. 可以复用已有基础 kernel：`copy_`、`contiguous`、elementwise。
3. 需要 C++ wrapper 做 shape/stride/dtype 规整，再调用 SiKernel。
4. 需要写新的高性能 device kernel。
5. 暂时 fallback 到 CPU 或不支持。

所以做 OP 接入时，不要一看到 PyTorch OP 就立刻写 kernel。正确顺序是：

1. 查 schema。
2. 查输入输出 shape/stride/dtype/device。
3. 判断是否是 view/metadata。
4. 判断是否能通过已有 kernel 组合实现。
5. 再决定是否新写 SiKernel。

`OP 的开发文档` 里大量记录了 PyTorch schema、CUDA 调用路径、shape/stride/broadcast、reduce、copy、bmm 等案例。它更像工程备忘录，适合做 OP 语义查证，不适合当体系化教材从头读。

### 4.3 SiKernel/OPLib 的代码形态

常见单算子结构：

```text
operator_name/
  ├─ device kernel / .su
  ├─ host wrapper / launch
  ├─ CMake/build/run script
  ├─ test_host / gtest
  └─ 文档/README/配置
```

接口交付上，OPLib/SiKernel 通常通过统一头文件、`release.list`、`.so`、device ELF 等对外提供能力。vLLM 接入时还需要：

- 在 `csrc/sipu/sikernel/*.cpp` 对接 API。
- 在 `op_list.yaml` 加入 sikernel 源码相对路径。
- 更新 sikernel submodule。
- pytest 或框架测试通过后走 MR/CI。

### 4.4 编译器应该怎么理解

本地文档没有完整展开编译器内部 IR、pass、寄存器分配、调度器、后端 lowering 的实现细节。因此这里要分成“文档事实”和“通用编译器原理”。

文档事实：

- 开发主要使用 `scc` 和 CMake。
- device/kernel 代码使用 `__global__`、`__device__`、`__shared__`、RVV intrinsic、Tile builtin。
- 编译产物包括 host `.so`、device/kernel `.elf`、测试可执行文件。
- 编译器提供 Tile 指令相关属性，例如 `disable_tile_scheduling`，让函数内 Tile builtin 尽量保持源码顺序。
- 这个属性不是绝对保序：编译器仍可能做 loop unroll、删除无用纯计算、移动 loop invariant。
- TReg 分配可通过 `treg_threading_mode` 影响。

通用编译器原理：

```text
C++/SU frontend
  -> AST / IR
  -> 高层优化：inline、常量传播、循环优化
  -> builtin/intrinsic 降到 target intrinsic 或 pseudo instruction
  -> 指令选择
  -> 寄存器分配：RV scalar/RVV/Tile register
  -> 指令调度：在依赖和资源约束下排序
  -> 汇编/ELF
```

如果以后公司编译器基于 LLVM/MLIR，这又会引入更高层的 dialect/lowering pipeline，例如：

```text
framework graph / tensor IR
  -> linalg/tensor/memref/vector dialect
  -> tiling/fusion/bufferization
  -> vector/LLVM/RISC-V/target dialect
  -> target codegen
```

但当前本地文档对这部分资料不足，所以不能断言 SiPU 编译器内部就是 MLIR。你目前对 GEMM 调优最需要理解的是：

- builtin 最终会影响 Tile/RVV 指令。
- 编译器可能改变源代码顺序。
- 指令顺序、寄存器复用、unroll、函数层级都会影响 pipeline。
- 看到性能异常时，要看 generated assembly/ELF/inst trace，而不是只看源码。

### 4.5 Kernel launch 和 ERT

`SiKernelLaunch() proposal` 和 Bringup 文档能帮助理解 launch 背景：

- runtime/driver 加载 module/ELF，找到 kernel symbol。
- launch packet 携带 grid/block/cluster、kernel args、stack、PC 等信息。
- ERT 在 RV 核侧建立 kernel code 的运行环境。
- 每个 RV core 需要 stack。
- RO 数据段可共享，RW 数据可能需要 per-core 独立。
- launch 前后是 cache 维护的关键时机。
- kernel args 有固定 ABI/布局限制，整型和浮点参数分别有约定区域。

这部分是 proposal/历史设计性质，实际实现以当前 SDK/runtime 为准。但你调试 launch 问题时，应沿着这条链路查：

```text
wrapper 参数
  -> runtime launch API
  -> module/function symbol
  -> kernel args buffer
  -> stack/RO/RW/PC
  -> ERT jump kernel
  -> kernel 内 thread/block 特殊变量
```

## 5. 算子如何被拆出来、接进去、实现出来

### 5.1 从模型到 OP

以 LLM 为例，模型代码里看起来是 `Linear`、`Attention`、`MLP`、`MoE`、`RMSNorm`、`ROPE`。落到 PyTorch/vLLM 后，会分解为大量 ATen OP：

- GEMM/BMM/GEMV
- cast/copy/contiguous
- reshape/view/as_strided
- softmax/reduce
- silu/mul/add/div
- gather/index_select/topk/nonzero
- KV cache 读写
- FP8 quant/dequant/scale

`Deepseek-v3 Op List` 的核心结论是：DeepSeek-v3 里 FP8 路径非常依赖 `fp8_gemm`，同时还需要 ROPE、RMSNorm、MLP/MoE、KV cache、attention 相关 OP 补齐。Linear/ColumnParallelLinear/RowParallelLinear 最终都可以落到 GEMM/GEMV/BMM。

### 5.2 从 OP 到 kernel 的拆分原则

一条实用拆分原则：

```text
框架前处理：处理动态复杂性
kernel 内核：保留规则高性能路径
```

框架前处理适合做：

- shape 合并。
- dtype 检查和必要 cast。
- contiguous/padding。
- broadcast 规整。
- view/reshape metadata 处理。
- 特殊小 shape fallback。

kernel 适合做：

- 规则 layout 上的核心计算。
- tile-level 数据搬运。
- 高复用计算。
- 显式同步和流水重叠。

这对 GEMM 特别重要：如果把任意 stride、任意 layout、任意 dtype、任意尾块都塞进核心 MMA loop，性能会很差。高性能 kernel 往往要求输入更规整，复杂性通过 wrapper 或预处理消化。

### 5.3 LLM 里 GEMM 为什么更复杂

LLM 里的 GEMM 不只是 `A @ B`：

- FP8 GEMM 需要 scale、amax history、quant/dequant。
- MoE 需要 token 按 expert 分组、block 对齐、两次 fused GEMM、激活、sum。
- MLP 是 `linear1 -> silu -> mul -> linear2`，另一路 `linear3` 参与乘法。
- Attention 里还有 BMM、KV cache、layout、slot mapping、block table。
- 如果激活、mul、dequant、transpose 在 tile format 上完成，可以减少 tile-linear 来回转换。

因此 GEMM 调优不仅是内核局部，还要看上下游：

- 输入权重是否已经是 tile-friendly layout？
- 是否每次都重复 transpose/dequant？
- activation 能不能 fusion？
- output 是否马上被下一个 GEMM/elementwise 消费？
- padding 是否影响真实 token 数？

## 6. GEMM 在 SiPU 上怎么实现和调优

### 6.1 最朴素的 GEMM 到 tile GEMM

CPU 朴素写法：

```cpp
for (m = 0; m < M; ++m)
  for (n = 0; n < N; ++n)
    for (k = 0; k < K; ++k)
      C[m][n] += A[m][k] * B[k][n];
```

高性能 tile 写法：

```text
for each C tile assigned to this PE/thread:
  initialize C accumulator tile registers
  for k0 in K chunks:
    load/convert A tile chunk
    load/convert B tile chunk
    MMA accumulate into C tile registers
  store C tile
```

更高性能：

```text
prefetch A/B chunk 0 from DRAM to L2B by DTE
for each k chunk:
  prefetch next A/B chunk into ping/pong L2B buffer
  load current A/B chunk from L2B to TReg
  issue MMA sequence
  overlap DTE of next chunk with TMAC of current chunk
store final C
```

### 6.2 数据布局：K 连续是硬约束

文档强调 Tile MMA 的矩阵乘只支持 K 连续排布。对 GEMM 来说，K 是归约维，也是每次 MMA 读 A/B 的核心维度。

因此：

- A tile 要让参与同一 MMA 的 K 段连续。
- B tile 通常按 `transpose(B)` 的语义组织，方便 TMAC 消费。
- 如果原始 tensor 是 linear format，最好用 DTE 做 linear-to-tile format conversion。
- 不要在 MMA 核心循环中用零碎 RVV/index 操作做重排。

这也是为什么 `tensormap` 重要：它把多维 tensor 的地址、shape、stride、tileDim、boxDim、OOB fill 等描述清楚，让 DTE 可以搬正确的数据块。

### 6.3 资源预算：TReg / L2B / DTE / TMAC

设计一个 GEMM kernel 前先做资源预算：

```text
TReg 需要放：
  C accumulator tiles
  A operand tiles
  B operand tiles
  double buffer / unroll 临时 tiles
  conversion / mask / tail 临时 tiles

L2B 需要放：
  A chunk ping/pong
  B chunk ping/pong
  mbarrier / sync object
  临时 staging buffer

DTE 需要考虑：
  copy size
  outstanding / commit group
  tensor map 描述
  linear-to-tile conversion
  DRAM latency 波动

TMAC 需要考虑：
  MMA shape
  计算间隔
  ReuseD 规则
  RAW/WAR/WAW
```

如果 C accumulator 放不下，只能中途写回 L2B/DRAM，会增加 store、wait 和再次 load，通常很伤性能。GEMM 调优很大一部分就是在 TReg 和 L2B 容量内选择合适的 `thread_m/thread_n/thread_k/chunk_k/unroll`。

### 6.4 K 维累加和 unroll

K 维累加最自然，但会遇到依赖：

- load 下一轮 A/B 可能和上一轮 MMA 使用同一寄存器，产生 WAR/WAW。
- 前一轮 MMA 的 D 输出和下一轮 D 输入产生 RAW。
- load 数据从 L2B/DRAM 到 TReg 有延迟。
- 如果每轮都 wait，TMAC 会空转。

所以需要 unroll 和寄存器轮换：

```text
load A0/B0
load A1/B1
mma C += A0*B0
load A2/B2
mma C += A1*B1
load A3/B3
mma C += A2*B2
...
```

文档指出访问 L2B 时较少展开可能足够，访问 global/DRAM 时需要更大展开才能覆盖延迟。但展开不是越大越好：

- TReg 不够。
- load tag 不够。
- icache 压力增大。
- 指令发射带宽成为瓶颈。
- load 顺序过度重排会破坏连续访问 pattern。

实操原则：

1. 先从文档或现有 kernel 的 unroll 版本开始。
2. 看 ITrace/波形里 TMAC 是否连续。
3. 如果 TMAC 前有明显 load 等待，再增加 unroll 或调整 load/MMA 顺序。
4. 如果 DTE/TLSU/port 已经满，继续 unroll 可能没收益。

### 6.5 ReuseD 和多列累加

文档提到 ReuseD 规则变化会导致 K 维累加时下一轮第一条 MMA 等待前一轮最后一条 MMA 输出，从而出现 RAW bubble。常见缓解方式是同时累加 B 的多列或多个 C tile：

```text
C0 += A * B0
C1 += A * B1
```

当 C0 的输出依赖还没解开时，先算 C1；当 C1 在算时，C0 的依赖时间被覆盖。这个思想和通用 GEMM 里的“增加 accumulator 数量提高指令级并行”相同。

代价是：

- C accumulator TReg 更多。
- B operand TReg 更多。
- store 地址和 layout 更复杂。

所以还是资源换并行。

### 6.6 DTE 边搬边算

高性能 GEMM 主线是：

```text
DRAM --DTE--> L2B --TLSU--> TReg --TMAC--> TReg --TLSU--> L2B/DRAM
```

不要让 TMAC 直接等待 DRAM。DTE 的作用是把 DRAM 搬运延迟藏在 TMAC 计算背后。

基本 double buffer：

```text
prefetch chunk 0 -> L2B[ping]
wait chunk 0
for k in chunks:
  prefetch chunk k+1 -> L2B[pong]
  compute chunk k from L2B[ping]
  swap ping/pong
```

如果 DRAM 延迟波动大，multi-buffer 更稳：

```text
buffer0: compute
buffer1: ready
buffer2: in flight
```

buffer 大小选择目标：

```text
DTE 搬一个 buffer 的时间 <= TMAC 计算这个 buffer 的时间
```

过小：

- commit/wait overhead 高。
- DTE latency 难隐藏。

过大：

- L2B 放不下。
- K chunk 过大导致尾处理复杂。
- 不能灵活覆盖延迟波动。

### 6.7 对齐和访存 pattern

文档中给出几类重要对齐要求：

- TLSU linear 访问：常见 32B 对齐。
- TLSU tiled 访问：常见 256B 对齐。
- TDTE linear：常见 64B 对齐。
- TDTE tiled：常见 256B 对齐。
- `sipuMalloc` 默认 256B 对齐，但 tensor slice/offset 可能破坏对齐。

性能优先级：

1. unit-stride / linear 连续访问。
2. tiled 规则访问。
3. stride 访问。
4. index/gather/scatter 访问。

GEMM 应尽量让 A/B/C 主路径是连续或规则 tiled 访问。index load/store 只有在必须处理稀疏、MoE token gather、KV cache 等不规则场景时才用。

### 6.8 同步 placement

`twait` 是性能敏感点。过早：

- 阻塞后续可并行发射的指令。
- DTE/TLSU/TMAC 无法重叠。

过晚：

- 消费未完成数据，功能错误。

实操原则：

- DTE 发起后，不要马上 wait；先做可独立计算。
- 只有在 TLSU/TMAC 真正需要读该 buffer 前 wait。
- Tile store 后 RV 读取，需要 store wait + ACE sync + cache 操作。
- 多线程共享 L2B，需要同时处理线程同步和 memory 可见性。
- mbarrier 适合 DTE producer/consumer，不要用大量全局 atomic 替代细粒度本地同步。

### 6.9 边界和 padding

GEMM 常有 M/N/K 不是 tile size 整数倍的问题。优先策略：

- 框架/wrapper 侧 pad 到 tile/DTE 对齐。
- DTE 用 OOB fill 补 0。
- kernel 内保留 original size，避免 reduce/softmax 等把 pad 区算进去。
- store C 时只写有效区域，或写完整 pad 后由后续逻辑保证 pad 不被消费。

对于 LLM，padding 不只是正确性问题，也影响性能：

- token block 对齐会改变实际计算量。
- MoE expert 对齐会产生空 token。
- FP8 scale/amax 不应被 pad 区污染。

### 6.10 FP8 GEMM 额外注意

DeepSeek-v3 文档显示 FP8 GEMM 是重点路径。FP8 GEMM 通常多了：

- input activation quant。
- weight dequant 或预转换。
- scale 读取和应用。
- amax history。
- 输出 dtype 转换。
- 可能的 activation fusion。

调优上要分清：

```text
纯 GEMM 时间
  + quant/dequant 时间
  + layout/transpose 时间
  + scale load 时间
  + fusion/activation 时间
  + launch/framework overhead
```

如果只优化 TMAC 循环，但每次前后都做昂贵 format conversion，端到端不一定快。

### 6.11 GEMM 调优检查表

每次调一个 GEMM case，建议记录：

| 项 | 要记录什么 |
|---|---|
| shape | M/N/K/batch，是否 MoE/FP8/BMM |
| dtype | A/B/C/accumulator/scale dtype |
| layout | A/B 是否 K 连续，是否 tiled，是否 transpose |
| mapping | grid/cluster/block，PE 切 M/N/K 哪个维度 |
| tile | MAC_M/MAC_N/MAC_K，C tile 数 |
| chunk | chunk_k，DTE copy size，buffer 数 |
| TReg | C/A/B/临时寄存器数量，线程模式 |
| L2B | A/B ping-pong buffer、mbarrier、临时区大小 |
| unroll | K loop unroll 次数，load/MMA 顺序 |
| sync | wait/ace_bsync/tsync/mbarrier placement |
| alignment | global/L2B/tile 地址是否满足 32/64/256B |
| correctness | golden、误差阈值、allclose/cosine |
| timing | warmup、repeat、event/端到端耗时 |
| trace | TMAC 是否连续，是否有 load/DTE wait bubble |
| PMU | `tmac_executing`、`tdte_active`、`tlsu_*`、`l2b_active`、`pe_active` |
| 结论 | 瓶颈是计算、DTE、TLSU、同步、launch 还是 layout |

### 6.12 MMA DTE 库视角：接口、调度和数据布局

`note_sipu.md` 里的内容更接近 MMA DTE 代码阅读笔记，适合补在 GEMM 调优章节后面。前面的章节讲“为什么要这样调”，这一节讲“库里通常怎么把这件事组织起来”。

#### 6.12.1 从 BLAS GEMM 到 `mma_dte` API

BLAS 按计算对象分层：

- L1：vector-vector，例如 dot、axpy、copy、scale。
- L2：matrix-vector，例如 `gemv`。
- L3：matrix-matrix，例如 `gemm`。

MMA DTE 主要服务 L3/GEMM，计算形式可以写成：

```text
C = alpha * op(A) * op(B) + beta * C
```

`op(A)` 和 `op(B)` 由转置参数决定。完整模板接口大致是：

```cpp
template <class inputT, class outputT, class scalarT,
          mma_dte_api::tensor_layout layoutA,
          mma_dte_api::tensor_layout layoutB,
          mma_dte_api::tensor_layout tensor_layoutC>
void mma_dte(mma_dte_api::Operation transa, mma_dte_api::Operation transb,
             int M, int N, int K, scalarT alpha, scalarT beta,
             void *A, int lda, void *B, int ldb, void *C, int ldc);
```

这里有几组参数要分清：

- `Operation` 类似 BLAS 的 `N/T/C`，表示不转置、转置、共轭转置。
- `M/N/K` 是 GEMM 逻辑维度：`M/N` 决定输出 `C[M, N]` 的位置数，`K` 决定每个位置累加多少项。
- `lda/ldb/ldc` 是 leading dimension，也就是矩阵在内存里的物理步长；它不一定等于逻辑宽高，因为可能有 padding，或只是大矩阵里的子矩阵。
- `inputT/outputT/scalarT` 分别描述输入、输出和缩放系数类型，例如 `sifmt::float16`、`sifmt::bfloat16`、`sifmt::mxfloat6e3m2`。
- `layoutA/layoutB/layoutC` 是编译期 layout 参数，决定 tile 形状、supertile 形状和后续 dispatch 路径。

#### 6.12.2 Planner、Dispatcher 和 `best_solution`

MMA DTE 库里的几个角色可以这样理解：

- DTE：Data Transfer Engine，负责 linear/tiled 格式之间的数据搬运、layout 转换和 tile 组织。
- MMA/TMAC：真正做 tile matrix multiply 的计算单元。
- Kernel：运行在 SIPU device 侧的计算函数。
- Planner：策略选择器，决定这次 GEMM 怎么切 chunk、用什么 schedule、开不开 Split-K。
- Dispatcher：路由器，根据 planner 的方案找到可用模板实例和 kernel 入口。

`best_solution` 可以看成一次 GEMM launch 的 host 侧执行计划。常见字段含义：

| 字段 | 含义 |
|---|---|
| `_s_type` | schedule 类型，例如 self-pro/self-con、producer-consumer、Split-K 路径 |
| `_planner_source` | 方案来源，可能是 heuristic、override、table 或 fallback |
| `_split_k` | K 维拆几份；`0` 表示不开 Split-K，当前 runtime switch 常见只支持 `2/4` |
| `_chunk_m_tile_num` / `_chunk_n_tile_num` | 一个输出 work chunk 覆盖多少个 M/N 方向 tile |
| `_A_chunk_k_tile_num` / `_B_chunk_k_tile_num` | A/B 每次搬运或计算取多少个 K tile，会进入 TensorMap boxDim |
| `_num_stages` | DTE/MMA 流水缓冲深度，常见是 `2/4`；L2B 放不下时会从 4 退到 2 |
| `_total_chunks` | 输出矩阵按 M/N chunk 切完后的总块数，约等于 `ceil(M/chunk_M) * ceil(N/chunk_N)` |
| `_grid` / `_cluster` / `_block` | 最终 kernel launch 配置；普通路径常见 `cluster=1`，Split-K 会把 `cluster` 设成 split 数 |

一条典型路径可以按下面读：

```text
mma_dte API
  -> planner 生成 best_solution
  -> tensor_map 创建 A/B/C TensorMap
  -> dispatcher 按 dtype、layout、schedule 找入口
  -> R32/R16/R8 具体 kernel 家族
  -> producer/consumer 流水搬 A/B、算 C
  -> store 或 linear/tiled 转换后写回
```

#### 6.12.3 `.su` 文件和编译模型

在这个项目里，`.su` 是 SIPU kernel 源文件后缀约定，不是标准 C++ 后缀，也不是 CMake 天然认识的语言。真正决定语法的是 SiOrigin SDK 里的 `scc` wrapper，以及背后改造过的 Clang 前端。

实际编译命令可以理解为类似：

```text
clang++ -x sipu -std=c++20 ... xxx.su
```

关键点是 `-x sipu`。`.su` 语法本质上是 C++20 加 SIPU 扩展，包括类似 CUDA 的 `__global__`、`__device__`、`__host__`、`__shared__`、`__constant__`。普通 `g++` 或普通 `clang++` 不认识这套语言模式，不能直接编译这类文件。

代码阅读时不要把 CMake 后缀识别当成核心。CMake 只是扫描 `kernel/instantiations/inst_*.su` 这类文件，交给 `scc_add_library(... OBJECT ...)` 生成 object。真正的语言前端、builtin lowering、Tile/RVV 指令生成，都在 SIPU SDK 和编译器工具链里。

#### 6.12.4 关键文件怎么分工

看 MMA DTE 仓库时，可以先记这几类文件：

| 文件 | 职责 |
|---|---|
| `include/simma.h` | 对外 API 入口，定义 `Operation`、`tensor_layout`、`mma_dte<...>()` |
| `sipu.h` | SIPU SDK 基础聚合头，提供编译/运行语境判断和参数检查等辅助能力 |
| `sipu_tensor.h` | TensorMap 相关接口，把 global memory、dtype、tile dim、box dim 等编码成 DTE 描述符 |
| `mma_dte_tiled_tensor.hpp` | tiled tensor 路径核心入口，串起 planner、TensorMap 和 dispatch |
| `tensor_map.hpp` | 创建 A/B/C TensorMap |
| `dispatch_entrypoints.hpp` | 按 R32/R16/R8、schedule 等选择 kernel launch 入口 |
| `dtype_registry.hpp` | 维护 dtype 元数据、tile data size、header/payload 等信息 |
| `dispatch_registry.hpp` | dispatch 规则中心，维护 L2B 用量模型、chunk_k 合法性和 dispatch traits |
| `mma_dte_tiled_tensor.h` | 公共配置对象 |
| `sipu_kernel_debug.h` | device/kernel 调试打印宏 |

`dtype_registry.hpp` 和 `dispatch_registry.hpp` 经常一起看。前者告诉你某个 dtype 的 tile 怎么存、一个 tile 多少字节；后者告诉你某组 `schedule/tile/chunk_k/chunk_m/chunk_n/num_stage` 是否合法、L2B 放不放得下、有没有对应 dispatch case。

MX 类型要特别注意。`mxfloat6e2m3` 这类名字里的 `e2m3` 表示 6-bit 浮点元素的 exponent/mantissa 字段，另有符号位；MX 数据通常还有 block scale/header。某些 tile 可能是 1024B payload 加 64B header。它和普通 bf16/fp16/int8 的搬运、TensorMap 编码、L2B 预算都不一样。

#### 6.12.5 Tensor Layout、TensorMap 和 tiled tensor

`tensor_layout` 描述参与 GEMM 的 tile 形状：

- `tile_dim0/tile_dim1`：一个 tile 在两个维度上的元素数。
- `supertile_shape0/supertile_shape1`：一个 supertile 包含多少个 tile。
- `dim0`：内存地址变化最快的维度。

以 `A(M x K)`、`B(K x N)`、`C(M x N)` 为例，常见目标是让 K 连续。A 可以按行主序让 `dim0=K`；B 为了让 K 连续，可能需要预转置或按列主序组织；C 通常按行主序让 `dim0=N`。

`tensor_format` 常见有两种：

- `linear`：按普通主序把元素线性排在 global memory。
- `tiled`：按 tile 为基本单位组织，贴近 DTE 和 MMA 消费方式；每个 tile 可能带 header 或 metadata。

TensorMap，也就是 `sipu::SItensorMap`，可以理解成 DTE 使用的“张量内存布局说明书”。普通指针只告诉 kernel 起始地址，TensorMap 还告诉 DTE dtype、rank、global dim、stride、tile dim、box dim、OOB fill 等信息。

`boxDim` 是 DTE copy box 的形状，单位通常是 tile，不是元素。例如 A 的 `boxDim` 描述一次搬多少个 K tile、多少个 M tile。它和 `grid/cluster/block` 不是同一层概念：

```text
tile_dim/supertile_shape -> tensor layout 层
boxDim                   -> DTE 搬运层
chunk_m/chunk_n/chunk_k  -> kernel 计算块层
grid/cluster/block       -> launch 执行配置层
```

这些层通过 chunk 连起来：先由 `chunk_m_tile_num * layoutA.tile_dim1` 和 `chunk_n_tile_num * layoutB.tile_dim1` 得到输出 chunk 的元素规模，再计算 `total_chunks`，最后由 launch 配置分配给 kernel。

#### 6.12.6 R32/R16/R8、MX 和 dispatch 规则

R32/R16/R8 是按 `layoutA.tile_dim1` 划分的 kernel 家族，表示 MMA tile 在 M 方向一次处理的行数规模：

- R32：`layoutA.tile_dim1 = 32`
- R16：`layoutA.tile_dim1 = 16`
- R8：`layoutA.tile_dim1 = 8`

它们的 MMA 结果形态、store 转换方式、chunk 支持集合和 dispatch shape 都不同，所以代码会按三条路径展开。

MX 和 non-MX 的区别主要在存储和搬运：

- non-MX：普通数值格式，每个元素本身就是一个常规数值，例如 bf16、fp16、int8。
- MX：microscaling/block-scaled 格式，一组低比特 payload 配合共享 scale/header 解释。

因此，MX 路径的 TensorMap 编码、tile data size、DTE 搬运策略、L2B 预算和 dispatch case 都会不同。调 FP8/MX GEMM 时，不要只看 TMAC 主循环；header/scale 搬运、layout 转换和 scratch 写回都可能吞掉收益。

#### 6.12.7 Schedule、producer/consumer 和 chunk 流水

`schedule_type` 描述谁搬数据、谁算 MMA，以及 K 是否拆分。常见模式：

- `SELF_PRO_SELF_CON`：自己搬数据、自己计算。
- `ONE_PRO_ONE_CON`：一个 producer 搬数据，一个 consumer 计算。
- `ONE_PRO_TWO_CON`：一个 producer、两个 consumer，目前更像预留方向。
- `ONE_PRO_ONE_CON_V2`：改进版 producer-consumer，优化 DTE 连续性。
- `ONE_PRO_ONE_CON_SPLITK`：Split-K 路径，把 K 维拆分并行计算。

producer 的工作是发起 DTE 搬运，把 A/B tile 从 global memory 搬到 SMEM/L2B 这类临时缓冲，并处理 TensorMap 坐标、commit、wait、sync。consumer 等数据就绪后执行 tile load / tmma，驱动 MMA 计算，并参与 C 写回。

这类调度的目标是 overlap：

```text
producer 搬下一批 A/B
consumer 同时计算上一批 A/B
```

chunk 是一次 kernel 调度里处理的一块矩阵区域，比单个 tile 更大。它控制一次搬多少数据、算多大输出、占多少 L2B、落到哪个 dispatch case。`chunk_m/chunk_n` 是 tile 计数，不是元素计数；换成元素规模时要乘对应 layout 的 tile 维度。

SMEM 在这里大致等价于 kernel 内部临时共享缓冲或 L2B 区，用来暂存 DTE 搬进来的 A/B tile。scratch 是更偏临时工作区的概念，常用于 linear 输出时的临时 D/C 写回缓冲，例如 `mma_dte_linear_store_scratch_view` 会把连续 scratch 切成多份供 kernel 内部使用。

#### 6.12.8 Split-K 什么时候值得用

M/N 拆分天然是输出块并行：每个 block 负责不同 C 区域，互不重叠，算完直接写回。K 拆分会产生部分和：多个 K split 计算同一个 C block 的不同部分，最后必须规约相加。

所以 Split-K 的本质是用额外规约成本换并行度。它通常只在下面场景值得考虑：

- M/N 输出块数量太少，普通输出并行喂不满硬件。
- K 很长，单个输出块内部工作量大。
- 规约成本小于新增并行度带来的收益。

如果 M/N 并行度已经足够，优先继续优化常规 tiling、layout、DTE/MMA overlap 和 sync placement，不要先拆 K。

#### 6.12.9 EMU、VCS、Verdi 的补充口径

`note_sipu.md` 里还整理了仿真工具的边界：

- EMU/hardware emulator 更接近真实硬件条件，适合大 SoC、长时间场景和 runtime/driver/firmware 路径验证。
- VCS 是软件仿真器，负责编译 RTL/testbench/库并跑仿真，速度慢但调试细。
- Verdi 负责看波形、追信号、查 driver/load、定位 RTL/testbench 问题。

可以把分工记成：

```text
VCS   -> 编译 + 跑仿真
Verdi -> 看波形 + 调试
EMU   -> 更接近真实系统的长场景硬件仿真
PMU   -> 采累计计数，判断模块忙不忙
```

工具选择不要混用目标：PMU 适合回答“哪个模块 busy”，波形/trace 才适合回答“一段时间线里哪里在等”。

## 7. 测试、仿真和问题定位

### 7.1 各工具定位

| 工具/环境 | 主要用途 | 适合回答的问题 |
|---|---|---|
| gtest | host 侧结构化单测 | 算子 API/shape/dtype/结果是否正确 |
| Arch Model | ISA/功能模型、kernel launch、trace、vector dump | 指令级功能是否符合预期 |
| ESL Model | SoC/性能建模、function/perf 模式 | 早期性能趋势、模型级行为 |
| CModel | 软件模型集合，与 driver/runtime 对接 | 软件栈路径、vector 生成 |
| DV | RTL 验证 testbench | RTL 是否和模型/vector 对齐 |
| RTL simulation | 硬件实现本体仿真 | 真实微架构行为、波形 |
| EMU/ZEBU | 更接近真实硬件的软件栈仿真 | driver/firmware/runtime 长流程 |
| PMU | 性能计数器 | 哪个模块忙、哪个模块空闲 |
| trace/log | 指令、事务、runtime/driver/CModel 日志 | 错误边界在哪里 |

### 7.2 一个算子的标准验证路径

1. 明确输入输出、shape、dtype、精度阈值和 golden。
2. 写 host/golden check，能 pass/fail 返回。
3. 用 gtest 或测试 case 覆盖正常、边界、类型组合。
4. 用 SDK/scc 编译。
5. 在 Arch Model 跑通功能。
6. 对单 case 生成 vector dump。
7. 在 DV 中用 vector 驱动 RTL，先看正确性。
8. 正确后看 ITrace 和波形，定位 TMAC/DTE/TLSU bubble。
9. 上 EMU/ZEBU 验证真实 runtime/driver/firmware 路径。
10. 用 PMU 采集累计 counter。
11. 稳定后加入 CI/test list。

### 7.3 问题定位表

| 问题类型 | 典型信号 | 优先检查 |
|---|---|---|
| kernel bug | Arch Model/gtest 已 fail；golden mismatch 稳定复现 | args、shape、stride、越界、同步、DTE/TLSU、精度阈值 |
| 编译器 bug | 源码简单但指令异常；换 SDK/优化级别行为变 | ELF/disasm/inst_trace、builtin lowering、寄存器数、最小复现 |
| runtime/driver bug | fakedriver/Arch 直跑过，runtime/EMU 路径失败 | malloc/memcpy/module load/launch、args 地址、queue/completion、CSR |
| 模型/RTL mismatch | CModel/vector 过，RTL DV fail | scope 降到 PE/PEC/chip，比对 result image、transaction、trace、波形 |
| 环境配置问题 | 找不到 SDK/scc；无 vector dump；EMU hang | SDK/driver/firmware 版本、toml/config、submodule、权限、PMU profile |
| 性能问题 | 正确但慢；TMAC 空泡多 | ITrace、Verdi、PMU、DTE/TLSU active、sync placement、layout、alignment |

### 7.4 性能分析顺序

不要一上来就猜。建议顺序：

1. 端到端时间确认是否真的慢。
2. event 或内部计时区分 launch/framework 和 kernel。
3. Arch/trace 看指令序列是否符合预期。
4. ITrace 看大粒度 bubble。
5. RTL/Verdi 看真实 execute/active 信号。
6. PMU 看模块利用率。
7. 回到源码改 unroll、buffer、layout、sync。

PMU 只能给累计统计，适合回答“哪个模块忙/不忙”，不适合回答“一小段时间在哪里卡住”。短时间定位仍要靠 trace/波形。

## 8. 和 CUDA/CUTLASS/RISC-V/MLIR 的类比边界

### 8.1 可以类比的地方

CUDA/CUTLASS 里有一条经典 GEMM 分层：

```text
global memory
  -> shared memory tile
  -> register fragment
  -> MMA
```

SiPU 可以类比为：

```text
DRAM
  -> L2B/shared memory
  -> Tile Register
  -> TMAC/TMMA
```

CUDA 的 block/shared memory 可以帮助理解 SiPU 的 block/cluster/L2B，但要记住：

- CUDA warp/SIMT 和 SiPU RV Core + Tile Core 不同。
- CUDA `__syncthreads()` 和 SiPU 原始 `tsync_*` 不等价。
- CUDA occupancy 不是 SiPU GEMM 的唯一或首要性能模型。
- SiPU 的 DTE/tensormap、VA/LA/PA、TReg 分配、twait/ACE sync 是自己的机制。

### 8.2 RISC-V/RVV 的作用

RISC-V V spec 和 RVV intrinsic 资料用于理解：

- `vsetvl`/VL/SEW/LMUL。
- vector/mask/tuple 类型。
- widening/narrowing 转换。
- vector load/store/reduce。

在 SiPU 中，RVV 更像辅助向量计算和控制工具。GEMM 主计算仍应落到 Tile/TMAC。

### 8.3 MLIR/LLVM 的作用

MLIR/LLVM 官方资料可用来理解通用编译器分层：

- 高层 tensor/linalg 表示。
- tiling/fusion/bufferization。
- lowering 到 vector/memref/LLVM。
- target-specific codegen。

但本地文档没有证明当前 SiPU 编译器完整使用 MLIR pipeline，所以这里只作为通用编译器背景。

## 9. 新人实践路线

### 第 1 阶段：跑通环境和最小 case

目标：知道一个 kernel 从源码到运行经历什么。

1. 按 `计算库新人入职参考` 和 `SiPU架构&软件协同开发环境` 准备环境。
2. 按 `SIPU kernel代码开发手册` 找一个已有简单算子。
3. 编译并运行 host test。
4. 用 gtest 或现有 run script 确认 pass/fail。
5. 看生成的 `.so`、`.elf`、test binary 分别是什么。

### 第 2 阶段：理解 PE 编程模型

目标：能看懂一个 GEMM kernel 的主体。

1. 读 `SIPU Programming Guide` 的硬件简介、线程组织、DTE、同步、性能分析。
2. 查 `SIPU Tile Core常用指令归纳` 和 `常用builtin快查表`。
3. 查 `tensormap接口使用说明`，理解 DTE 描述符。
4. 用一个小 shape GEMM 画出 A/B/C tile 的地址和 TReg 分配。

### 第 3 阶段：做一次 GEMM 性能实验

目标：建立“改动 -> 指标 -> 结论”的闭环。

1. 选一个已有 GEMM case。
2. 记录 baseline：shape、dtype、tile、chunk、unroll、buffer、时间、PMU。
3. 只改一个变量，例如 `chunk_k` 或 unroll。
4. 跑正确性。
5. 跑 trace/PMU。
6. 写下结论：瓶颈变了吗？TMAC 是否更连续？DTE 是否更满？

### 第 4 阶段：接入真实 OP

目标：从框架 OP 到 kernel 的闭环。

1. 在 `OP 的开发文档` 查目标 OP schema。
2. 在 `OPLib kernel list` 查是否已有类似 kernel。
3. 在 wrapper 做 shape/stride/dtype/padding。
4. 在 SiKernel 写规则输入的核心计算。
5. 加 gtest。
6. 接 vLLM/sglang。
7. 跑框架层单测。

## 10. 资料不足和需要继续确认的点

以下点本地文档不足或存在版本口径差异，后续工作中要向团队/代码确认：

- 当前目标芯片/SDK 下每 PE L2B 的真实容量和 bank/port 配置。
- 当前 TMAC 各 dtype/shape 的准确 latency、issue interval、ReuseD 规则。
- 当前 DTE outstanding、commit group、copy granularity 的真实限制。
- 当前编译器内部 pipeline、IR、pass、调度和寄存器分配实现。
- `disable_tile_scheduling` 在当前版本中的实际保序边界。
- 当前 runtime 对 `__syncthreads()` 风格封装同步的精确语义。
- FP8 GEMM 当前 scale、amax、layout、dequant 的标准实现路径。
- MMA DTE 里 C++ 模板静态规则表、`traits` 和 dispatch registry 的真实代码组织方式。
- 输出 chunk 的 M/N tail loader 是否需要分别处理，以及对应哪段 dispatch 或 kernel 逻辑。
- DeepSeek/vLLM 文档是需求快照，OP 状态需要以最新代码和 CI 为准。

## 11. 逐篇文档摘要

这一章是“查地图”用的：当你忘记某份文档到底讲什么，可以先看这里，再决定是否打开原文。

### 11.1 操作/开发类文档

**`SIPU Programming Guide.pdf`**  
这是最重要的编程入口文档。它从 SIPU 硬件资源讲起，介绍 `grid/cluster/block/thread`、`__global__`/`__device__`、`scc` 编译、runtime API、Tile/RV builtin、DTE、同步、性能分析方法。对 GEMM 来说，里面的 TReg 分配、DTE 使用、同步和对齐要求比 API 语法本身更重要。

**`SIPU kernel代码开发手册.pdf`**  
这是写 sikernel 的工程操作手册。它讲开发设备、基础算子库、环境准备、目录结构、封装库、host test、测试和提交流程。你要真正改一个算子，先靠它找到代码放哪里、怎么编译、怎么跑。

**`高性能PE算子编程建议.pdf`**  
这是 GEMM 调优核心文档。它解释 PE 执行模型、loop-level parallelism、寄存器/访存/结构/控制依赖，以及 Simple GEMM、K 维累加、A 列乘 B 行、DTE 边搬边算、double/multi-buffer 等具体优化。它的主线是让 TMAC 尽量连续执行，用 DTE/L2B 隐藏 DRAM 延迟。

**`PE DV 算子运行及分析方法.pdf`**  
这份文档讲如何把 PE 算子放到 DV 环境里跑，包括代码下载、环境配置、生成 vector、配置 case、查看结果。它适合在 Arch Model 能跑后，把 case 交到 RTL/DV 验证链路里。

**`DV仿真结果分析方法.pdf`**  
这份文档偏“怎么读性能和波形”。里面用 load/MMA 顺序、ITrace、Verdi/FSDB 等方法分析 TMAC 是否有 bubble、load 和 MMA 是否被依赖卡住。调 GEMM 性能时，它是把“慢”变成“哪个硬件单元在等什么”的关键资料。

**`单个 sikernel case 生成 arch_model vector dump 使用说明.pdf`**  
这份文档讲单个 sikernel case 如何生成 Arch Model vector dump。它解决的是“不要跑全量 test list，只把当前关心的 case 抽出来给 Arch/DV 使用”。调试单算子时非常实用。

**`SiPU架构&软件协同开发环境.pdf`**  
这是 sipu_sw 类项目的环境搭建文档，讲建目录、建 Python venv、clone 仓库、submodule、build、运行 Arch Model/ESL/vector dump 等。它是跑通软件-架构协同环境的入口。

**`tensormap接口使用说明.pdf`**  
这份文档讲 `siTensorMapEncodeTiled`、`siTensorMapEncodeLinear`、`siTensorMapEncode` 以及字段替换接口。核心是如何描述 tensor 的 dtype、rank、global address、global dim、stride、box dim、tile dim、OOB fill，让 DTE 能搬正确的数据。GEMM 的 DRAM 到 L2B/tile 搬运会频繁依赖它。

**`EMU环境PMU工具使用.pdf`**  
这份文档讲在 EMU 环境里用 PMU 工具采集性能计数。它列出环境准备、版本获取、kernel 准备、profile 配置和结果查看。PMU 适合判断 PE、RV core、TLSU、TDTE、L2B、TMAC 等模块是否忙，不适合替代波形做时间线定位。

**`OP 的开发文档.pdf`**  
这是一份很大的 OP 工程备忘录，覆盖 PyTorch schema、CUDA/PyTorch 调用路径、shape/stride、broadcast、copy、reduce、bmm、elementwise、各种算子的实现细节和坑。它不是体系化教材，但在你接 OP 时非常有用：先查 OP 语义，再决定 wrapper 和 kernel 怎么拆。

**`CModel & RTL Simulation协同.pdf`**  
这份文档讲 CModel 和 RTL 如何协同，包含 Co-Sim、Vector Sim、PE/PEC/PEG/chip scope、memory image、kernel launch vector、release 对齐等。它解释为什么 vector dump 能作为 DV 输入，以及为什么算子层最好不额外改造就能被不同仿真 scope 复用。

**`SiKernel算子接入框架验证流程.pdf`**  
这份文档讲 sikernel 接入 sglang/vLLM 等框架后的验证流程，包含环境准备、代码分支、docker、submodule、运行测试。它偏流程，适合在 kernel 自测通过后做框架验证。

**`vllm编译与算子接入流程.pdf`**  
这是一份短流程文档，讲 vLLM SIPU 仓库、docker、editable install、sikernel 源码挂载、`op_list.yaml` 接入。重点是 vLLM 构建后端会检测 sikernel 或 vLLM 代码变动并自动编译更新。

**`Gtest For Sikernel.pdf`**  
这份文档讲如何在 sikernel 中使用 gtest 做结构化单测，包括类型参数化、测试组织和注意事项。一个重要坑是 gtest host 代码和 sikernel function 可能需要分文件，否则受 `scc` 支持限制出现 link 问题。

**`SiPU架构验证测试集.pdf`**  
这份文档讲架构验证测试集的 functional/performance test、命名和目录结构、driver/runtime API based test、golden result、input/golden bin 文件、比较工具等。它适合理解测试集应该长什么样。

**`SiPU架构&软件协同软件栈Bringup.pdf`**  
这份文档讲软件栈 bringup，包括 driver/runtime API、host code、module load、function lookup、kernel launch、CModel 对接、memory/register 模拟等。它能帮助你把 runtime/driver/CModel/kernel 串成一条执行链。

**`SiPU架构&软件协同开发代码CI方案.pdf`**  
这份文档讲 sipu_sw/submodule/compiler/DV release 相关的 CI 流程和 git 操作。它对 GEMM 算法本身帮助不大，但能帮助你理解代码提交后会被哪些 test list、Arch Model、vector dump、ESL/DV 流程检查。

**`EMU-ZEBU搭建配置.pdf`**  
这份文档讲 EMU/ZEBU 环境权限、登录、QEMU/vHost、驱动 SDK、ZEBU 波形等配置。它偏硬件仿真环境操作，路径和版本时效性强，适合需要上 EMU/ZEBU 时按步骤查。

**`ZEBU EMU仿真测试流程.pdf`**  
这是 ZEBU EMU 上跑 sikernel 的快速流程，包含资源查看、启动环境、进入系统、跑测试等。它和 EMU-ZEBU 搭建文档重叠，但更像一份简短 checklist。

**`SIPU 驱动与运行时 发布说明.pdf`**  
这份文档讲驱动、运行时、SDK release 包的版本、安装、下载、校验和基础验证。调算子遇到 runtime/driver 路径问题时，先确认这里的版本和安装约束。

**`计算库 工作简记.pdf`**  
这是一份工作记录/周报集合，内容很多，包含 GEMM 模板、DeepGEMM、DTE port、DV 性能、case 数、vLLM/DeepSeek 进展等。它能帮你了解团队当前关注的问题和历史尝试，但不能当稳定规范使用。

**`计算库新人入职参考.pdf`**  
这是新人导航，讲服务器、AI 工具、IT 办公、研发文档和学习建议。它帮助你快速定位该先读哪些资料、该申请哪些资源。

**`Arch Model Trace Log.pdf`**  
这份短文档讲 Arch Model 指令 trace log 的打印逻辑、格式和相关代码位置。功能调试或 Arch/ESL log 对比时有用。

**`EMU-ZEBU固件配置方法.pdf`**  
这份文档讲 EMU/QEMU 固件配置，涉及 dramif bank hash mask、寄存器地址、firmware bin 修改等。它不是日常算子文档，通常只在 EMU 固件配置异常时查。

**`ESL block 初始流程.pdf`**  
这份文档讲 ESL block 的初始开发流程，包含 interface JSON、base/shell 等生成思路。除非你参与 ESL model/block 开发，否则优先级很低。

**`sipu_utils logging 使用说明.pdf`**  
这份文档讲 logging API、logger option、log level、格式和输出。runtime/driver/CModel 边界调试时，规范日志比临时 `printf` 更可维护。

**`sirt__config 模块.pdf`**  
这份文档讲 sirt config manager，用于从 toml/yaml 或默认配置读取 scalar/vector 配置。它是基础设施文档，主要在配置项混乱或模型参数化时查。

**`如何使用AI Code.pdf`**  
这份文档讲 AI coding 工具安装、命令、模式和使用建议。它不属于 SiPU/GEMM 知识体系，只作为个人效率工具参考。

### 11.2 知识/架构类文档

**`Arch Model概述.pdf`**  
这份文档概述 Arch Model 的模块：Test、Sirt、GCS-CP、CCS、BD、Spike、TileCore。TileCore 部分说明 TLSU、TMAC、TALU、TMOV、TSFU、TDTE、Sync、Config 等功能模块和代码入口。它帮助你理解 Arch Model 如何执行 kernel 和 tile 指令。

**`SiPU Memory系统 之 地址管理.pdf`**  
这是理解内存系统最重要的文档。它讲 48-bit 统一编址、Host/Device 共享地址空间、VA/LA/PA、L2B/DRAM 分布式共享存储、固定/可配置地址格式、Cluster ID 映射、DRAM 多进程地址映射、GCS/PE/C2C/Media/NoC 中的地址转换。对 GEMM 来说，它解释了为什么连续访问、对齐、interleaving、Cluster/PE ID 都会影响性能和正确性。

**`SIPU Tile Core常用指令归纳.pdf`**  
这份文档是 Tile 指令查表，覆盖 load/store、mma、mva、数据转换、move、wait、async copy 等。写 GEMM 时主要查 Tile load/store、tmma、tst/tld、twait 和数据类型。

**`SIPU RV Core常用指令归纳.pdf`**  
这份文档是 RVV 常用指令查表，讲 vector/mask/tuple 数据类型、`vsetvl`、访存、整型/浮点、reduce 等。GEMM 主体不靠 RVV，但坐标、描述符、尾处理、非规则计算会用到。

**`SiPU ESL Modeling Methodology.pdf`**  
这份文档讲 CModel、Arch Model、Function Model、Performance Model、测试集、RTL/CModel 对接、Formal/Block/System level、Emulation、性能验证等方法论。它帮助你分清功能模型、性能模型、RTL、EMU 的定位。

**`SiPU ESL Modeling总体方案.pdf`**  
这是 ESL 建模总体方案，覆盖 framework、arch tests/library、compiler、driver、trace dumper/player、CModel、Arch Model、ESL Model、function/performance 仿真等。它是架构和软件协同验证的总览。

**`SiPU ESL Model.pdf`**  
这份文档讲 ESL Model 的使用和配置，包括 function/perf 模式、trace、vector dump、perf report、并行仿真参数、DRAM model 等。你需要分析模型性能报告或调整 ESL 配置时再深入读。

**`SiPU ESL Model Framework.pdf`**  
这份文档讲 ESL framework 内部抽象，例如 component、clock region、port、fifo、pipeline、counter、log、vector dump。它偏模型开发者视角，算子工程师只需知道 ESL 性能报告背后有这些抽象。

**`Tile Extension encoding 方案.pdf`**  
这份文档讲 Tile 指令 encoding，包括 load/store、MMA sync/async、Tile Move、TALU、DTE、sync、wait 等指令格式。日常写 C++ builtin 不一定看它，但遇到汇编、反汇编、编译器 lowering 或非法指令问题时很重要。

**`Deepseek-v3 Op List.pdf`**  
这份文档分析 DeepSeek-v3 在 vLLM/HF 场景下需要的 OP，重点包括 FP8 GEMM、BMM、ROPE、RMSNorm、MLP/MoE、KV cache、attention，以及哪些 OP 已做/待做/可 fallback。它把 GEMM 调优和真实 LLM workload 联系起来。

**`OPLib kernel list.pdf`**  
这份文档列出现有 OPLib kernel、接口、类型和限制，例如 norm、sum、mul/div、tile_dot、MMA/DTE 等。要做新 OP 或找可复用 kernel 时先查它。

**`常用builtin快查表.pdf`**  
这是一份 RVV 和 Tile builtin 对照速查表，覆盖广播、类型转换、浮点/整型运算、reduce、比较、逻辑、index/stride load/store、原子等。写 kernel 时适合快速找函数名。

**`同步接口汇总.xlsx`**  
这是同步接口的极简 xlsx，包含 TB sync、TBC sync 等。内容很短，更适合作为索引，详细语义仍要回到 Programming Guide 和同步相关文档。

**`RISC-V_Vector_(V)_Extension_Intrinsics_UM231_V1.5.pdf`**  
这是 Andes RVV intrinsic 手册，内容非常全，适合查具体 intrinsic 名称、类型、参数、VL 用法。它是 API 字典，不建议从头到尾通读。

**`riscv-v-spec-1.0.pdf`**  
这是 RISC-V Vector 1.0 规范，讲 vector register、VL、SEW、LMUL、mask、load/store、算术、reduce 等 ISA 语义。它用来理解 RVV 为什么这么设计，日常写代码更多查 intrinsic 手册。

**`SiKernelLaunch() proposal.pdf`**  
这份文档是 kernel launch 方案提案，讲 ERT、x86 simulator、kernel code 运行环境、per-core stack、RO/RW 数据、kernel args、cache 维护、jump kernel PC、loader 等。它适合理解 launch 背景，但要注意 proposal 可能和当前实现有差异。

**`SiPU Arch Model Integration.pdf`**  
这份文档讲 Spike/tile extension、GCS packet、memory、kernel binary 和 Arch Model 的集成。它适合调 Arch Model 集成、packet、memory 映射问题时查。

**`SiPU Arch Model.pdf`**  
这份短文档讲 Arch Model 的配置、debug log、inst trace 解析和 Arch/ESL Model log 对比。它和 `Arch Model概述` 重叠，更多作为快速配置索引。

**`SiPU ESL Model Integration.pdf`**  
这是一页左右的 ESL integration 简表，涉及 module/tilecore interface/integration。内容很短，只在做 ESL 集成时查。

**`RISC-V Tile Extension 扩展指令集（Deprecated）.pdf`**  
这是旧 Tile Extension 指令集草案，已经明确 deprecated。它可以帮助理解历史设计，包括 Tile programmer model、format conversion、ALU/MMA/sync 等，但不应作为当前实现依据。

## 12. 最后：你做 GEMM 调优时的思考模板

每遇到一个慢 GEMM，不要先问“怎么改代码”，先问：

1. 这个 GEMM 的 M/N/K 和 dtype 是什么？
2. 理论上是 compute-bound 还是 memory-bound？
3. A/B 是否已经是 TMAC 喜欢的 layout？
4. K 是否连续？
5. C accumulator 是否留在 TReg？
6. A/B 从 DRAM 到 L2B 的 DTE 是否和计算重叠？
7. TMAC 是否连续执行？
8. DTE/TLSU/L2B/DRAM 哪个模块 busy？
9. wait/sync 是否太早或太多？
10. 边界/padding/FP8 scale/layout conversion 是否吞掉了收益？

你最终要形成的能力不是背某个 kernel 的写法，而是能把一个性能现象拆成：

```text
算子语义问题
  vs 数据布局问题
  vs 并行映射问题
  vs TReg/L2B 资源问题
  vs DTE/TLSU 访存问题
  vs TMAC pipeline 问题
  vs 同步问题
  vs 编译器/launch/runtime 问题
  vs 测试/仿真环境问题
```

只要能稳定做这个拆分，GEMM 调优就不再是玄学。

## 参考资料

本地资料：本目录下 48 份原始文档，已在第 1 章列出；`note_sipu.md` 的手工整理内容已并入第 6.12 节。  
外部通用资料只用于背景和类比：

- NVIDIA CUDA C++ Programming Guide: https://docs.nvidia.com/cuda/cuda-c-programming-guide/index.html
- NVIDIA CUDA C++ Best Practices Guide: https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html
- NVIDIA CUTLASS Efficient GEMM: https://docs.nvidia.com/cutlass/media/docs/cpp/efficient_gemm.html
- RISC-V Vector Extension 1.0: https://github.com/riscv/riscv-v-spec
- MLIR Documentation: https://mlir.llvm.org/docs/
