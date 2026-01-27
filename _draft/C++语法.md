C 语言中的类型强转是小端存储。

C 矩阵的元素地址为`C[row * n + col]`：`col`由`threadIdx.x`决定(`x`是线程块内的第一个维度)。同一 warp 的 32 个线程(`threadIdx.x`从 0 到 31)会访问同一行(`row`固定)、连续列(`col`从 0 到 31)的元素，地址为`row*n + 0`、`row*n + 1`、...、`row*n + 31`，是连续内存，满足合并访问条件。如果交换一下，`row`由`threadIdx.x`决定，同一 warp 的线程会访问同一列(`col`固定)、不同行的元素，地址为`0*n + col`、`1*n + col`、...、`31*n + col`，步长为`n`(通常远大于 32)，内存不连续，无法合并，导致写入效率低。

```cpp
    const int col = blockIdx.x * blockDim.x + threadIdx.x;
    const int row = blockIdx.y * blockDim.y + threadIdx.y;
```

const float \*A 是指向常量的指针，不能通过该指针修改所指向的内存的值，但指针本身可以指向其他地址。

float \*const A 是常量指针(指针本身是常量)，一旦初始化后就不能再指向其他地址，但可以通过该指针修改所指向的内存的值。

1. `int *p = &a;` 的效果是：
   - 创建指针变量 `p`
   - 让 `p` 存储变量 `a` 的内存地址(即 `p` 指向 `a`)
   - 此操作完成后，`p` 和 `a` 建立了指向关系，但 `a` 的值不会改变
2. `*p = a;` 的效果是：
   - 将变量 `a` 的值写入到 `p` 所指向的内存地址中
   - 此操作会改变 `p` 所指向的变量的值(而不是改变指针 `p` 本身)
   - 前提是 `p` 已经指向了某个有效的内存地址(否则会导致错误)

变量名和地址是同一回事，变量名就是地址的别名，而地址里面存的值，又是另一回事。

值传递是指，函数调用的时候，实参将数值传给形参，形参改变不会影响到实参。地址传递是指传入的为地址，通过对地址的解引用，操作形参可以操作实参。

```c
// 值传递
void my_malloc_wrong(float *p) {
    p = (float*)malloc(100);  // 改变的是 p 的副本，原变量不变
}

float *a;
my_malloc_wrong(a);
// 此时 a 仍是 NULL，没被修改

// 址传递
void my_malloc_right(float **p) {
    *p = (float*)malloc(100);  // 通过解引用修改原始指针的值
}

float *a;
my_malloc_right(&a);
// 此时 a 被成功修改为分配的地址
```

float *d_a;有两种操作方式：修改 `d_a` 的值或访问 `*d_a`。所谓的“修改指针变量的值” —— 它**不是去改它所指的东西，而是改变它指向哪**。

python 函数参数传递是 **“对象引用的值传递”**：它传的是“对象的地址(引用)”，但这个地址本身是以值的方式传入函数的。mutable 可以改原变量，immutable 不行。

这是 C 风格的类型转换

```c
float *a = (float*)malloc(size);
```

这是 C++风格的类型转换，更安全、更明确，推荐使用

```c++
float *a = static_cast<float*>(malloc(size));
```

`auto` 是 C++11 引入的一个关键字，用于自动推导变量的类型。当你使用 `auto` 声明变量时，编译器会根据变量的初始化表达式自动推断出变量的类型。建议将显式的类型声明替换为 `auto`，主要有以下几个原因：

使用 `auto` 可以使代码更简洁，特别是当类型名称很长或很复杂时。某些情况下，使用 `auto` 可以使代码更易读，因为它隐藏了不必要的类型细节。如果变量的类型在未来发生变化，使用 `auto` 可以减少需要修改的代码量。

- **`constexpr`**：`constexpr` 修饰的变量要求在编译期就完成计算。也就是说，编译器会在编译阶段计算出 `N * sizeof(float)` 的结果，并将其值赋给 `size` 。如果表达式中的所有操作数和操作都能在编译期确定，那么编译器就会把这个常量表达式的值直接替换到使用该变量的地方，这对于提高程序运行效率很有帮助，比如可以用于数组维度等需要编译期常量的场景 。
- **`const`**：`const` 修饰的变量虽然也是常量，值一旦初始化就不能再改变，但它的计算可以在运行期进行。例如，如果 `N` 是一个通过函数调用得到的返回值，那么 `const size_t size = N * sizeof(float);` 这条语句会在运行到该语句时才计算出 `size` 的值。

**`constexpr`**：常用于模板元编程、定义编译期常量数组的大小、编译期计算数学表达式等场景。例如

```C
constexpr size_t N = 10;
constexpr size_t arrSize = N * sizeof(float);
float arr[arrSize]; // 合法，arrSize是编译期常量
```

**`const`**：适用于那些值在程序运行过程中不改变，但不需要在编译期就确定具体值的情况。例如：

```c++
size_t getSize() {
    return 10;
}
int main() {
    const size_t size = getSize() * sizeof(float);
    // 这里getSize()在运行期调用，size在运行期确定值
    return 0;
}
```

指针最常见的两大问题是：未分配内存就使用、越界使用

## C++语法

reinterpret_cast 没有去掉 const 限制的作用。

`__restrict__` 是一个指针修饰符，用来告诉编译器：“这个指针是唯一访问对应内存的途径，**不会和其他指针别名**。

这样做的好处：

1. **优化加载/存储指令**
   编译器可以安全地提前加载或向量化，不必担心其他指针修改数据。
2. **减少寄存器或共享内存冲突**
   对 CUDA kernel 性能影响很大，尤其是全局内存访问密集的核函数，比如你这个 `renderCUDA`。

```c
// 将value限制在[min_thersold, max_thersold]
min(max_thersold, max(min_thersold, value))
```

move 语义、左值和右值

引用传递`T &`：引用是变量的 “别名”，声明时必须初始化(绑定到一个变量)，之后对引用的操作等价于对原变量的操作。设计初衷是解决指针传递的语法繁琐问题(无需显式解引用`*`)，同时保留 “直接操作原变量” 的特性，兼顾安全性和简洁性。

常量引用`const T &`：不能通过引用修改原变量的引用(“只读别名”)，可以绑定到常量、临时对象或变量。在避免值传递拷贝开销的同时，保证原对象不被意外修改(“const 正确性”)，还能接收临时对象(值传递或指针传递无法直接做到)。

引用在**汇编层面通常被编译为指针**(存储变量的地址)，但语法上被限制为 “必须初始化、不能为 null、不能重新绑定”。由于这三个限制，还是有一些情况必须使用指针传递：允许参数无值(nullptr)、需要修改指针本身的指向、与 C 语言的接口、不定长数组。也还是有一些情况必须使用值传递：深拷贝。

值传递的本质是 **“传递数据副本”**。

不能返回指针或引用的情况：函数内部创建的临时对象，返回其指针或引用会导致 “悬垂引用”(指向已销毁的内存)，而值传递返回副本则安全。

拷贝构造函数是一种**特殊的构造函数**，用于**用已存在的对象初始化新对象**。它的参数是当前类的引用(通常是`const`引用)。**默认拷贝构造函数**：如果用户未自定义，编译器会自动生成一个，实现**浅拷贝**(直接复制成员变量的值)。

```cpp
class MyClass {
public:
    // 拷贝构造函数
    MyClass(const MyClass& other) {
        // 复制other的成员到当前对象
    }
};
```

浅拷贝和深拷贝的核心差异在于**是否对 “动态分配的资源”(如堆内存、文件句柄等)进行独立复制**。浅拷贝仅复制对象成员变量的 “值”，对于指针类型的成员，只复制指针的地址(即两个对象的指针指向同一块内存)。当两个对象销毁时，会对同一块内存执行两次`delete`，导致**内存泄漏或程序崩溃**。深拷贝不仅复制成员变量的值，对于指针类型的成员，会**重新分配一块新的内存**，并将原内存中的内容复制到新内存中，最终两个对象的指针指向**独立的内存块**。两个对象的资源完全独立，销毁时各自释放自己的内存，避免冲突。深拷贝，或需要独立副本的核心原因是**避免多个对象共享 “动态分配的资源”**。

---

FSM

### 什么是状态机？

状态机其实是一种特殊的设计模式，甚至都不能算是一种算法，其本质是将事物抽象出不同的状态而形成的一个数学模型，比如我们可以使用一个 LED 为例来理解一个最简单的二状态状态机。

LED 状态机

非常容易理解，作为一个 LED，它有着:color[开]{color="red"}和:color[关]{color="red"}两种状态，而当:color[按钮被按下]{color="blue"}时，LED 就:color[点亮]{color="purple"}，当:color[按钮抬起]{color="blue"}时，LED 就:color[熄灭]{color="purple"}

在上面的例子中我们实际已经接触到了状态机的三个基本概念，即:color[状态]{color="red"}:color[事件]{color="blue"}和:color[动作]{color="purple"}，事实上状态机还有另一个基本概念:color[转移]{color="gold"}，这在之后的例子中会有介绍。

### 状态机有什么用？

我们不妨先假设，我们现在要设计一个洗衣机，他只有四种状态(关机、待机、低速和高速)和三个按钮(电源，高速，低速)，关机状态下按电源可以进入待机模式，待机模式下按低速、高速分别可以进入低速、高速模式，高速和低速模式之间为了保护电机不能直接进行装换，必须先按下电源键进入待机模式，待机模式再按电源键则关机。

看起来挺复杂的是吧，但这实际上已经是嵌入式领域非常简单的一个例子了，真实的模式切换和处理要比这复杂得多。为了对比，我们先看看用最简单的裸机程序和 SWITCH 结构如何处理。

代码大概长这样：

```
typedef enum {
    ShutDown,
    StandBy,
    LowSpeed,
    HighSpeed,
} WashMachineStates;

WashMachineStates last_state = ShutDown;
WashMachineStates now_state = ShutDown;

int main() {
// 一些初始化内容
    while (true) {
        if (now_state != last_state) {
// 状态变化时的处理，例如从待机状态进入低速状态时，需要关闭待机灯，打开低速灯// 并启动低速转动电机等等
        }
        last_state = now_state;
        switch (now_state) {
            case ShutDown:
            case StandBy:
                break;
            case LowSpeed:
// 控制电机低速转动
                break;
            case HighSpeed:
// 控制电机高速转动
                break;
        }
    }
}

// 电源键中断
void InterruptPower() {
    switch (now_state) {
        case ShutDown:
            now_state = StandBy;
            break;
        case StandBy:
            now_state = ShutDown;
            break;
        case LowSpeed:
        case HighSpeed:
            now_state = StandBy;
            break;
    }
}

// 低速键中断
void InterruptLowSpeed() {
    switch (now_state) {
        case ShutDown:
        case HighSpeed:
        case LowSpeed:
            break;
        case StandBy:
            now_state = LowSpeed;
            break;
    }
}

// 高速键中断
void InterruptHighSpeed() {
    switch (now_state) {
        case ShutDown:
        case HighSpeed:
        case LowSpeed:
            break;
        case StandBy:
            now_state = HighSpeed;
            break;
    }
}
```

看起来似乎还不错是吧，但这是省略了很多状态切换(这就是上文中提到的:color[转移]{color="gold"})和硬件控制之后的代码，如果此时需要添加一种状态呢？或者如果我们要处理的状态远远多于四五种而是十数种呢？大家家里的洗衣机应该都至少有七八种模式吧？

这就要请出我们的状态机了，我们先不考虑具体实践，仅仅先把洗衣机当做一个状态机处理：

```
typedef enum {
    Power, LowSpeed, HighSpeed
} EventType;

StateMachine WashMachine;

int main() {
    WashMachine.init();
    while (true) {
        WashMachine.act(); // 执行状态机的 ”动作“
    }
}

// 电源键中断
void InterruptPower() {
    WashMachine.eventHandle(Power); // 处理事件
}

// 低速键中断
void InterruptLowSpeed() {
    WashMachine.eventHandle(LowSpeed); // 处理事件
}

// 高速键中断
void InterruptHighSpeed() {
    WashMachine.eventHandle(HighSpeed); // 处理事件
}
```

而状态切换和不同状态的动作则在初始化时设置：

```
// 设置状态切换表，这部分在具体实现会讲
WashMachineStates EventHandleMap[3][4] = {
        // ShutDown, StandBy, LowSpeed, HighSpeed
        {StandBy,  ShutDown,  StandBy,  StandBy}, // PowerEvent
        {ShutDown, LowSpeed,  LowSpeed, HighSpeed}, // LowSpeedEvent
        {ShutDown, HighSpeed, LowSpeed, HighSpeed}, // HighSpeedEvent
};

typedef void (*voidFunction)();

voidFunction StateTransitionFunctionMap[4][4] = {
        // ShutDown,          StandBy,            LowSpeed,            HighSpeed
        {nullptr,           ShutDownToStandBy,  nullptr,           nullptr},             // ShutDown
        {StandByToShutDown, nullptr,            StandByToLowSpeed, StandByToHighSpeed},  // StandBy
        {nullptr,           LowSpeedToStandBy,  nullptr,           nullptr},             // LowSpeed
        {nullptr,           HighSpeedToStandBy, nullptr,           nullptr},             // HighSpeed
};

void FromShutDownToLowSpeed() {
    // 从关机到低速的转移动作，比如开启电源，点亮屏幕等
}
//...
```

代码似乎变多了，但是如果此时我们需要增加一种状态呢？我们的三个中断函数和 main 函数根本不需要更改，我们只需要在两个表中添加一些列，一些行，并单独实现对应的动作和状态切换函数就可以了。

其实如果我们将原来的裸机版本进行“提高内聚”和“降低耦合”处理也可以得到相似的代码，再经过一些小小的优化我们就能“自己推导”出所谓的状态机。这也是我们在进行代码审查和重构时的重要优化方向，即先实现后优化，高内聚低耦合，抽象共性的，具体个性的。

如果配合上状态转换图或状态转换表，一切就更加简单了：

状态转换图

状态转换表

我们需要的就仅仅只是分析状态，绘制状态图然后照猫画虎即可

### 如何实现

简单的实现其实仅仅看上面的代码就已经能猜到个大概了，无非就是建表，然后在 eventHandle 和 act 函数中查表，转换对应的状态、执行对应的函数即可(事实上对于简单的实现，我们可以把状态切换作为切换动作的一部分从而减少一张表)

### ELSE

事实上，正如本文最开始所说，状态机只是一种处理问题或组织代码的方式，你可以用它解决任何问题，在算法领域，很多看似和“状态”毫无干系的问题都可以通过状态机(状态转移)来处理，比如如何判断输入字符串是一个符合 C 语法的 int 或 float 类型

---

C++模板元编程的单位系统

C++的模板元编程(Template Metaprogramming，TMP)是一种强大的技术，它允许程序在编译时而非运行时执行计算和逻辑。同时，在实现强类型的单位系统方面，TMP 提供了独特的优势。本文将探讨使用 C++模板元编程实现单位系统的基本原理和优势，并以新框架为例介绍如何使用该技术实现编译期量纲分析。

阅读本文前，请确保您对 C++以及 C++模板元编程技术有着基本了解：

1. 基础的 C++知识
2. C++模板的基本使用
3. C++模板元编程(TMP)的基本概念
4. 基本的物理单位和量纲(SI 单位制)
5. C++编译器和编译过程(主要是处理模板)的基本知识 \*

### 单位系统的实现原理

使用 c++的模板实现一个单位系统有很多种方式，这里主要关注如何实现一个强类型的单位系统，也即拥有完全的类型安全和强效的编译期错误检查。

事实上，弱类型的单位系统在某种程度上已经不符合我们开发这样一套系统的初衷了，比如你可以很简单地(甚至不需要模板)实现一个弱类型单位系统，只需要：

```
typedef float second;
typedef float millisecond;
...
```

然后，保持单位一致性和正确性就只能依赖于程序员自己的约束和文档说明了。而我在阅读了队内的几套代码之后就对所谓的“遵循开发规范”不抱任何希望了[doge](这也是新框架的开发理念之一：比起相信后来者会遵循我们定下的规范，不如从代码层面阻断不规范的行为)

没用的话说了一堆，接下来进入正题：

实现强类型的单位并不难，最简单的做法就是：

```
// 定义一个基类 Unit，代表通用的单位属性
class Unit {
protected:
    double value;

public:
    explicit Unit(double value) : value(value) {}

    double getValue() const {
        return value;
    }
};

// 定义秒(Second)类
class Second : public Unit {
public:
    explicit Second(double value) : Unit(value) {}

    // 秒到毫秒的转换
    double toMillisecond() const {
        return value * 1000.0;
    }
};

// 定义毫秒(Millisecond)类
class Millisecond : public Unit {
public:
    explicit Millisecond(double value) : Unit(value) {}

    // 毫秒到秒的转换
    double toSecond() const {
        return value / 1000.0;
    }
};
```

我们已经构建了一个基础的单位系统，包含了“秒”和“毫秒”两种时间单位。基于这个模型，我们可以进一步拓展出完整的时间单位体系。为此，我们可以在 `Unit` 基类和具体的时间单位类(如 `Second` 和 `Millisecond`)之间引入一个中间的 `Time` 类。采用类似的方法，我们还能够开发出表示长度、质量等其他物理量的 `Length` 类、`Mass` 类等。

然而，这种方法的一个明显缺点是，随着不同单位数量的增加，所需实现的单位间转换函数数量呈平方级增长(即 $$n^$$ 级别)，其中 `n` 是单位的种类数。这不仅增加了代码的复杂性，而且可能导致维护难度的显著增加。尤其是当涉及到大量相互转换的单位时，每个单位类中都需要实现与其他所有单位的转换函数，这无疑会导致代码膨胀和管理上的困难。

聪明的同学可能已经想到了，我们可以为每一个单位类添加一个“比率”成员来实现动态的单位间转换而不必静态的创建一大堆的转换函数：

```
// 定义一个基类 Unit，代表通用的单位属性和转换方法
class Unit {
protected:
    double value;  // 单位的数值
    double ratio;  // 相对于基准单位
public:
    explicit Unit(double value, double ratio) : value(value), ratio(ratio) {}

    // 将任意单位转换为基准单位(秒)的值
    double toBaseUnit() const {
        return value * ratio;
    }

    // 从基准单位(秒)转换到当前单位
    void fromBaseUnit(double baseValue) {
        value = baseValue / ratio;
    }

    double getValue() const {
        return value;
    }
};

// 定义秒(Second)类
class Second : public Unit {
public:
    explicit Second(double value) : Unit(value, 1.0) {}  // 秒的比率设为1
};

// 定义毫秒(Millisecond)类
class Millisecond : public Unit {
public:
    explicit Millisecond(double value) : Unit(value, 0.001) {}  // 毫秒的比率为0.001
};
```

看起来好多了是不是，现在我们只需要把我们需要的各种单位都抽象成对应的类就可以了，但很快我们就又遇到了问题，一是单位间的转换虽然可以使用更统一的接口了，但依然很麻烦，而且性能并不如手写版本(本文中的手写版本均指依靠程序员自己心中有单位的写法)，二是扩展性和维护性依然有着明显缺陷

聪明的同学可能又想到了，我们可以为每个类添加隐式转换来解决第一个问题，但这反而增加了程序员无意间触发隐式转换导致额外性能损耗的概率，而且类似

```
Second::operator Millisecond() const {
    return Millisecond(value * 1000.0);
}
```

的代码又将问题转回了一开始——代码膨胀

那我们该怎么办呢？好吧，这篇博客已经写得很长了，我就不在这一点一点给各位推导了，相信各位也能很容易得出我们可以使用模板来解决代码膨胀并同时将单位转换的开销尽可能转移到编译期的结论，以下是一个简单的例子：

```
##include <iostream>
##include <ratio>

// 基础单位模板
template<typename T, typename ConversionRatio>
class BasicUnit {
private:
    double value;  // 单位的值

public:
    explicit BasicUnit(double v) : value(v) {}

    // 获取原始值
    double getValue() const { return value; }

    // 转换为另一单位
    template<typename U>
    operator U() const {
        using CombinedRatio = std::ratio_divide<ConversionRatio, typename U::ConversionRatio>;
        return U(value * static_cast<double>(CombinedRatio::num) / static_cast<double>(CombinedRatio::den));
    }
};

// 定义秒和毫秒
using Second = BasicUnit<Second, std::ratio<1>>;
using Millisecond = BasicUnit<Millisecond, std::ratio<1, 1000>>;

int main() {
    Second sec(1);  // 1秒
    Millisecond msec = sec;  // 隐式转换为毫秒

    std::cout << "1 second is " << msec.getValue() << " milliseconds." << std::endl;

    Second secFromMsec = msec;  // 隐式转换回秒
    std::cout << msec.getValue() << " milliseconds is " << secFromMsec.getValue() << " seconds." << std::endl;

    return 0;
}
```

这里使用了`std::ratio` ，一方面使用编译时整数算术，可以提供比浮点算术更精确的比率表示，另一方面由于转换逻辑在编译时通过模板和 `std::ratio` 确定，编译器可以优化相关计算。相比于运行时动态计算转换比例，编译时的静态计算可以减少一些运行时开销。类似于使用：

```
int a = 1.0f;
float b = 1;
```

理论上是完全没有运行时开销的，接下来我们实现不同物理量的单位：

```
##include <iostream>
##include <ratio>

// 定义用于区分不同物理量的空结构体
struct TimeTag {};
struct LengthTag {};

// 基础物理量单位模板
template<typename Tag, typename ConversionRatio>
class PhysicalUnit {
private:
    double value;  // 物理量的值

public:
    explicit PhysicalUnit(double v) : value(v) {}

    // 获取原始值
    double getValue() const { return value; }

    // 转换为另一单位
    template<typename U>
    U to() const {
        using CombinedRatio = std::ratio_divide<ConversionRatio, typename U::ConversionRatio>;
        return U(value * static_cast<double>(CombinedRatio::num) / static_cast<double>(CombinedRatio::den));
    }
};

// 时间单位
using Second = PhysicalUnit<TimeTag, std::ratio<1>>;
using Millisecond = PhysicalUnit<TimeTag, std::ratio<1, 1000>>;

// 长度单位
using Meter = PhysicalUnit<LengthTag, std::ratio<1>>;
using Millimeter = PhysicalUnit<LengthTag, std::ratio<1, 1000>>;

int main() {
    Second sec(1);  // 1秒
    Millisecond msec = sec.to<Millisecond>();  // 转换为毫秒

    std::cout << "1 second is " << msec.getValue() << " milliseconds." << std::endl;

    Meter m(1);  // 1米
    Millimeter mm = m.to<Millimeter>();  // 转换为毫米

    std::cout << "1 meter is " << mm.getValue() << " millimeters." << std::endl;

    return 0;
}
```

这里使用了模板元编程中的“类型标签”技巧，通过`TimeTag` 这样的空结构体作为“类型标签”在编译时区分不同类型。

以此类推我们可以构造出七个基本单位，以及相应的添加了词头的单位，比如`km`，`mm`等

接着我们尝试实现带量纲分析的导出单位，比如速度：

```
##include <iostream>
##include <ratio>

// 基本量纲
struct Length {};
struct Time {};

// 复合单位模板
template<typename L, int LPower, typename T, int TPower>
class Unit {
    double value;
public:
    explicit Unit(double v) : value(v) {}

    double getValue() const { return value; }

    // 转换方法(略)
};

// 基本单位
using Meters = Unit<Length, 1, Time, 0>;
using Seconds = Unit<Length, 0, Time, 1>;

// 派生单位：速度
using MetersPerSecond = Unit<Length, 1, Time, -1>;

int main() {
    Meters m(100); // 100米
    Seconds s(20); // 20秒

    // 计算速度
    MetersPerSecond speed(m.getValue() / s.getValue());
    std::cout << "Speed: " << speed.getValue() << " meters per second" << std::endl;

    return 0;
}
```

相信之后的种种就不用我多赘述了，代码示例给到这里应该已经完全足够各位自己实现一个单位系统了，那接下来我就说说一些新框架中使用到的提高单位系统使用体验的技巧以及使用这样一套系统的优势：

### 使用体验以及优势

1. 用户定义字面量

用户定义字面量(User-Defined Literals, UDL)是 C++11 中引入的一种特性，允许程序员为字面量值(如整数、浮点数、字符串等)提供自定义的后缀，从而定义这些字面量的类型和行为。

用户定义字面量通过重载运算符 `""` 来实现。这个重载可以是全局的，也可以在类中作为静态成员函数实现。比如：

```
operator"" _cm(long double x) {return x * 10;}long double
operator"" _m(long double x) {return x * 1000;}long double
operator"" _mm(long double x) {return x;}

// height = 30.0
auto height = 3.0_cm;
// length = 1230.0
auto length = 1.23_m;
```

由此，我们可以实现(该代码示例使用新框架)：

```
void UnitsExample() {
    using namespace units::literals;

    auto length = 114514_m;
    auto time   = 1919_s;
    infantry::cout << "Length of the beast is " << length << infantry::endl;
    infantry::cout << "Time of the beast is " << time << infantry::endl;
}
```

输出为：

1. 运算符重载

C++中，所有的运算符都可以理解为一个函数，并支持重载，故此我们可以重载基本运算符，实现`MATLAB`一般的运算体验：

```
void UnitsExample() {
    using namespace units::literals;

    auto length = 114514_m;
    auto time   = 1919_s;
    infantry::cout << "Speed of the beast is " << length / time << infantry::endl;
}
```

1. 类型安全(自动量纲分析)

对于涉及到现实世界物理量的计算(尤其是搞 RM 这种要和各种物理量打交道的)，使用单位系统可以在编译期就进行量纲分析，避免低级错误，同时提高代码的可读性和可维护性：

```
void UnitsExample() {
    using namespace units::literals;
    using namespace units::length;

    meter_t  area = 15_m * 5_m + 10_m * 10_m;
}
```

编译报错：

显然面积的单位应该是$$m^$$而不是$$$$，在涉及到力矩、电流、功率等复杂物理量的计算以及复杂控制算法的时候，量纲分析可以为我们减少很多不必要的错误

1. 更易维护、更具可读性的代码

对于很多需要对传入参数有单位要求(或输出特定单位)的函数，我们以前一般是这样做的：

```
void UnitsExample() {
    delay_s(1);//延时 1 秒delay_ms(1);//延时 1 毫秒delay_us(1);//延时 1 微秒auto a = math::sin(1.0f);// 这里的 1.0f 到底是什么单位？？？auto b = math::sin_rad(PI);// 要么查文档看源码，要么和延时一样直接写在函数名里auto c = math::sin_deg(180.0f);// 要么查文档看源码，要么和延时一样直接写在函数名里
}
```

但是使用了单位系统之后：

```
void UnitsExample() {
    delay(1_s);//延时 1 秒delay(1_ms);//延时 1 毫秒delay(1_us);//延时 1 微秒auto a = infantry::math::sin(45_deg);
    auto b = infantry::math::sin(units::angle::radian_t(3.1415926) / 4);
// auto b = infantry::math::sin(0.785398163397448_rad);infantry::cout << "sin(45 deg) is " << a << infantry::endl;
    infantry::cout << "sin(PI / 4 rad) is " << b << infantry::endl;
}
```

输出：

再也不会出现单位用错的尴尬了是不是

1. 优化后无运行时开销且精度无损

```
void UnitsExample() {
    using namespace units::literals;

    auto x  = 1.0f;
    auto y  = 2.0f;
    auto z  = 3.0f;
    auto xu = 1.0_rad;
    auto yu = 2.0_rad;
    auto zu = 1_rad * 3_rad;

    using namespace units::time;
    auto begin = infantry::DwtDevice::getInstancePtr()->getTime(),
         end   = infantry::DwtDevice::getInstancePtr()->getTime();

    begin = infantry::DwtDevice::getInstancePtr()->getTime();
    for (int t = 0; t < 10; t++) {
        for (int i = 0; i < 10000; i++) {
            z += x * y;
        }
    }
    end = infantry::DwtDevice::getInstancePtr()->getTime();
    infantry::cout << z << infantry::endl;
    infantry::cout << "float:" << (end - begin) / 10 / 10000 << infantry::endl;

    begin = infantry::DwtDevice::getInstancePtr()->getTime();
    for (int t = 0; t < 10; t++) {
        for (int i = 0; i < 10000; i++) {
            zu += xu * yu;
        }
    }
    end = infantry::DwtDevice::getInstancePtr()->getTime();
    infantry::cout << zu << infantry::endl;
    infantry::cout << "unit:" << (end - begin) / 10 / 10000 << infantry::endl;
}
```

1. 空间开销较小

这一部分就不用示例解释了

1. 其他

减少魔术数字，比如曾经的队内代码里有一堆莫名其妙的数字配上莫名其妙的变量名

易于移植，因为是纯模板实现即"Header-Only"，所以理论上可以随意轻松的到处移植，比如新框架所使用的

https://github.com/nholthaus/units?tab=readme-ov-file

就只有一个头文件，类似的还有`BOOST/units`

##### C 语言编译全过程

[CubeMX+VSCode+Ozone 的 STM32 开发工作流(一)背景知识介绍\_ozone gdb-CSDN 博客](https://blog.csdn.net/NeoZng/article/details/127980878?spm=1001.2014.3001.5502)

[CubeMX+VSCode+Ozone 的 STM32 开发工作流(二)VSCode 环境配置\_fpv4-sp-d16-CSDN 博客](https://blog.csdn.net/NeoZng/article/details/127980896?spm=1001.2014.3001.5502)

[CubeMX+VSCode+Ozone 的 STM32 开发工作流(三)利用 Ozone 进行可视化调试和代码分析\_ozone jlink-CSDN 博客](https://blog.csdn.net/NeoZng/article/details/127980949)

C 语言代码由固定的词汇(关键字)按照固定的格式(语法)组织起来，简单直观，程序员容易识别和理解，但是 CPU 只能识别二进制形式的指令，并且这些指令是和硬件相关的，也就是所谓的指令集。这就需要一个工具，将 C 语言代码转换成 CPU 能够识别的二进制指令，对于我们的 x86 平台 windows 下的程序就是.exe 后缀的文件；对于单片机，一般来说是.bin 或.hex 等格式的文件(调试文件包括 axf 和 elf)。

能够完成这个转化过程的工具是一个特殊的软件，叫做编译器(Compiler)。常见的编译器包括开源的 GNU GCC，windows 下微软开发的 visual C++，以及 apple 主导的 llvm/clang。编译器能够识别代码中的关键字、表达式以及各种特定的格式，并将他们转换成特定的符号，也就是汇编语言(再次注意汇编语言是平台特定的)，这个过程称为编译(Compile)。

对于单个.c 文件，从 C 语言开始到单片机可识别的.bin 文件，一般要经历以下几步：

首先是编译预处理 Preprocessing，这一步会展开宏并删除注释，将多余的空格去除。预处理之后会生成.i 文件。

然后，开始编译 Compilation 的工作。编译器会将源代码进行语法分析、词法分析、语义分析等，根据编译设置进行性能优化，然后生成汇编代码.s 文件。汇编代码仍然是以助记符的形式记录的文本，比如将某个地址的数据加载到 CPU 寄存器等，还需要进一步翻译成二进制代码。

下一步就是进行汇编 Assemble，编译器会根据汇编助记符和机器代码的查找表将所有符号进行替换，生成.o .obj 等文件。但请注意，这些文件并不能直接使用(烧录)，我们在编写代码的时候，都会包含一些库，因此编译结果应当有多个.o 文件。我们还需要一种方法将这些目标文件缝合在一起，使得在遇到函数调用的时候，程序可以正确地跳转到对应的地方执行。

最后一步就由链接器 Linker(也称 LD)完成，称为链接 Linking。比如你编写了一个 motor.c 文件和.h 文件，并在 main.c 中包含了 motor.h，使用了后者提供的 MotorControl()函数。那么，链接器会根据编译器生成.obj 文件时留下的函数入口地址，将 main.o 里的调用映射到生成的 motor.o 中。链接完成后，就生成了单片机可以识别的可执行文件，通过支持的串口或下载器烧录，便可以运行。

另外，上图可以看到左侧的 静态库，包括 .lib .a，比如我们在 STM32 中使用的 DSP 运算库就是这种文件。他在本质上和.o 文件相同，只要你在你编写的源文件中包含了这些库的头文件，链接器就可以根据映射关系找到头文件中声明的函数在库文件的地址。(直接提供库而不是.c 文件，就可以防止源代码泄露，因此一些不开源的程序会提供函数调用的头文件和接口具体实现的库；你也可以编写自己的库，感兴趣自行搜索)

链接之后，实际上还要进行不同代码片段的重组、地址重映射，详细的内容请参看：[C/C++语言编译链接过程](https://zhuanlan.zhihu.com/p/88255667)，这篇教程还提供了以 GCC 为例的代码编译示例。

##### C 语言内存模型

以上是 C 语言常见的内存模型，即 C 语言的代码块以及运行时使用的内存(包括函数、变量等)的组织方式。

有些平台的图与此相反，栈在最下面(内存低地址)，其他区域都倒置，不影响我们理解

代码段即我们编写的代码，也就是前面说的编译和链接之后最终生成的可执行文件占据的空间。一些常量，包括字符串和使用 const 关键字修饰的变量被放在常量存储区。static 修饰的静态变量(包括函数静态变量和文件静态变量)以及全局变量放在常量区上面一点的全局区(也称静态区)。

然后就是最重要的堆和栈。在一个代码块内定义的变量会被放在栈区，一旦离开作用域(出了它被定义的{}的区域)，就会立刻被销毁。在调用函数或进入一个用户自定义的{}块，都会在栈上开辟一块新的空间，空间的大小和内存分配由操作系统或 C 库自动管理。一般来说，直接通过变量访问栈内存，速度最快(对于单片机)。而堆则是存储程序员自行分配的变量的地方，即使用 malloc(),realloc() ,new 等方法获取的空间，都被分配在这里。

在 CubeMX 初始化的时候，Project mananger 标签页下有一个 Linker Setting 的选项，这里是设置最小堆内存和栈内存的地方。如果你的程序里写了大规模的数组，或使用 malloc()等分配了大量的空间，可能出现栈溢出或堆挤占栈空间的情况。需要根据 MCU 的资源大小，设置合适的 stack size 和 heap size。

RTOS 创建任务的时候也会为每个任务分配一定的栈空间，它会替代 MCU 的硬件裸机进行内存的分配。可以在 CubeMX 中设置。如果一个任务里定义了大量的变量，可能导致实时系统运行异常，请增大栈空间。

##### C 语言标准和编译器

不同的 C 语言标准(一般以年份作代号)支持的语法特性和关键字不同，拥有的功能也不同。一般来说语言标准都是向前兼容的，在更新之后仍然会保存前代的基本功能支持(legacy support)。不过，为了程序能够正常运行，我们还需要一些硬件或平台支持的组件。比如 malloc()这个函数，在 linux 平台和 windows 平台上的具体实现就相去甚远，跟单片机更是差了不止一点。前两者一般和对应的操作系统有关，后者在裸机上则是直接通过硬件或 ST 公司提供的硬件抽象层代码实现。

然而，不同编译器提供的代码实现也不尽相同，比如使用 clang 和 gcc 这两种 c 语言编译器，他们对于一些标准库(也称 C 库，包括 stdio，stdlib，string 等在内的实现)的函数的实现就不太一样。再如\_\_packed 是 arm-cc 提供的一个字节不对齐关键字，在一些其他编译器中就不支持这种实现。

以前大家常用的 KEIL 使用的是 ARM 提供的 arm-cc 工具链(非常蛋疼，甚至不支持 uint8_t=0b00001111 这种二进制定义法)，而该教程选用的是开源的 Arm GNU Toolchain。在非目标机且和目标机平台不同的平台上进行开发被称为跨平台开发，进行的编译也被称为交叉编译(在一个平台上生成另一个平台上的 可执行代码)。

工具链包含了编译器，链接器以及调试器等开发常用组件。我们使用的 Arm GNU toolchain 中，编译器是 arm-none-eabi-gcc.exe，链接器是 arm-none-eabi-ld.exe，调试器则是 arm-none-eabi-gdb.exe。通过跨平台调试器和 j-link/st-link/dap-link，我们就可以在自己的电脑上对异构平台(即单片机)的运行进行调试了。

##### GCC 及其使用基础

Linux 系统下的 Gcc(GNU C Compiler)是 GNU 推出的功能强大、性能优越的多平台编译器，是 GNU 的代表作品之一。

gcc 是可以在多种硬体平台上编译出可执行程序的超级编译器，其执行效率与一般的编译器相比平均效率要高 20%~30%。

Gcc 编译器能将 C、C++语言源程序、汇程式化序和目标程序编译、连接成可执行文件，如果没有给出可执行文件的名字，gcc 将生成一个名为 a.out 的文件。

##### Makefile

[跟我一起写 Makefile:概述 - Ubuntu 中文](https://wiki.ubuntu.org.cn/跟我一起写Makefile:概述)

makefile 关系到了整个工程的编译规则。一个工程中的源文件不计其数，并且按类型、功能、模块分别放在若干个目录中，makefile 定义了一系列的规则来指定，哪些文件需要先编译，哪些文件需要后编译，哪些文件需要重新编译，甚至于进行更复杂的功能操作，因为 makefile 就像一个 Shell 脚本一样，其中也可以执行操作系统的命令。

makefile 带来的好处就是——“自动化编译”，一旦写好，只需要一个 make 命令，整个工程完全自动编译，极大的提高了软件开发的效率。 make 是一个命令工具，是一个解释 makefile 中指令的命令工具，一般来说，大多数的 IDE 都有这个命令，比如：Delphi 的 make， Visual C++的 nmake，Linux 下 GNU 的 make。可见，makefile 都成为了一种在工程方面的编译方法。

### makefile 的规则

```
target ... : prerequisites ...
        command
        ...
```

target 可以是一个 object file(目标文件)，也可以是一个执行文件，还可以是一个标签(label)。对于标签这种特性，在后续的“伪目标”章节中会有叙述。

prerequisites 就是，要生成那个 target 所需要的文件或是目标。

command 也就是 make 需要执行的命令。(任意的 shell 命令)

这是一个文件的依赖关系，也就是说，target 这一个或多个的目标文件依赖于 prerequisites 中的文件，其生成规则定义在 command 中。说白一点就是说，prerequisites 中如果有一个以上的文件比 target 文件要新的话，command 所定义的命令就会被执行。这就是 makefile 的规则。也就是 makefile 中最核心的内容。

### 在规则中使用通配符

如果我们想定义一系列比较类似的文件，我们很自然地就想起使用通配符。make 支持三个通配符：“\*”，“?”和“~”。这是和 Unix 的 B-Shell 是相同的。

波浪号(“~”)字符在文件名中也有比较特殊的用途。如果是“~/test”，这就表示当前用户的$HOME 目录下的 test 目录。而 “~hchen/test”则表示用户 hchen 的宿主目录下的 test 目录。(这些都是 Unix 下的小知识了，make 也支持)而在 Windows 或是 MS-DOS 下，用户没有宿主目录，那么波浪号所指的目录则根据环境变量“HOME”而定。

通配符代替了你一系列的文件，如“_.c”表示所有后缀为 c 的文件。一个需要我们注意的是，如果我们的文件名中有通配符，如：“_”，那么可以用转义字符“\”，如“\*”来表示真实的“\*”字符，而不是任意长度的字符串。

### make 是如何工作的

在默认的方式下，也就是我们只输入 make 命令。那么，

1. make 会在当前目录下找名字叫“Makefile”或“makefile”的文件。
2. 如果找到，它会找文件中的第一个目标文件(target)，在上面的例子中，他会找到“edit”这个文件，并把这个文件作为最终的目标文件。
3. 如果 edit 文件不存在，或是 edit 所依赖的后面的 .o 文件的文件修改时间要比 edit 这个文件新，那么，他就会执行后面所定义的命令来生成 edit 这个文件。
4. 如果 edit 所依赖的.o 文件也不存在，那么 make 会在当前文件中找目标为.o 文件的依赖性，如果找到则再根据那一个规则生成.o 文件。(这有点像一个堆栈的过程)
5. 当然，你的 C 文件和 H 文件是存在的啦，于是 make 会生成 .o 文件，然后再用 .o 文件生成 make 的终极任务，也就是执行文件 edit 了。

这就是整个 make 的依赖性，make 会一层又一层地去找文件的依赖关系，直到最终编译出第一个目标文件。在找寻的过程中，如果出现错误，比如最后被依赖的文件找不到，那么 make 就会直接退出，并报错，而对于所定义的命令的错误，或是编译不成功，make 根本不理。make 只管文件的依赖性，即，如果在我找了依赖关系之后，冒号后面的文件还是不在，那么对不起，我就不工作啦。

通过上述分析，我们知道，像 clean 这种，没有被第一个目标文件直接或间接关联，那么它后面所定义的命令将不会被自动执行，不过，我们可以显式要 make 执行。即命令——“make clean”，以此来清除所有的目标文件，以便重编译。

### makefile 中使用变量

如果我们的工程需要加入一个新的[.o]文件，那么我们需要在两个地方加(应该是三个地方，还有一个地方在 clean 中)。当然，我们的 makefile 并不复杂，所以在两个地方加也不累，但如果 makefile 变得复杂，那么我们就有可能会忘掉一个需要加入的地方，而导致编译失败。所以，为了 makefile 的易维护，在 makefile 中我们可以使用变量。makefile 的变量也就是一个字符串，理解成 C 语言中的宏可能会更好。

### 让 make 自动推导

GNU 的 make 很强大，它可以自动推导文件以及文件依赖关系后面的命令，于是我们就没必要去在每一个[.o]文件后都写上类似的命令，因为，我们的 make 会自动识别，并自己推导命令。

只要 make 看到一个[.o]文件，它就会自动的把[.c]文件加在依赖关系中，如果 make 找到一个 whatever.o，那么 whatever.c，就会是 whatever.o 的依赖文件。并且 cc -c whatever.c 也会被推导出来，于是，我们的 makefile 再也不用写得这么复杂。这种方法，也就是 make 的“隐晦规则”。

### Makefile 里有什么？

Makefile 里主要包含了五个东西：显式规则、隐晦规则、变量定义、文件指示和注释。

1. 显式规则。显式规则说明了，如何生成一个或多个目标文件。这是由 Makefile 的书写者明显指出，要生成的文件，文件的依赖文件，生成的命令。
2. 隐晦规则。由于我们的 make 有自动推导的功能，所以隐晦的规则可以让我们比较简略地书写 Makefile，这是由 make 所支持的。
3. 变量的定义。在 Makefile 中我们要定义一系列的变量，变量一般都是字符串，这个有点像你 C 语言中的宏，当 Makefile 被执行时，其中的变量都会被扩展到相应的引用位置上。
4. 文件指示。其包括了三个部分，一个是在一个 Makefile 中引用另一个 Makefile，就像 C 语言中的 include 一样；另一个是指根据某些情况指定 Makefile 中的有效部分，就像 C 语言中的预编译##if 一样；还有就是定义一个多行的命令。有关这一部分的内容，我会在后续的部分中讲述。
5. 注释。Makefile 中只有行注释，和 UNIX 的 Shell 脚本一样，其注释是用“##”字符，这个就像 C/C++中的“//”一样。如果你要在你的 Makefile 中使用“##”字符，可以用反斜杠进行转义，如：“\##”。

最后，还值得一提的是，在 Makefile 中的命令，必须要以[Tab]键开始。

### 引用其它的 Makefile

在 Makefile 使用 include 关键字可以把别的 Makefile 包含进来，这很像 C 语言的##include，被包含的文件会原模原样的放在当前文件的包含位置。include 的语法是：

include <filename>;

filename 可以是当前操作系统 Shell 的文件模式(可以包含路径和通配符)

### make 的工作方式

GNU 的 make 工作时的执行步骤如下：(想来其它的 make 也是类似)

1. 读入所有的 Makefile。
2. 读入被 include 的其它 Makefile。
3. 初始化文件中的变量。
4. 推导隐晦规则，并分析所有规则。
5. 为所有的目标文件创建依赖关系链。
6. 根据依赖关系，决定哪些目标要重新生成。
7. 执行生成命令。

1-5 步为第一个阶段，6-7 为第二个阶段。第一个阶段中，如果定义的变量被使用了，那么，make 会把其展开在使用的位置。但 make 并不会完全马上展开，make 使用的是拖延战术，如果变量出现在依赖关系的规则中，那么仅当这条依赖被决定要使用了，变量才会在其内部展开。

在一些大的工程中，有大量的源文件，我们通常的做法是把这许多的源文件分类，并存放在不同的目录中。所以，当 make 需要去找寻文件的依赖关系时，你可以在文件前加上路径，但最好的方法是把一个路径告诉 make，让 make 自动去找。

Makefile 文件中的特殊变量“VPATH”就是完成这个功能的，如果没有指明这个变量，make 只会在当前的目录中去找寻依赖文件和目标文件。如果定义了这个变量，那么，make 就会在当前目录找不到的情况下，到所指定的目录中去找寻文件了。

### 命名规范

类名和函数名首字母大写，模块和功能之间用下划线分隔

对象名用帕斯卡命名法

类中的子类或结构体用驼峰命名法，成员变量全小写

全局变量首字母大写，模块和功能之间用下划线分隔

局部变量全小写

### GCC

GCC(GNU Compiler Collection)是 GNU 工具链的主要部分，是一个程序语言编译器自由软件。

gcc，g++分别是 GCC 中的 C 编译器和 C++编译器

### 编译原理

C 语言编译原理涉及将 C 语言代码转换为机器语言的过程。这个过程包括预处理、编译、汇编和链接。编译器在这个过程中对源代码进行优化和转换，生成可执行文件，主要包括以下几个阶段：

1. 预处理(Preprocessing)

   1. 作用：处理源代码文件中的预处理指令，如`##include`和`##define`。
   2. 过程：替换宏定义，处理条件编译指令，包含头文件内容。
   3. 工具：预处理器，如 cpp、armclang。

2. 编译(Compilation)

   1. 作用：将预处理后的源代码转换成汇编语言。
   2. 过程：进行语法分析和语义分析，生成汇编代码。
   3. 工具：编译器，如 GCC、armclang。

3. 汇编(Assembly)

   1. 作用：将汇编语言转换成机器语言，即目标代码(Object Code)。
   2. 过程：汇编器将汇编指令转换为机器码。
   3. 工具：汇编器，如 as、armasm。

4. 链接(Linking)

   1. 作用：将多个目标代码文件和库文件合并成一个单独的可执行文件。

   2. 过程

      ：

      - 解决外部符号引用，如函数和全局变量。
      - 合并不同模块中的相同段(如`.text`，`.data`)。
      - 生成最终的可执行文件或库文件。

   3. 工具：链接器，如 ld、armlink。

在整个编译过程中，编译器和链接器是核心组件

- 编译器(Compiler)：负责将源代码转换成汇编代码或直接生成目标代码。编译器的高级优化包括循环优化、常数传播、死码删除等。
- 链接器(Linker)：负责将多个目标代码文件整合为一个可执行文件。链接器处理符号解析、重定位等任务。

.c/.cpp 预处理成.i

.i 编译成汇编文件.s

.s 汇编成目标文件.o

.o 链接成可执行文件.exe/无后缀

### 集成开发环境 IDE

集成开发环境是一种包含代码编辑器、编译器和调试器的综合性软件应用程序。IDE 提供了方便编写、测试和调试程序的一体化界面。

### C/C++混合编程

1. 名字修饰的差异

- C++支持函数重载，因此在编译时会对函数名进行修饰(添加额外的字符)，以区分同名但参数不同的函数。
- C 不支持函数重载，编译时不对函数名进行修饰。

1. 使用`extern "C"`指令

- 在 C++代码中，可以使用`extern "C"`告诉 C++编译器对于特定的代码(通常是函数声明)使用 C 风格的编译方式。这样，C 编译器在处理这些代码时不会进行名字修饰，使得 C 编译的代码能够被 C 编译器识别和链接。

1. 头文件的兼容性

- 在混合编程时，C++代码可以直接包含(include)C 语言的头文件。 但是，为了确保兼容性，通常在 C 的头文件中加入类似下图的代码这样的代码结构确保 C++编译器以 C 的方式处理这些声明，而 C 编译器则忽略这些特殊指令。

1. 对象内存模型和异常处理

- C++支持面向对象编程，其内存模型和异常处理机制与 C 不同，这也是后文中我们需要重载`new`和`delete`操作符的原因。
- 在混合编程时，需要注意对象的构造和析构，以及异常处理方式的差异。

## Learn C++

最重要的是：享受乐趣。编程可以充满乐趣，如果你通常没有从中获得乐趣，那你的编程心态就不对。疲惫或不开心的程序员容易犯错，而且调试代码往往比一开始就正确编写代码要花费长得多的时间！通常，你可以先去睡觉，睡个好觉，第二天早上再来解决问题，这样可以节省一些时间。

最佳实践是指你**应该**做的事情，因为这种做事方式要么是常规的(惯用的)，要么是被推荐的。也就是说，要么每个人都这么做(如果你不这么做，就会做出人们意想不到的事)，要么这种方式总体上优于其他选择。

C 和 C++的底层设计理念可以概括为“信任程序员”——这既美妙又危险。C++旨在赋予程序员高度的自由，让他们能够随心所欲地编程。然而，这也意味着该语言通常不会阻止你做一些看似不合理的事情，因为它会假定你这么做有其不为人知的原因。如果新程序员没有意识到，很可能会掉进不少陷阱。这就是为什么，在 C/C++中，知道不该做什么几乎和知道该做什么一样重要，这是主要原因之一。

不同的 C++ 版本通常指的就是常说的**C++ 标准**。这些标准由国际标准化组织(ISO)制定，通过正式文档规范 C++ 语言的语法、特性和行为，目的是确保代码在不同编译器和平台上的一致性。版本区别主要体现在**新增语法特性**、**标准库扩展**和**性能 / 安全性优化**上，实际开发中，需根据编译器支持情况(如 GCC、Clang、MSVC 对不同标准的兼容性)选择合适版本。

当你坐下来马上开始编码时，你通常会想“我想做<某件事>”，所以你会实现能最快达成目标的解决方案。这可能会导致程序很脆弱，日后难以更改或扩展，或者存在大量错误。**错误**是指任何一种会阻碍程序正确运行的编程失误。因此，在前期(开始编码之前)多花一点时间思考解决问题的最佳方法、你所做的假设以及如何为未来做规划是值得的，这样可以为你日后节省大量时间和避免许多麻烦。

由于源代码是使用 ASCII 字符编写的，编程语言会使用一定数量的 ASCII 艺术来表示数学概念。一些编程字体，如 [Fira Code](https://github.com/tonsky/FiraCode)，使用连字将这种 “艺术” 形式合并回单个字符。例如，Fira Code 不会显示 `!=`，而是显示 `≠`(与双字符版本宽度相同)。有些人觉得这样更易读，而另一些人则更喜欢直接显示底层字符。

程序中的每个代码文件会被编译成一个目标文件，然后这些目标文件会被链接成一个可执行文件。

一个**构建配置**(也称为**构建目标**)是项目设置的集合，它决定了 IDE 将如何构建您的项目。构建配置通常包括诸如可执行文件的命名、IDE 将在哪些目录中查找其他代码和库文件、是否保留或去除调试信息、编译器对程序的优化程度等内容。一般来说，除非有特殊原因需要更改某些设置，否则您可以将这些设置保留为默认值。

无类型指针是无类型的指针，即可以任意更改类型；但在使用时需要类型转换。

## 最佳实践

将每个程序中的第一个/主要源代码文件命名为 `main.cpp`。这样很容易确定哪个源代码文件是主要的。

不要让警告堆积。遇到警告时就解决它们(就当作它们是错误一样)。否则，关于严重问题的警告可能会淹没在关于非严重问题的警告之中。

对你的代码进行大量注释，并且在写注释时，要假设对方完全不知道这段代码的功能。不要以为自己以后还能记得当初为什么做出特定的选择。

constexpr:

- 原代码中`bx`被声明为`const int bx = 2`，它是一个运行时常量 —— 在程序运行时初始化，但其值不能被修改。
- 如果改为`constexpr int bx = 2`，则`bx`成为编译期常量 —— 其值在编译阶段就被确定，编译器可以基于此进行更多优化(例如直接将`bx`的值嵌入到生成的机器码中，无需在运行时分配内存存储)。

对于`bx`这类初始值固定、且后续不会修改的变量，使用`constexpr`的好处是：

1. 让代码意图更清晰：明确表示这是一个编译期就能确定的常量。
2. 可能带来轻微的性能优化：减少运行时的内存操作，编译器可基于已知的常量值进行更多优化(如常量折叠)。
3. 允许在需要编译期常量的场景中使用(例如模板参数、数组大小等)。

在你的代码中，`bx`、`by`、`bz`、`tx`、`ty`、`tz`都是初始值固定的常量，将它们声明为`constexpr`是更合适的做法，符合现代 C++ 的最佳实践。

检查指针是否为空，可以让代码更健壮。

```c++
// Purpose: Demonstrate NULL pointer initialization and safe usage.

// Key points:
// 1. Initialize pointers to NULL when they don't yet point to valid data.
// 2. Check pointers for NULL before using to avoid crashes.
// 3. NULL checks allow graceful handling of uninitialized or failed allocations.

#include <stdio.h>
#include <stdlib.h>

int main() {
    // Initialize pointer to NULL
    int* ptr = NULL;
    printf("1. Initial ptr value: %p\n", (void*)ptr);

    // Check for NULL before using
    if (ptr == NULL) {
        printf("2. ptr is NULL, cannot dereference\n");
    }

    // Allocate memory
    ptr = malloc(sizeof(int));
    if (ptr == NULL) {
        printf("3. Memory allocation failed\n");
        return 1;
    }

    printf("4. After allocation, ptr value: %p\n", (void*)ptr);

    // Safe to use ptr after NULL check
    *ptr = 42;
    printf("5. Value at ptr: %d\n", *ptr);

    // Clean up
    free(ptr);
    ptr = NULL;  // Set to NULL after freeing

    printf("6. After free, ptr value: %p\n", (void*)ptr);

    // Demonstrate safety of NULL check after free
    // if (ptr == NULL) {
    //     printf("7. ptr is NULL, safely avoided use after free\n");
    // }

    return 0;
}
```

`size_t` 是 C 语言中一个特殊的无符号整数类型，专门用于表示内存大小、数组索引等与 "尺寸" 相关的值。专门用于衡量内存对象的大小(比如 `sizeof` 运算符的返回值就是 `size_t` 类型), nothing special about size_t, it's just a typedef for unsigned long long int。打印 `size_t` 类型时要用 `%zu` 格式符(如你代码中所示)，这是 C99 标准规定的专门格式。

“非 const 的 int 指针” 指的是**指向 int 类型数据的指针，且该指针本身不带有 const 限定**，意味着通过这个指针可以修改它所指向的 int 变量的值。

```c++
#include <iostream>

// 函数接受非const指针参数
void modifyValue(int* ptr) {
    *ptr = 100; // 修改指针指向的内存地址中的值为100
}

int main() {
    const int constant = 42; // 声明一个const常量，值为42(理论上不可修改)
    std::cout << "原始值: " << constant << std::endl;

    // 移除const限定符(注意：修改const变量是未定义行为)
    int* non_const_ptr = const_cast<int*>(&constant);

    // 这里修改会导致未定义行为，结果可能不符合预期
    modifyValue(non_const_ptr);
    // 打印常量的值(可能仍显示42，因为编译器可能优化为直接使用常量值)
    std::cout << "修改后的值: " << constant << std::endl;
    // 打印通过指针访问到的值(可能显示100，内存已被修改)
    std::cout << "通过指针访问的值: " << *non_const_ptr << std::endl;

    // 合法用法：处理实际为非const但被声明为const的对象(指针是const，但指向的值不是const)
    int variable = 10;
    const int* const_ptr = &variable;
    int* modifiable_ptr = const_cast<int*>(const_ptr); // 临时移除const指针的const限定
    *modifiable_ptr = 20;  // 合法，因为原始对象不是const
    std::cout << "合法修改后的值: " << variable << std::endl;

    return 0;
}
```

这个例子展示了`const_cast`的风险和正确用法：它只能用于 "去除临时的 const 限制"，而不能用于修改真正的 const 对象。

### 为什么直接打印`constant`可能还是 42？

这是因为编译器对`const`变量的 “优化” 导致的：

- 编译器认为`const`变量的值不会被修改，因此会在编译时将代码中所有直接访问`constant`的地方(如`std::cout << constant`)替换为它的初始值`42`(类似 “宏替换”)，而不是在运行时去内存中读取。

计算机中的地址(指针)本质上就是整数，而十六进制只是它的一种更紧凑的表示方式。

## Makefiles

### Makefiles

```make
targets: prerequisites
    bash command
    possibly another bash command?
```

### Purpose of CMakeLists.txt?

CMake is a tool that **generates Makefiles**. It is a build system generator. It is used to build, test, and package software. It is a cross-platform build system. It is used to control the software compilation process using simple platform and compiler independent configuration files.

### What does `.PHONY` do?

Say we have a Makefile with a target named 'clean':

```make
clean:
    rm -rf build/*
```

Suppose we have a directory named 'clean' in the same directory as the Makefile. If we run `make clean`, make will not run the command in the target 'clean'. Instead, it will see that the directory 'clean' already exists and will not run the command.

In short, we essentially make a bunch of mappings from target names to commands. If we have a file or directory with the same name as a target, make will not run the command. This is where `.PHONY` comes in.

### `:=` vs `=` in Makefiles

`=` is used for defining variables. It is called a **recursive assignment**. The value of the variable is re-evaluated each time the variable is used.

`:=` is used for defining variables. It is called a **simple assignment** or **immediate assignment**. The value of the variable is evaluated only once, at the point of definition.

- `=` 是 "懒加载"：变量的值**每次用的时候才计算**
- `:=` 是 "立即算"：变量的值**定义的时候就确定了**

Example:

```make
A = $(B)
B = hello
C := $(B)
B = world

all:
    @echo A is $(A)  # Outputs: A is world
    @echo C is $(C)  # Outputs: C is hello
```

### What is the purpose of `@` in Makefiles?

The @ symbol prevents the command itself from being echoed to the console when the Makefile is executed.

Example:

```make
clean:
    rm -rf build/*
```

```bash
$ make clean
rm -rf build/*
```

```make
clean:
    @rm -rf build/*
```

```bash
$ make clean
$
```

Makefile Example

```makefile
.PHONY: 01 01_obj 01_obj_exe_run 02 03 clean

GCC = gcc
NVCC = nvcc
CUDA_FLAGS = -arch=sm_86

01:
	@$(GCC) -o 01 01.c


# just compiles to object file
01_obj:
	@$(GCC) -c 01.c -o 01.o

# compiles and runs the object file (ensure 01_obj is up to
# date by running 01_obj first if it hasn't been run yet)
01_obj_exe_run: 01_obj
	@$(GCC) 01.o -o 01
	@./01

02:
	@$(GCC) -o 02 02.c

03:
	@$(NVCC) $(CUDA_FLAGS) -o 03_cu 03.cu

clean:
	rm -f 01 02 03_cu *.o

```

编译四个步骤

- 预处理阶段：由预处理器 cpp 处理 C 或 C++ 程序，主要处理宏定义、include 语句等，将 include 的文件内容插入到对应位置。
- 编译阶段：用编译器 ccl 将预处理后的内容编译成汇编文件，可查看代码转换后的汇编语言形式。
- 汇编阶段：将汇编文件编译成可重定位的目标文件(.o 文件)，.o 文件为二进制文件，此阶段使用 as 工具。
- 链接阶段：用链接器 ld 将多个.o 文件，以及静态库、动态库链接起来，形成可执行文件。

> 这些特性的工作原理，应用场景
>
> 内存管理模型，类模型，lambda 表达式等特性，写点东西

C++直接控制硬件，代码送往编译器进行编译，输出目标平台的机器码，所以可以直接控制 CPU 执行的指令

为了适应某个平台，只需要找到对应平台的编译器即可。

C++是本地语言，其编译器为目标平台和目标架构生成机器码

当真正需要追求性能时，便需要 C++了

## CMake

## 工具链

> 顾名思义，工具链即工具链条，或者说一系列软件，通过逐个使用这些软件来实现某一特定目标

在`C/C++`开发中，工具链主要指从项目生成到目标可执行文件过程中所用到的一系列软件/工具的集合(通常还包括静态检查、动态调试等所需软件/工具)

通常，工具链包含以下几个核心部分(标\*为非必须)：

1. 编译器

编译器是工具链中最核心的部分，它将源代码转换为目标代码(机器码)。常见的编译器有 GCC(GNU Compiler Collection)和 Clang。编译器负责语法检查、优化代码、生成汇编代码等一系列工作。

1. 汇编器

汇编器将编译器生成的汇编代码转化为机器码。这一步通常是编译过程的一部分，现代的编译器往往会自动调用汇编器。

1. 链接器

链接器将多个目标文件及所需的库文件合并，生成最终的可执行文件。链接器负责解决符号引用，确保程序各部分能够正确协作。

1. 构建系统\*

构建系统负责管理项目的构建过程，包括源文件的编译、依赖管理和构建规则等。常见的构建系统有 Make、CMake、Ninja 等。构建系统能够简化复杂项目的构建过程，提高开发效率。

1. 调试器\*

调试器用于在程序运行过程中进行调试，帮助开发者查找和修复代码中的错误。常用的调试器有 GDB(GNU Debugger)和 LLDB。调试器可以设置断点、单步执行、查看变量值等，为开发者提供了强大的调试功能。

1. 静态代码分析工具\*

这些工具在不执行代码的情况下进行代码分析，以发现潜在的错误、代码规范问题和性能问题。常见的静态代码分析工具有 Cppcheck、Clang Static Analyzer 等。

1. 版本控制系统\*

版本控制系统帮助开发团队管理代码的变更，跟踪历史记录，协作开发。常用的版本控制系统有 Git、Subversion 等。版本控制系统是现代软件开发过程中不可或缺的一部分。

1. 集成开发环境\*

IDE 提供了一个集成的开发环境，包含代码编辑器、构建工具、调试工具等，帮助开发者更高效地编写和管理代码。常见的 C/C++ IDE 有 Visual Studio、CLion、Eclipse CDT 等。

注意，VSCode 属于代码编辑器，但可以通过插件的方式实现 IDE 的部分功能。

事实上，随着软件开发技术的发展，现代工具链已经开始包括越来越多的内容，比如自动化测试、部署、持续集成、容器化等等，这部分内容就需要各位在未来的学习、工作中慢慢积累了。软件开发目前仍是“新兴学科”，技术的快速迭代让我们很难给各种各样的概念“下定义”，更需要的仍是同学们自己的努力。

### 现代 CMake 基础

## 推荐的目录组织形式

### 头文件：

```
<项目名>/include/<项目名>/<模块名>.h
```

同时，头文件内符号应使用`namespace ProjectName {};`包裹

### 源文件：

```
<项目名>/src/<模块名>.h
```

同时，源文件通过`##include <ProjectName/ModuleName.h>`引入对应头文件，并通过类似`ProjectName::FunctionName(){}`的方式提供具体实现

### 示例：

```
ProjectName
├── CMakeLists.txt
├── include
│  └── ProjectName
│     ├── ModuleName1.h
│     ├── ModuleName2.h
│     └── ModuleName3.h
└── src
   ├── ModuleName1.cpp
   ├── ModuleName2.cpp
   └── ModuleName3.cpp
```

### 原因：

`include`目录之所以要“多此一举”，主要是为头文件提供“命名空间”，即通过`##include <ProjectName/ModuleName1.h>`的方式引入，避免同名头文件相互冲突，而源文件则没有这样的问题

`CMakeLists`中则通过`target_include_directories`添加头文件目录

而主项目则可以通过`add_subdirectory`添加该项目

## CMake 介绍{

> CMake 是一个跨平台的编译(Build)工具,可以用简单的语句来描述所有平台的编译过程。

通过 CMake，我们可以简单的描述一个项目编译的过程或一个工程构建的方式，而不必关心其背后的复杂关系(比如不同平台间的差异)

### Makefile 和 Make

> Makefile 和 Make 的关系就像是脚本和解释器

暂时无法在飞书文档外展示此内容

### 现代？

> 本文所指的现代 CMake 主要指 3.x 版本的 CMake，其与 2.x 版本有诸多不同，故称为“现代”

##### Hello World

> 最基本的 CMake 项目是从单个源代码文件构建的可执行文件。
>
> 对于像这样的简单项目，只需要一个包含三个命令的“CMakeLists.txt”文件。

- 目录结构

```
HelloWorld
├── CMakeLists.txt
└── main.cpp
```

- 文件内容

  - `main.cpp`

  ```
  ##include <iostream>

  int main() {
    std::cout << "Hello World!" << std::endl;

    return 0;
  }
  ```

  - `CMakeLists.txt`

  ```
  ## 任何项目的最顶层 CMakeLists.txt 必须首先使用 cmake_minimum_required() 命令
  ## 指定最低 CMake 版本。这会建立策略设置并确保以下 CMake 函数使用兼容版本的 CMake 运行。
  cmake_minimum_required(VERSION 3.11)

  ## 要启动一个项目，我们使用 project() 命令来设置项目名称。每个项目都需要此调用，并且
  ## 应在 cmake_minimum_required 之后立即调用。正如我们稍后将看到的，此命令还可用于
  ## 指定其他项目级别的信息，例如语言或版本号。
  project(hello_world)

  ## 最后， add_executable() 命令告诉 CMake 使用指定的源代码文件创建可执行文件。
  add_executable(hello_world main.cpp)
  ```

_可以使用`project(hello_world LANGUAGES C CXX)`指定语言_

然后在`HelloWorld`目录下执行：

```
cmake -B build
cmake --build build --parallel 4
```

PS：

在网络上的很多教程会给出类似下方所示的命令(甚至于`CMake`官方`Tutorial`也是这样给出的)：

```
mkdir -p build
cd build
cmake ..
make -j4
make install
cd ..
```

但实际上，在现代 CMake 中，可以直接使用`-B`和`--build`更轻松的实现同样的效果

注：此处的`-B`并不是`--build`的缩写形式，使用`cmake --help`可以查看选项信息：

```
...
Options
...
  -B <path-to-build>           = Explicitly specify a build directory.
...
  --build <dir>                = Build a CMake-generated project binary tree.
...
```

##### 变量

> CMake 支持变量，可以使用 set()对变量进行声明和修改

所有变量类型均为“字符串”(如果你一定要讨论“变量类型”的话)，而列表和路径其实也是字符串(前者是用逗号分割的字符串)

##### 特殊变量

> CMake 有一些特殊变量，这些变量要么在幕后创建，要么在项目代码设置时对 CMake 有特殊意义。这些变量大多以 CMAKE\_ 开头。在为您的项目创建变量时避免这种命名约定。

- 指定标准

可以通过 [`CMAKE_CXX_STANDARD`](https://cmake-doc.readthedocs.io/zh-cn/latest/variable/CMAKE_CXX_STANDARD.html##variable:CMAKE_CXX_STANDARD) 和 [\*\*`CMAKE_CXX_STANDARD_REQUIRED`](https://cmake-doc.readthedocs.io/zh-cn/latest/variable/CMAKE_CXX_STANDARD_REQUIRED.html##variable:CMAKE_CXX_STANDARD_REQUIRED)\*\* 为项目指定特定的 C 或 C++ 版本

比如：

- `main.cpp`

```
##include <iostream>

int main() {
  std::cout << "The standard of cpp is (" << __cplusplus << ")" << std::endl;

  return 0;
}
```

- `CMakeLists.txt`

```
cmake_minimum_required(VERSION 3.11)

## 我们可以通过修改 CMAKE_CXX_STANDARD 命令更改编译时所使用的cpp标准
set(CMAKE_CXX_STANDARD 11)
set(CMAKE_CXX_STANDARD_REQUIRED True)

project(cpp_standard)

add_executable(cpp_standard main.cpp)
```

常用的特殊变量还有：

1. CMAKE_BINARY_DIR：构建发生的目录，即你运行 `cmake` 命令的地方。
2. CMAKE_SOURCE_DIR：项目的顶层源代码目录。
3. CMAKE_CURRENT_BINARY_DIR：当前正在处理的 CMakeLists.txt 文件所在的构建目录。
4. CMAKE_CURRENT_SOURCE_DIR：当前处理的 CMakeLists.txt 文件的所在的源目录。
5. CMAKE_PROJECT_NAME：项目名称，使用 `project()` 命令设定。
6. <PROJECT>\_NAME：最近一次调用 `project()` 命令时的项目名称。
7. CMAKE_C_COMPILER：C 编译器的全路径。
8. CMAKE_CXX_COMPILER：C++ 编译器的全路径。
9. CMAKE_PREFIX_PATH：用来指定依赖查找时的前缀路径。
10. CMAKE_INSTALL_PREFIX：安装路径前缀，默认情况下在 UNIX 系统上通常是 `/usr/local`。
11. CMAKE_BUILD_TYPE：构建类型(如 Debug、Release)。
12. CMAKE_VERSION：当前运行的 CMake 版本。

##### 变量运算

> 在 CMake 中，math(EXPR ...) 命令用于执行基本的数学计算。这个命令可以解析和执行包含标凈数学运算符和整数的表达式。EXPR 命令主要用于处理和计算变量的值，非常适用于需要动态计算数值的场景，如计算偏移、大小、循环控制等。

`math(EXPR ...)` 的基本语法如下：math(EXPR <output_variable> "<expression>" [...])

- `<output_variable>` 是计算结果存储的变量。
- `<expression>` 是要计算的表达式，表达式中可以包含数字、变量以及运算符。

CMake 支持以下运算符：

- `+` (加)
- (减，也可用作负号)
- (乘)
- `/` (除)
- `%` (模运算)
- `|` (按位或)
- `&` (按位与)
- `^` (按位异或)
- `~` (按位取反)
- `<<` (左移)
- `>>` (右移)

示例见[📄 示例代码](https://k25t37rf0v.feishu.cn/wiki/VsfEw3MBwiniI4k5YRIczjuYnVg?fromScene=spaceOverview##VpVndli7JoloNyxDWmAcGd63ncc)中的`Calculate`

##### 配置文件生成

既然有了变量，这些变量能不能被传递给编译器？而不仅仅是使用 CMake 处理？当然是可以的，比如使用配置文件生成`configure_file()`。这个命令会将一个输入文件(通常为模板文件)中的变量替换成相应的值，并生成输出文件。这些变量可以是 CMake 中的任何变量，例如 `CMAKE_INSTALL_PREFIX`、环境变量或自定义变量。

示例见[📄 示例代码](https://k25t37rf0v.feishu.cn/wiki/VsfEw3MBwiniI4k5YRIczjuYnVg?fromScene=spaceOverview##VpVndli7JoloNyxDWmAcGd63ncc)中的`ConfigureFile`

##### 日志

还记得我们最开始说的吗，`CMake`可以理解为一门脚本语言，那么怎么能少的了经典的“Hello World”呢？

> 在 CMake 中，日志输出可以通过 message() 函数来实现，这对于调试、显示配置信息或者向终端提供构建状态更新非常有用。message() 函数可以生成不同严重级别的消息，使得开发者可以根据需要调整输出的详细程度。

```
message()` 函数的基本语法如下：`message([<mode>] "message to display")
```

其中 `<mode>` 是一个可选参数，用于指定消息的类型。常用的模式包括：

- `STATUS`: 这是最常用的模式，用于输出正常的状态信息。
- `WARNING`: 当需要警告用户某些潜在问题时使用。
- `AUTHOR_WARNING`: 专门用于警告开发者或维护者。
- `SEND_ERROR`: 用于错误消息，这会在显示消息后继续执行，但会在配置阶段结束时使 CMake 退出。
- `FATAL_ERROR`: 当遇到严重错误需要立即终止所有 CMake 过程时使用。
- `DEPRECATION`: 专用于指示某些功能即将废弃。

示例见[📄 示例代码](https://k25t37rf0v.feishu.cn/wiki/VsfEw3MBwiniI4k5YRIczjuYnVg?fromScene=spaceOverview##VpVndli7JoloNyxDWmAcGd63ncc)中的`Message`

##### 编译选项

除了使用配置文件生成，我们还可以直接为编译器提供宏定义，而这需要 CMake 为编译器提供编译过程中的各种参数。除了提供宏定义，还可以提供优化级别、警告处理等。

1. 使用 `add_compile_options`

`add_compile_options` 命令允许你为所有目标添加编译选项，无论是之前定义的还是之后定义的目标。这种方法是全局的，适用于所有编译器。

```
add_compile_options(-Wall -Wextra -O2)
```

1. 目标特定的编译选项

如果你只想为特定目标设置编译选项，可以使用 `target_compile_options`。这允许更细粒度的控制，仅影响指定的目标。

```
add_executable(my_app main.cpp)
target_compile_options(my_app PRIVATE -Wall -Wextra)
```

在这里，`PRIVATE` 表示这些选项只影响 `my_app` 目标的编译，不影响其他链接的库。你也可以使用 `PUBLIC` 或 `INTERFACE` 来控制选项的继承关系。

1. 设置特定编译器的选项

由于不同的编译器可能支持不同的选项集，有时需要根据编译器的类型区别对待。可以使用 `if` 语句来区分不同的编译器。

```
if(CMAKE_CXX_COMPILER_ID STREQUAL "GNU")
    add_compile_options(-Wall -Wextra)
elseif(CMAKE_CXX_COMPILER_ID MATCHES "MSVC")
    add_compile_options(/W4)
endif()
```

1. 修改 CMake 变量

CMake 有几个内置变量可以用来添加编译器选项，例如 `CMAKE_CXX_FLAGS`。这些变量可以在命令行通过 `-D` 选项设置或在 `CMakeLists.txt` 文件中直接设置。

```
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wall -O2")
```

1. 通过配置类型添加选项

如果你的项目支持多种构建类型(如 Debug、Release)，你可能想为不同的构建类型指定不同的编译器选项。

```
set(CMAKE_CXX_FLAGS_DEBUG "-g")
set(CMAKE_CXX_FLAGS_RELEASE "-O3")
```

1. 使用 `add_definitions`

虽然 `add_definitions` 主要用于添加预处理器定义，但它也可以用来添加编译器标志。不过，这种用法不推荐，因为它不如 `add_compile_options` 和 `target_compile_options` 明确。

```
add_definitions(-DMY_DEFINE)
```

注：这部分内容更倾向于编译器相关而不是 CMake，故不提供过多示例

##### 分支与循环

还记得我们学习 C++时，输出“Hello World”之后学了什么吗？没错，就是流程控制！

> 在 CMake 中使用分支和循环结构可以帮助我们根据不同的条件编译代码，以及迭代一系列元素进行操作。这使得 CMake 脚本更加灵活和强大。下面我将介绍如何在 CMakeLists.txt 文件中使用分支和循环结构。

##### 分支(Conditional Statements)

CMake 提供了几种条件语句来控制基于特定条件的代码执行路径，包括 `if`、`elseif` 和 `else`。

基本用法：

```
if(<condition>)
  ## 做一些事情
elseif(<other_condition>)
  ## 做其他事情
else()
  ## 如果上面的条件都不满足，做一些其他事情
endif()
```

在 CMake 中，可以使用的“条件”有：

- 布尔测试：直接使用 `TRUE`、`FALSE`、`ON`、`OFF`、`YES`、`NO`、`Y`、`N`、`IGNORE`、`NOTFOUND`、以 `NOTFOUND` 结尾的任何字符串、空字符串 `""` 或 `0`。
- 变量比较：如 `VAR EQUAL 10`、`VAR LESS 20`、`VAR GREATER 100`。
- 字符串比较：如 `VAR STREQUAL "value"`。
- 文件和目录测试：如 `EXISTS`、`IS_DIRECTORY` 等。
- 复合条件：使用 `AND`、`OR`、`NOT`。

##### 循环(Looping Constructs)

CMake 支持几种循环结构，包括 `foreach` 和 `while` 循环。

##### `foreach` 循环

`foreach` 循环可以用来迭代固定的值列表，或是从变量中提取列表。

使用迭代列表：

```
foreach(item IN ITEMS item1 item2 item3)
  message(STATUS "Processing ${item}")
endforeach()
```

使用迭代变量列表：

```
set(ITEM_LIST "apple" "banana" "cherry")
foreach(item IN LISTS ITEM_LIST)
  message(STATUS "Found fruit: ${item}")
endforeach()
```

使用范围：

```
foreach(i RANGE 1 5)
  message(STATUS "Number ${i}")
endforeach()
```

##### `while` 循环

`while` 循环根据条件表达式的结果决定是否继续循环。

基本用法：

```
set(value 0)
while(value LESS 5)
  message(STATUS "Value is ${value}")
  math(EXPR value "${value} + 1")
endwhile()
```

示例见[📄 示例代码](https://k25t37rf0v.feishu.cn/wiki/VsfEw3MBwiniI4k5YRIczjuYnVg?fromScene=spaceOverview##VpVndli7JoloNyxDWmAcGd63ncc)中的`ConditionalBranchesAndLoops`

##### 函数

变量有了、控制语句有了……那……函数呢？

> CMake 提供了 function 命令来定义自定义函数。

以下是定义和使用自定义函数的一般语法：

```
function(<name> [arg1 [arg2 ...]])
    ## 函数体
endfunction()
```

注意：

1. 作用域：在函数内部定义的变量默认是局部变量。如果需要修改外部变量，使用`PARENT_SCOPE`。
2. 可变参数：函数可以接受可变数量的参数，通过`ARGN`变量访问。

示例见[📄 示例代码](https://k25t37rf0v.feishu.cn/wiki/VsfEw3MBwiniI4k5YRIczjuYnVg?fromScene=spaceOverview##VpVndli7JoloNyxDWmAcGd63ncc)中的`FunctionExample`

##### 宏

不愧是“c”make

> CMake 的宏是用来定义一段可以重复使用的代码，它可以接受参数，并在调用时展开。宏在定义时不会有自己的作用域，它们在调用时直接将代码插入调用点。

定义一个宏使用`macro`命令，语法如下：

```
macro(<name> [arg1 [arg2 ...]])
    ## 宏体
endmacro()
```

因为与函数基本一致，故不单独给出示例，与函数的区别见下文

##### 宏与函数的区别

> 其实就是 C/C++中函数与宏的区别

1. 作用域处理
   1. 函数(function)：
      - 函数在调用时会创建一个新的作用域。
      - 在函数内部定义的变量不会影响外部变量，除非明确使用`PARENT_SCOPE`。
   2. 宏(macro)：
      - 宏没有自己的作用域，调用宏时会将其代码直接插入到调用点。
      - 宏内部定义的变量会影响外部作用域。
2. 参数处理
   1. 函数(function)：
      - 函数参数在调用时是按值传递的，函数内部的参数修改不会影响调用者。
   2. 宏(macro)：
      - 宏参数在调用时是文本替换的，宏内部的参数修改会影响调用者。
3. 可读性和调试
   1. 函数(function)：
      - 由于函数具有自己的作用域和按值传递的参数，它们通常更易于调试和维护。
      - 更适合用于复杂的逻辑处理和模块化代码。
   2. 宏(macro)：
      - 由于宏在调用时直接展开，调试可能会比较困难，特别是在宏内部使用了大量变量时。
      - 更适合用于简单的代码替换或模板化的代码生成。

##### 多文件

##### 单一项目

对于多文件，如果是单一的项目，我们只需要按照项目结构添加所有的源文件和头文件即可：

```
add_executable(${PROJECT_NAME} main.cpp src/src1.cpp src/src2.cpp ...)
target_include_directories(${PROJECT_NAME} PRIVATE include)
```

如果觉得一个一个添加源文件过于繁琐，可以使用`file()`配合通配符：

```
file(GLOB SOURCES "src/*.cpp")
add_executable(${PROJECT_NAME} main.cpp ${SOURCES})
target_include_directories(${PROJECT_NAME} PRIVATE include)
```

这部分不提供示例代码

##### 项目

还记得我们在文章开头提到的[📃 推荐的目录组织形式](https://k25t37rf0v.feishu.cn/wiki/VsfEw3MBwiniI4k5YRIczjuYnVg?fromScene=spaceOverview##RMTFdZdM0odFSgxQpsycJGEwnlI)吗？这里就用上了！

示例见[📄 示例代码](https://k25t37rf0v.feishu.cn/wiki/VsfEw3MBwiniI4k5YRIczjuYnVg?fromScene=spaceOverview##VpVndli7JoloNyxDWmAcGd63ncc)中的`DependencyManagement`，这里主要提一些重要内容：

- `file(GLOB ...)`和`file(GLOB_RECRUSE ...)`：都使用通配符匹配文件，但是后者允许匹配嵌套的目录

  - 比如`src/path/xxx.cpp`

- `CONFIGURE_DEPENDS`：添加该选项可以让 CMake 主动跟踪目录，不需要每次添加新文件后重新运行`cmake -B build`

- `add_library()`：用来定义库文件(动态库或静态库)的构建。这个命令可以创建新的库目标，可以是静态库、动态库或者模块库，这取决于指定的库类型。

  - 基本语法：

  ```
  add_library(<name> [STATIC | SHARED | MODULE]
              [EXCLUDE_FROM_ALL]
              source1 source2 ... sourceN)
  ```

  - `<name>`: 库的目标名，这将是其他目标链接到此库时使用的名字。

  - ```
      STATIC
    ```

    ,

    ```
    SHARED
    ```

    ,

    ```
    MODULE
    ```

    : 分别用来指定库的类型：

    - `STATIC` —— 静态库，文件在编译时与程序一起链接，整合进最终的可执行文件。
    - `SHARED` —— 动态库，文件在运行时被加载，可以被多个程序共用。
    - `MODULE` —— 在 CMake 中，模块库与动态库类似，但是不会被链接到其他目标，通常用于 dlopen 等运行时动态加载功能。

  - `EXCLUDE_FROM_ALL`: 这个选项使得这个库不会被所有目标的默认构建过程包括，除非有其他目标显式依赖它，或者特别指定了构建这个库。

  - `source1 source2 ... sourceN`: 源文件列表，这些文件将被编译并链接到库中。

  - 为什么有时把头文件也

    ```
    add_library()
    ```

    ？

    - 这主要是为了 IDE 服务，有些 IDE 不会将头文件加入资源管理器

- `include_directories()`和`target_include_directories()`：前者已经弃用了，网上的教程大多是“古代”版，现在都应该使用`target_include_directories()`

##### 脚本

> CMake 脚本文件(通常以 .cmake 为扩展名)是用于编写可重用的 CMake 代码块的文件。这些文件可以包含变量定义、函数、宏以及命令，用于配置和控制构建过程。使用 .cmake 脚本文件，可以使 CMake 配置更加模块化和可维护。

`.cmake` 脚本文件的用途

1. 模块化配置：将常用的配置选项或函数分离到独立的文件中，便于在多个项目中重用。
2. 可读性和维护性：通过拆分复杂的 CMake 配置，提升脚本的可读性和可维护性。
3. 共享库和函数：定义共享的函数和宏，以便在不同的 CMake 项目中使用。

```
.cmake`脚本文件可以通过`include()`直接引入，具体示例见[📄示例代码](https://k25t37rf0v.feishu.cn/wiki/VsfEw3MBwiniI4k5YRIczjuYnVg?fromScene=spaceOverview##VpVndli7JoloNyxDWmAcGd63ncc)中的`CMakeScript
```

但是要注意，`include(foo.cmake)`和`##include <foo.h>`的本质一样，是直接替换，和复制粘贴没有区别

## 示例代码下载

```
Linux
curl -fsSL <https://raw.githubusercontent.com/KraHsu/CMakeTutorialForRM/main/setup.sh> | sh
Linux`或`Windows
git clone <https://github.com/KraHsu/CMakeTutorialForRM.git>
```

## 参考资料

https://www.bilibili.com/video/BV1bg411p7oS/?share_source=copy_web&vd_source=e25a3cf3b926a596c2e534c84d92b0e8

https://cmake.org/documentation/

https://www.bilibili.com/video/BV1V84y117YU/?share_source=copy_web&vd_source=e25a3cf3b926a596c2e534c84d92b0e8

### 现代 CMake 进阶

> 我先验地认为开始阅读“进阶”部分的读者已经是老鸟了，再加之此部分内容过于繁杂，故不再给出具体的源码示例，文档中的代码示例依然会有，但更多的需要各位自行编写测试

## 第三方库与依赖

### `find_package`

> find_package 是 CMake 中的一个命令，用于在配置阶段查找并加载特定项目的配置信息。它允许开发者在他们的项目中引入和使用第三方库和软件包，确保正确的库版本被加载并将必要的编译器标志、头文件路径和库路径集成到项目中。

基本用法：

```
find_package(<PackageName> [version] [EXACT] [QUIET] [MODULE]
             [REQUIRED] [[COMPONENTS] [components...]]
             [OPTIONAL_COMPONENTS components...]
             [NO_POLICY_SCOPE])
```

- PackageName: 需要查找的包的名称。
- version: 可选指定，需要找到的包的版本。
- EXACT: 请求确切的版本匹配。
- QUIET: 不显示任何找不到包的消息。
- MODULE: 强制使用模块模式，这会使 CMake 使用 `Find<PackageName>.cmake` 模块来查找包。
- REQUIRED: 如果找不到包，则会产生致命错误，停止配置过程。
- COMPONENTS: 跟随其后的是一系列此包可能提供的组件名称，这对于大型包来说很常见。
- OPTIONAL_COMPONENTS: 指定如果存在应该加载的组件，但其缺失不会导致配置失败。
- NO_POLICY_SCOPE: 设置这一选项可以防止设置任何策略范围。

`find_package` 可以在两种模式下工作：模块模式和配置模式。

1. 模块模式：在这种模式下，CMake 使用 `Find<PackageName>.cmake` 模块来查找库。这些模块是由项目或用户提供的，位于 `CMAKE_MODULE_PATH` 或 CMake 的默认模块目录中。
2. 配置模式：在这种模式下，CMake 查找由库开发者提供的 `PackageNameConfig.cmake` 或 `<lower-case-package-name>-config.cmake` 文件。这些文件提供了关于如何在项目中使用该库的详细信息。

示例：

- `find_package(OpenCV)`：查找名为`OpenCV`的包，找不到不报错，事后可以通过`${OpenCV_FOUND}`变量判断是否找到
- `find_package(OpenCV QUIET)`：查找名为 OpenCV 的包，找不到不报错，也不打印任何信息。
- `find_package(OpenCV REQUIRED)`：最常见用法，查找名为 OpenCV 的包，找不到就报错(并终止 cmake 进程，不再继续往下执行)。
- `find_package(OpenCV REQUIRED COMPONENTS core videoio)`:查找名为 Opency 的包，找不到就报错，且必须具有`OpenCV::core`和`OpenCV:videoio`这两个组件，如果没有这两个组件也会报错。
- `find_package(OpenCV REQUIRED OPTIONAL_COMPONENTS core videoio)`:找名为`OpenCV`的包，找不到就报错，可具有`OpencV:core`和`OpencVvideoio`.这两个组件，没有这两组件不会报错，通过`${OpenCV_core_FOUND}` 查询是否找到 `core` 组件。

注：`Unix/Linux`的标准路径比较标准，`Windows`的标准路径不太标准，所以使用`Windows`更容易出现找不到已安装的库的情况

### `PkgConfig`

> PkgConfig 是一个用于帮助软件开发者和用户编译和链接应用程序和库的工具。它主要用于解决库的依赖关系和配置问题，确保编译器和链接器能够找到正确的库文件和头文件。PkgConfig 通过维护.pc 文件(即“pkg-config”文件)，这些文件包含了关于库的元数据，如版本信息、编译和链接所需的标志以及其他依赖库的信息。

当使用`CMake`进行项目构建时，通常会将安装包放在默认的包查找目录中。这种情况下，`CMake`可以自动查找并管理这些包。然而，如果通过其他方式安装包，比如直接从源代码编译，则可能需要手动设置`CMAKE_MODULE_PATH`，以便`CMake`能够找到这些包。

特别是对于某些非`CMake`管理的依赖，如在`Ubuntu`中从源码安装`OpenCV`后可能遇到的找不到`glib-2.0`依赖的问题。`glib-2.0`通常通过`pkg-config`工具来管理，而不是`CMake`。因此，为了正确配置`glib-2.0`的编译和链接路径，需要使用以下命令：

```
pkg-config --cflags glib-2.0 ##取编译时需要的flags。
pkg-config --libs glib-2.0 ##获取链接时需要的libraries。
set(CMAKE_C_FLAGS
    -I/usr/include/glib-2.0
    -I/usr/lib/x86_64-linux-gnu/glib-2.0/include
) ## pkg-config --cflags glib-2.0
set(CMAKE_EXE_LINKER_FLAGS -lglib-2.0) ## pkg-config --libs glib-2.0
```

为了在 CMake 项目中集成这样的依赖，可以在 CMake 脚本中引入`FindPkgConfig`模块，并使用`pkg_check_modules`命令来自动化从`pkg-config`获取配置信息的过程。这样可以确保即使依赖项不是由 CMake 直接管理，项目构建过程也能顺利进行：

```
## 引入PkgConfig模块
find_package(PkgConfig REQUIRED)

## 查找glib-2.0库
pkg_check_modules(GLIB REQUIRED glib-2.0)
## 包含glib的头文件目录
include_directories(${GLIB_INCLUDE_DIRS})
## 链接glib库
link_directories(${GLIB_LIBRARY_DIRS})
```

### `FIND`

有一些库它就是不支持`CMake`，就是不写`<project>Config.cmake`，怎么办呢？没事，你不支持我，那我就支持你！为此，`CMake`提供了`Find<project>.cmake`用于在不知道包具体位置的时候查找他们(CMake 在安装时就自带一些热门库的`Find`，比如`FindCUDAToolkit.cmake`、`FindPython.cmake`等)

而对于一些不那么热门的库，就只能我们自己写`Find`了……

一般写法：

- 古代

```
find_package(XXX)
if (NOT XXX FOUND)
    message(FATAL ERROR "XXX not found")
endif()
target_include_directories(yourapp $[XXX_INCLUDE_DIRS})
target_link_libraries(yourapp $[XXX_LIBRARIES})
```

- 现代

```
find_package(XXX REQUIRED COMPONENTS xxx)
target_link_libraries(yourapp XXX:xxx)
```

## 杂项辨析

### `target_source`

```
add_executable(main main.cpp)
```

$$\Rightarro$$`add_executable(main) target_source(main PUBLIC main.cpp)`

### `aux_source_directory`

`aux_source_directory(path sources)`会根据项目语言将`path`目录下所有的后缀表示源文件的文件加入`sources`变量

### `CMAKE_BUILD_TYPE`

> 特殊变量，用于控制构件类型

- `Debug`：调试模式，完全不优化(默认)，`O0 -g`
- `Release`：发布模式，优化程度最高(性能)，编译慢，`O3 -DNDEBUG`
- `MinSizeRel`：最小体积模式，优化程度最高(体积)，`Os -g -DNDEBUG`
- `RelWithDebInfo`：带调试信息发布，`O2 -g -DNDEBUG`

### 几个特殊的`_DIR`

- `CMAKE_CURRENT_SOURCE_DIR`：表示当前源码目录的位置
- `PROJECT_SOURCE_DIR`：最近一次调用`project`的`CMakeLists.txt`的源码所在目录
- `CMAKE_SOURCE_DIR`：最外层`CMakeLists.txt`的源码根目录
- `CMAKE_CURRENT_BINARY_DIR`：表示当前输出目录的位置

### `LANGUAGES`

在[现代 CMake 基础](https://k25t37rf0v.feishu.cn/wiki/VsfEw3MBwiniI4k5YRIczjuYnVg)提到了`LANGUAGE`可以设置为`C`和`CXX`(其实是默认值)，但实际上：

- `ASM`：汇编语言
- `Fortran`：过时的老东西
- `CUDA`：英伟达
- `OBJC`：苹果“有类的 C”
- `OBJCXX`：苹果的“有类的 C++”
- `ISPC`：一种`SIMD`编程语言

也可以使用`enable_language(...)`添加

### `CMAKE_<lang>_STANDARD_REQUIRED`

如果不设置这个变量，哪怕编译器不支持你设置的标准，他也不会报错，只会默默降低标准……

同时，请不要在编译选项中手动指定标准，比如“-std=c++17”

### `CMAKE_<lang>_EXTENSIONS`

是否使用`gcc`的扩展 私货，一般不用(避免移植报站)

### `LINK_WHAT_YOU_USE`

告诉编译器不要没事自动剔除没有引用符号的链接库

### 清除缓存

清除缓存只需要删除`build/CMakeCache.txt`即可，不必删除整个`build`

### `option()`

尝试在`CMakeLists`中添加`option(MY_VAR "Test For Option" ON)`，然后使用`ccmake -B build`，没错，就是`ccmake`

注意这东西其实是缓存，也就是说直接修改为`OFF`是没用的，必须使用`ccmake`或者[清除缓存](https://k25t37rf0v.feishu.cn/wiki/U1NHwIgQLihzbWk7GBWcQ6Uench##Ohmtd7DimogCzgxHrG7csAqTnug)(`Windows`可以用`cmake-gui`)

### 生成器表达式

语法：`$<$<类型:值>:为真时的表达式>

---

## **C++是如何工作的**

源文件给到编译器，输出一些二进制文件，它们可能是库，也可能是可执行文件

\#后的语句叫预处理语句，在编译之前被处理，预处理之后文件将被编译，C++被编译器转为机器码

任何 C++程序都有 main 函数，是程序的入口；main 函数不写返回值默认返回 0

<<,>>是重载的操作符，可以理解为函数

cout 流和 cin 流

解决方案配置：解决方案平台是指编译代码的目标平台

application(.exe), dynamic library(.dll), static library(.lib)

关闭优化使得我们可以调试

每一个 cpp 文件都会被编译，但头文件不会被编译；它们在预处理时会被包含进来一起被编译。每个 cpp 文件被编译成一个目标文件(.obj)；链接器将这些.obj 文件合并成一个.exe 文件

函数的申明：如果我们只编译这一个文件，编译器是怎么知道这个函数会在另一个文件中呢？答案就是，编译器相信我们；编译器怎么运行到正确的代码呢？这就需要链接器了，当我们构建整个工程时，当找不到函数定义时，就会报链接错误(无法解析的外部符号)。

---

## **编译和链接**

从文本文件/代码转为二进制可执行的机器码需要经过两件事，即编译和链接

编译生成目标文件，做了几件事：预处理，将代码转换为常量数据或指令(创建一个抽象语法树)

被编译的 cpp 文件被称为翻译单元。c++并不关心文件，文件只是提供给编译器源代码的一种方式。

一个翻译单元得到一个目标文件

obj 文件中有什么？二进制的机器码，供 CPU 实际执行

编译的第一阶段：预处理，编译所有的预处理语句并处理它们，预处理语句时给编译器看的

预处理指令：#include，#define，#if #endif

告诉编译器优化时，编译器就会执行优化

在汇编语言中，会发现函数调用被一串随机字符串修饰了，这就是函数的签名，这需要唯一地定义函数

本质上，有多个 obj 文件时，函数也被定义在多个 obj 中时，链接地工作，就是把所有的函数链接在一起，以方便查找函数的签名。调用函数时，编译器便生成 call 指令。

将文件编译完成之后，通过链接，找到每个符号和函数在哪里并连接起来。即使是单文件编程，仍然需要把 main 函数链接起来，使应用程序知道程序入口在哪里。

了解报错是编译报错还是链接报错是重要的。

无法解析的外部符号：如果找不到确切的函数定义，就会发生这个链接错误。

有重复的符号：有函数或变量有相同的名字和相同的签名(相同的参数和返回值)

在头文件中写定义会导致重复定义的问题，解决方式：

- static 表示，只会在这个翻译单元中用到
- inline 表示获取实际的函数体，并将函数调用替换为函数体
- 把函数体放入源文件中，头文件中只写定义

链接也分为静态链接和动态链接

---

## **变量**

存储数据的容器，允许我们进行命名

创建一个变量，它将被存储在内存中，堆或者栈

C++有一系列的原始数据类型，这些不同数据类型在 C++中的唯一区别是占用内存大小不同

编译器决定类型的大小，一般来说，int 占四字节，编译器由平台决定。

一个字节的范围是 0~256 / -128~127

各种原始数据类型：

int 4 字节

char 1 字节

short 2 字节

long 4 字节(取决于编译器)

long long 8 字节

float 4 字节(在数据后加‘f’，否则默认 double)

double 8 字节

bool 1 字节

bool 为什么不是 1bit：处理寻址内存时，无法寻址只有一个 bit 位的内容，只能寻址字节；

但可以用一些技巧，在 1byte 中存 8 个 bool

sizeof 操作符可以查到每个数据类型占多少字节

有了基本的数据类型，还可以将他们转换为指针或引用

---

## **函数**

执行特定任务的代码块，主要的目的是防止代码重复

在一个运行的程序中，为了调用一个函数，需要创建一个堆栈结构，需要把参数和返回地址推入堆栈。

**堆栈结构**

有两种不同文件类型的概念，一种是像 C++一样编译的编译文件，一个编译单元，这样就会有头文件的概念

头文件：一个公共的地方来存放声明

保证只包含头文件一次的方式：

```
 #pragma once
 #ifndef __LOG_H
 #define __LOG_H
 ...
 #endif
```

头文件在#include 中的差异：< >尖括号只用于编译器包含路径；“”引号可以做一切，通常用于包含相对于当前文件的文件

iostream 是一个没有后缀名的文件，这是由 C++标准库决定的，用于区分 C 标准库和 C++标准库

---

## **调试**

step into 进入函数体内执行

step over 进入下一行执行

step out 跳出当前函数，回到调用它的位置

箭头指向表示下一个要执行的语句

内存视图：如，在 memory 窗口输入&a，可以跳转到 a 的地址(输入指针查看值)

调试模式会做一些额外的事，比如，把未初始化的内存设置统一值

**查手册，我的代码都烧录到哪里去了**

反汇编 disassembly 窗口

---

## **控制流语句**

条件语句：满足条件，跳到某个内存；不满足条件，跳到另一个内存；这样的分支语句，在一定程度上会使程序慢下来；在优化中，将会极力避免分支

**尝试用一些数学计算代替分支语句**

循环：用于重复执行的语句，for 用于已知次数的循环，while 用于未知次数的循环

控制流语句：continue, break, return

---

## **指针和引用**

指针对于管理和操纵内容非常重要

> 指针是一个存储内存地址的整数，与数据类型无关，只是说这个地址的数据被人为假设为我们给的类型。

代码中做得所有事，几乎都是从内存中读写。

&取地址 / 引用

- 取值 / 逆向引用

void\* 问题在于，要向这个地址写入数据时，计算机不清楚向几个字节单位的内存进行操作

直接在栈上创建数据

在堆上开辟一段内存

对 x64，一个内存地址占 64bit

引用

根本上，引用通常是指针的伪装，指针的语法糖

```
     int num = 3;
     int& ref = num;
```

引用必须“引用”已经存在的变量，并不占用内存，只是创造一个别名

创建引用时，编译器不会为之分配内存，不是真正的变量

```
 int num = 3;
 int& ref = num;
```

所以，引用实际上只存在于我们写的代码中

声明引用时必须初始化

值传递，址传递和引用传递

```
 #include <iostream>

 #define LOG(x) std::cout << x << std::endl;

 void Increase(int val)
 {
     val++;
 }

 void Increase2(int& val)
 {
     val++;
 }

 void Increase3(int* ptr)
 {
     (*ptr)++;
 }

 int main(void)
 {
     int lw = 1;

     Increase(lw);
     LOG(lw);

     Increase2(lw);
     LOG(lw);

     int* lw_ptr = &lw;
     Increase3(lw_ptr);
     LOG(lw)

     std::cin.get();
     return 0;
 }
```

---

## **面向对象**

类，对数据和功能组合在一起的一种方法，把数据和处理这些数据的方法组织起来

这里的思维重点在于，要有意识地把数据组织起来

由类类型构成的变量称为对象，新的对象变量称为实例

类中的成员变量默认为 private，这涉及到“可见性”的问题

private 意味着，只有类中的函数才能访问这些变量

类内的函数称为方法

类本质上只是语法糖，使代码组织地更有逻辑，易于维护

类和结构体的区别

是否存在可见性

struct 在 C++存在的原因是，希望与 C 保持向后兼容性

只涉及 POD(Plain Old Data)时，通常用 struct，只是一种表示变量的机构；比如数学上的向量；结构体只是数据的结构 [**POD**](https://blog.csdn.net/m0_61629312/article/details/134248559)

需要继承时用 class，需要大量功能时使用 class

在命名是给成员变量加前缀，可以区分成员变量和局部变量

可见性，只是为了使代码更具有逻辑性，对实际运行没有影响。更多的是提示开发者，应该怎样使用这些代码

private：只有这个类可以访问，派生类也不能访问(友元除外)

protected：只有这个类及其子类可以访问

public：均可访问

---

## **静态 static**

两个意思：一个是在类或者结构体外部使用 static 关键字，另一个是在类或结构体内使用 static

类外的 static，表示声明的符号，其链接只在这个翻译单元内部。链接器不会在翻译单元之外找定义

类内的 static，表示该变量与类的所有实例共享内存；即在所有创建的实例中，静态变量只有一个实例

类或结构体外的 static：

与类外的 static 相对应的是 extern，表示需要在外部翻译单元中寻找定义

如果在头文件中声明静态变量，并且将该头文件包含在两个不同的 C++文件中，效果就是在两个翻译单元中声明了相同的该变量作为静态变量

如果不需要变量是全局变量，就需要尽可能多地使用静态变量

类或结构体内的 static：

> 通过类实例来引用静态变量是没有意义的，因为这就像类的全局实例。
>
> 类内的 static 变量，就好像在类的命名空间内创建了变量，它们实际上不属于类；
>
> 这其实类似于全局变量，它是在内部进行链接的。

> 静态方法也是一样，无法访问类的实例。
>
> 静态方法可以被调用，不需要通过类的实例。
>
> 而在静态方法内部，不能写引用到类实例的代码，因为不能引用到类的实例。
>
> 静态方法不能访问非静态变量，因为静态方法没有类实例
>
> 非静态方法总是获得当前类的一个实例作为参数。(隐藏参数)
>
> 而静态方法得不到那个隐藏参数

```
 #include <iostream>

 class Entity
 {
 public:
     static int x, y;

     static void Print()
     {
         std::cout << x << "," << y << std::endl;
     }
 };

 class Singleton
 {
 public:
     static Singleton& Get()
     {
         static Singleton instance;
         return instance;
     }

     void Hello()
     {

     }
 };

 int Entity::x;
 int Entity::y;

 int main(void)
 {
     Entity::x = 1;
     Entity::y = 2;
     Entity::Print();

     Singleton::Get().Hello();

     return 0;
 }
```

局部作用域中的 static

声明一个变量需要考虑两件事：变量的生存期和作用域

生存期是指变量实际存在的时间，即在内存中会存在多久

作用域是指可以访问变量的范围

在函数内声明一个变量，不能再其它的函数中访问它

静态局部变量允许我们声明一个变量，它的生存期基本上相当于整个程序的生存期

所以，在局部作用域(如函数或类)中声明一个静态变量，可以达到既阻止全局访问，又把生存期延长到整个程序。

---

## **枚举**

一个数值集合，可以实现将一组数值集合作为类型；主要是为了分组

```
 enum Example
 {
     A, B = 3, C
 };

 Example x = B;
```

默认从 0 开始，逐个递增

必须是整数

枚举本身不是一个命名空间，这叫做枚举类

---

## **构造和析构**

构造函数

特殊类型的方法，在每次实例化对象时运行；且只在实例化对象时运行，主要作用是确保初始化了内存并做了一些设置

所以，如果只使用类的静态方法，不会实例化对象，不会运行构造函数

如果不希望在使用时实例化对象，可以用 private 把构造函数隐藏

不允许构造 / 不允许复制，可以把构造函数声明为 delete

析构函数

每次销毁对象时运行，卸载变量，释放内存，同时适用于栈和堆分配的内存

构造函数初始化列表，需要按声明时的顺序写，因为会按照定义类成员的顺序初始化，否则会产生依赖性问题

使用初始化列表可以使构造函数更聚焦于实际的功能，并且保证成员变量只被构造一次(如果不使用初始化列表，会同时调用默认的构造函数)

---

## **继承、多态、虚函数**

继承允许有一个相互关联的类的层次结构，允许有一个包含公共功能的基类，避免代码重复

多态，一个单一类型，但有多个类型的意思

继承出的派生类不仅是派生类，同样也是基类，任何想要使用基类的地方，派生类同样可以使用派生类是基类的超集

基于此，可以通过重写一个方法来代替父类方法运行

如果重写函数，就需要维护一个虚函数表，即需要额外的内存；并且每次调用虚函数时，需要遍历这个表来确定映射到哪个函数

虚函数允许在子类中重写方法，标记为 virtual，将基类中的基函数标记为虚函数

通常声明函数时，方法通常在类内部(起作用)。要调用方法时，调用属于该类型的方法。

虚函数引入了一种叫做“动态联编”的技术，通常通过虚函数表进行维护，保证运行时可以映射到正确的覆写函数上，并实现编译。覆写函数可选地可以加 override 关键字，显式指出时覆写过的函数，并且会在覆写非虚函数时给出报错，更安全。

纯虚函数

```
 virtual int Function(int a) = 0;
```

当提供默认实现没有意义时，想要强制子类，为特定的函数提供自己的定义。创建一个类，只由未实现的方法组成，然后强制子类去实际实现它们，这通常被称为接口。接口中只包含未实现的方法，作为模板。

如果不实现，就不会允许对象的实例化。

构造，析构，继承的例子：

```
#include <iostream>

class Object
{
public:
	float X, Y;

	Object()
	{
		std::cout << "Constructed Object" << std::endl;
		X = 0.0f;
		Y = 0.0f;
	}

	Object(float x, float y)
		: X(x), Y(y)
	{
		std::cout << "Constructed Object" << std::endl;
	}

	~Object()
	{
		std::cout << "Destructed Object" << std::endl;
	}

	void Move(float xa, float ya)
	{
		X += xa;
		Y += ya;
	}
};

class Player : public Object
{
public:
	const char* name;

	void PrintName()
	{
		std::cout << name << std::endl;
	}
};

int main4(void)
{
	Object obj1;
	obj1.Move(1.0f, 2.0f);

	Object obj2(10.0f, 5.0f);
	obj2.Move(1.0f, 2.0f);

	Player player1;
	player1.Move(5.0f, 5.0f);

	return 0;
}
```

---

## **数组**

内存连续的数据结构，用索引进行访问

数组实质是指针

确保在数组边界内写数据，否则将访问不属于你的内存，可能覆盖掉其它数据

在栈上和堆上创建数组，如果要返回一个在函数中创建的数组，就需要在堆中创建

使用 new 创建数组，则会在内存中保存一个指针，指向一个指定内存大小的内存空间。这叫内存间接寻址。

```
char* buffer = new char[8];
memset(buffer, 0, 8);
delete[] buffer;
```

一般来说需要尽可能避免在堆中创建数组，因为在内存中跳跃肯定会影响性能。

C++11 中有内置数据结构 std::array，有边界检查，记录数组大小；(原始数组中不能在数组内存中访问到数组大小，需要自己维护)，因此会有一小些额外开销

---

## **字符串**

字符是如何工作的：默认通过 ascii 字符进行文本编码

字符串是字符数组加‘\0’，是不可变的，不能扩展字符串使它变大，是固定分配的字符串

由于字符串是数组，因此也是指针(char 指针)

在内存中，以 ascii 的 0 结束，即空终止字符，这用来给指针确定终点

C++有内置数据结构 std::string，是 baseString 类的模板版本

双引号里的东西是 const char 数组，不是真正的字符串

把对象传递给一个函数时，实际上是在复制这个对象，创建一个副本

所以当传递字符串，且只读时，使用常量引用

字符串字面量，双引号之间的一串字符，是 const char 数组/指针

修改字符串字面量是不被推荐的，因为取了一个指向那个字符串字面量的内存位置的指针，而字符串字面量是存储在内存的只读部分的。有的编译器甚至不会通过这样的代码；在 release 模式下会发现修改不成功，在 debug 模式下会抛出运行错误；这是未定义的行为。

如果确实需要修改，可以定义为数组而不是指针

```
#include <iostream>
#include <array>
#include <string>

void PrintString(const std::string& str)
{
	std::cout << str << std::endl;
}

int main5(void)
{
	int array[5] = { 0 };
	int* another_array = new int[5];
	delete[] another_array;

	std::array<int, 5> another;
	for (int i = 0; i < 5; i++)
	{
		another[i] = i;
	}
	std::cout << another.size() << std::endl;

	std::string name = "Hatrix, ";
	name += "Hello, RM!";
	const char* id = "fjdiosjafklds";
	PrintString(name);

	return 0;
}
```

---

## **const**

不会改变代码的生成，就好像类和结构体的可见性，仅对开发人员做规范

一种打破规范的方法是用指针来强制类型转换，但通常不要这么做

指向常量的指针和常量指针的含义，代码上表现为 const 在\*之前或者之后

另一种用法是在方法名的参数列表后加 const(只在类中有效)，表示这个方法不会修改实际的类，不会修改类成员的方法建议都加上。

> 当把一个对象声明为常量对象，或者，对象常量引用作为函数参数时，函数只能调用带有 const 的方法，因为不带 const 的方法不保证类本身不会被修改

---

## **mutable**

mutable 用于 const 方法中又确实需要修改的变量，比如供 debug 使用的指示标记(主要用途)

第二个用法是 lambda 表达式，表示通过值传递的变量，可以被改变

---

## **创建对象**

实例化一个对象要选择在堆上还是栈上创建，内存是从哪里来的，即在哪里创建对象

栈上创建的有自动的生存期，即生存期由声明地方的作用域决定

```
#include <iostream>
#include <string>

class Entity
{
private:
	std::string m_Name;
public:
	Entity() : m_Name("Unknown") {}
	Entity(const std::string& name) : m_Name(name) {};
	const std::string& GetName() const
	{
		return m_Name;
	}
};

int main(void)
{
	Entity entity = Entity("Hatrix"); //栈上创建对象
	std::cout << entity.GetName() << std::endl;

    Entity* entity2 = new Entity("Hatrix"); //堆上创建对象
    delete entity2;

	return 0;
}
```

上面展示的，是 C++中最快的方法，也是可以管控的方法，去初始化对象

如果对象太大，或者需要显式控制对象的生存期，就在堆上创建;在堆上创建，记得 delete

智能指针，超出作用域会被自动删除

---

## **new**

找到一块符合要求的内存，返回指向这块内存的指针

```
int* a = new int[20];
delete [] a;
```

指针只是一个内存地址，是因为需要类型来操作它

通常来说，调用 new 会调用 malloc 函数，实际作用是传入需要的内存大小，返回一个 void 指针；区别在于使用 new 创建对象会调用构造函数；在 C++中不要用前一种方式

同时，使用 new 一定要 delete

---

## **explicit**

隐式转换，比如把一个 int 直接赋值给对象，实际上是调用了以一个 int 作为参数的构造函数(把 int 转换为 Entity 类)

explicit 禁用了隐式 implicit 的功能，放在构造函数前面，强制开发者必须显式地调用构造函数

强制显示调用的作用，或者说，隐式构造可能导致的问题？

---

## **运算符和运算符重载**

通常代替一个函数，包括 new，delete 等等，实质都是为了避免重复代码而做的封装

```
#include <iostream>

class Vector2
{
private:
	float x;
	float y;

public:
	Vector2(float x, float y) : x(x), y(y){}

	void PrintVector() const
	{
		std::cout << "(" << x << "," << y << ")" << std::endl;
	}

	Vector2 operator+ (Vector2& other) const
	{
		return Vector2(x + other.x, y + other.y);
	}

	float operator* (Vector2& other) const
	{
		return x * other.x + y * other.y;
	}
};

int main(void)
{
	Vector2 vec1(2.0f, 3.0f);
	Vector2 vec2(4.0f, 5.0f);
	Vector2 vec3 = vec1 + vec2;
	float innerdot = vec1 * vec2;
	vec3.PrintVector();
	std::cout << vec1 * vec2 << std::endl;

	return 0;
}
```

---

## **this**

this 是一个指向当前对象实例的指针，该方法属于这个对象实例

this 的类型是对象的常量指针，可访问成员函数

---

## **对象的生存期**

每次进入作用域，相当于 push 栈帧，退出作用域，相当于 pop 栈帧

不要创建一个基于栈的变量然后返回它的指针

作用域指针，一个指针的包装器，在构造时用堆分配指针，在析构时删除指针

```
class ScopedPtr	//作用域指针类，自动构造，自动析构
{
private:
	int* value;
public:
	ScopedPtr(int* val) : value(val)
	{

	}

	~ScopedPtr()
	{
		delete value;
	}
};

int main(void)
{
	{
		ScopedPtr ptr = new int();	//隐式转换
	}

	return 0;
}
```

基于栈的变量，离开作用域就被销毁，有很多应用：作用域指针，计时器，互斥锁(锁定一个函数使得多个线程同时访问它时不会爆炸)(可以利用栈的特性有一个自动作用域锁定)

---

## **智能指针**

自己编写内存管理系统？内存管理模型

智能指针使得内存管理自动化，防止因为忘记 delete 而造成内存泄漏

创建时自动调用 new 分配内存，作用域结束时自动 delete

- 作用域指针 unique_ptr，不能复制一个 unique_ptr，因为如果两个指针指向同一块内存，通过一个指针将内存释放，另一个就会指向未被分配的内存，造成内存泄露。unique_ptr 的构造函数是 explicit 的，没有额外开销
- 共享指针 shaerd_ptr,实现的方式取决于编译器和在编译器中使用的标准库；工作原理是引用计数，即跟踪指针有多少个引用，引用计数归零时，指针被删除；稍有额外开销用于存储引用计数值
- shared_ptr 赋值给 shared_ptr 会增加引用计数，赋值给 weak_ptr 不会
- `#include <iostream>#include <memory>class Entity{public:	Entity()	{	std::cout << "Created Entity3" << std::endl;	}	~Entity()	{	std::cout << "Destroryed Entity3" << std::endl;	}	void Print() {}};int main(void){	std::unique_ptr<Entity> entity(new Entity());	entity->Print();	//如果构造函数碰巧抛出异常，下面这种方式不会得到没有引用的悬空指针，避免了内存泄露	std::unique_ptr<Entity> entity2 = std::make_unique<Entity>(); entity2->Print(); 	std::shared_ptr<Entity> entity3 = std::make_shared<Entity>(); entity3->Print();	return 0;}`

---

## **拷贝与拷贝构造函数**

拷贝要求的是复制内存，但当我们只是想读取、或是修改已经存在的对象时，可以避免不必要的复制

值复制，地址复制

浅拷贝，复制各个成员对象；

复制指针会使得两个指针同时指向一块内存，存在同一块内存被释放两次的风险；改变一个时，两者会被同时改变

深拷贝，复制整个对象，如拷贝构造函数

拷贝构造函数：当创建一个新变量并给它分配另一个变量时，它和正在创建的变量类型相同，复制这个变量，就是所谓的拷贝构造函数

不允许构造 / 不允许复制，可以把构造函数声明为 delete

对象在作为函数参数时，拷贝构造函数也会被调用，为了避免这个不必要的开销，可以传引用

```
#include <iostream>

class String
{
private:
	char* m_Buffer;
	unsigned int m_Size;
public:
	String(const char* str)
	{
		std::cout << "Constructed String!" << std::endl;
		m_Size = (unsigned int)strlen(str);
		m_Buffer = new char[m_Size + 1];
		memcpy(m_Buffer, str, m_Size);
		m_Buffer[m_Size] = '\\0';
	}

	// 拷贝构造函数
	String(const String& other) : m_Size(other.m_Size)
	{
		std::cout << "Copied String!" << std::endl;
		m_Buffer = new char[m_Size + 1];
		memcpy(m_Buffer, other.m_Buffer, m_Size + 1);
	}

	~String()
	{
		std::cout << "Destructed String!" << std::endl;
		delete[] m_Buffer;
	}

	friend std::ostream& operator<< (std::ostream& stream, const String& string);
};

std::ostream& operator<< (std::ostream& stream, const String& string)
{
	stream << string.m_Buffer;
	return stream;
}

void PrintString(const String& string)
{
	std::cout << string << std::endl;
}

int main(void)
{
	String str1 = String("Hatrix");
	String str2 = str1;
	PrintString(str1);
	PrintString(str2);

	return 0;
}
```

**在绝大多数情况下，总是通过 const 引用去传递对象，总是！**

**重载<<为什么这么写？**

---

## **箭头操作符**

除了正常用法之外，还可以重载用于自定义功能

## **静态数组**

std::array

---

## **动态数组**

开始**C++标准库，标准模板库**

标准模板库本质上是容器、容器类型的集合，可以模板化任何东西

std::vector：本质上是一个动态数组，不强制元素具有唯一性的集合；与标准数组不同的是，可以变化动态大小；标准库对其的实现，是超过了就再开辟一片足够容纳的内存空间，复制过来然后删除旧的。即通过经常分配去实现，故不能得到最佳性能，除非正确设置。

堆分配类对象，栈存储指向类对象的指针 or 栈分配类对象：视情况而定。前者内存连续，在技术上是最优的；但问题在于，当需要调整大小时，需要重新分配和复制所有东西，会非常慢；而指针则可以保持实际指向的内存不变。

如果可能的话，尽量使用对象而不是指针

优化：

C++语言能够很好地发挥优化的作用

优化最重要的规则是，了解你的环境，并知道如何使用可用的工具来优化它；比如，要优化复制，就要知道复制时什么时候发生的，为什么会发生

**对于使用但不特别深入地开发 C++本身，还有什么需要掌握的，或者有什么相对没那么重要？对于使用新框架呢？**

**C++涉及的优化，标准和实现；标准是 C++标准库对于容器和算法提供的方案，开发者也可以自己根据需求去实现**

**为什么说内存管理模型有很大差别，本身带有线程管理？**

**如果只使用类和对象、继承、多态、虚函数这些概念，是否可以认为几乎可以当作 C 来写，对于一个已经掌握 C 语言的人来说，几乎没有门槛**

如何避免复制操作

```
#include <iostream>
#include <string>
#include <vector>

struct Vertexffs
{
	float x, y, z;

	Vertex(float x, float y, float z) : x(x), y(y), z(z) {}

	Vertex(const Vertex& vertex) : x(vertex.x), y(vertex.y), z(vertex.z)
	{
		std::cout << "Copied" << std::endl;
	}
};

std::ostream& operator<< (std::ostream& stream, const Vertex& vertex)
{
	stream << "(" << vertex.x << "," << vertex.y << "," << vertex.z << ")";
	return stream;
}

int main(void)
{
	std::vector<Vertex> vertices;
	vertices.reserve(3); //reserve可以确保有足够的内存，但不创建对象
	vertices.push_back({ 1, 0, 0 });
	vertices.push_back({ 0, 1, 0 });
	vertices.push_back({ 0, 0, 1 });

	//emplace_back 不是传递已经构建的vertex对象，而是传递构造函数的参数列表；
	//在实际vector的内存中，使用以下参数，构造一个vertex对象
	std::vector<Vertex> another_vertices;
	another_vertices.reserve(3);
	another_vertices.emplace_back(1, 2, 3);
	another_vertices.emplace_back(4, 5, 6);
	another_vertices.emplace_back(7, 8, 9);

	for (int i = 0; i < vertices.size(); i++)
	{
		std::cout << vertices[i] << std::endl;
	}

	// 部分移除：通过迭代器完成
	vertices.erase(vertices.begin() + 1);

	for (Vertex& v : vertices)
	{
		std::cout << v << std::endl;
	}

	// 全部清零
	vertices.clear();

	return 0;
}
```

---

## **C++库**

C#和 python 中，通过包管理器来添加库

**包管理器是什么？**

如果是正式的项目，推荐构建源代码；可以添加一个项目，包含依赖库的源代码，然后自己编译为静态库或动态库

如果是一次性项目，推荐直接链接二进制文件

处理二进制文件(GLFW 库)

C++库的典型目录：includes(一堆头文件)和 library(预先构建的二进制文件)

静态库(.lib)表示库会被被放到可执行文件中，动态库(.dll)是在运行时被链接的；主要的区别是，库文件是否被编译或链接到 exe 文件中，还是作为一个单独的文件(dll)和 exe 放在一起

静态链接在技术上更快，因为编译器或链接器可以执行链接时优化之类的，但对于动态库，由于不知道会发生什么，动态链接库被运行时的程序装载时，程序的部分将被补充完整；所以，静态链接通常是最好的选择；

编译器指向头文件，链接器指向库文件

**github:project based learning**

**为什么需要静态和动态的设计**

引号和尖括号，引号先检查相对路径，找不到就检查编译器的 include 路径；如果在解决方案中，可以优先使用引号。如果是完全外部的库，优先使用尖括号

在 C++中使用 C 语言的库，需要写 extern "C"

静态链接有很多优化会发生，因为编译器和链接器完全知道实际进入应用程序的代码；动态链接有两种，一种是，可执行文件依赖于动态库，即已经知道里面有什么函数；另一种是，完全动态地加载动态库，可执行文件和动态库没有任何关系。即想任意加载这个动态库，甚至不用知道里面有什么

---

## **如何处理多返回值**

可以通过 vector 或者 array 类实现，需要类型相同

还可以通过 tuple 或者 pair 类实现，不关心类型

还可以返回一个结构体

---

## **模板 templates**

有点像宏，允许定义一个可以根据用途进行编的模板，可以让编译器基于一套规则为你写代码

比如，函数的大部分都相同，只是返回值不同

使用模板，只有实际调用时，这些函数才被真的创建；否则模板不会存在于代码中

通过指定模板参数得到不同函数，不同容器类型和大小

类似于模板元编程，在编译时实际在进行编程

```
#include <iostream>
#include <string>

template<typename T>
void Print(T value)
{
	std::cout << value << std::endl;
}

template<typename T, int N>
class Array
{
private:
	T m_array[N];
public:
	int GetSize() const
	{
		return N;
	}
};

int main(void)
{
	Print<int>(5); //也可以不写int，是隐式获得类型
	Print<std::string>("Hello RM!");

	Array<int, 3> array;
	std::cout << array.GetSize() << std::endl;

	return 0;
}
```

---

## **栈和堆的内存**

程序启动后，操作系统将整个程序加载到内存，并分配物理 RAM，栈通常是一个预定义大小的内存区域，堆也是一个预定义了默认值的区域，但可以随程序运行而变化，重要的是要知道两个内存区域的物理地址，我们可以向 C++申请内存空间，顺利则会返回给我们指定大小的内存空间

栈与堆的不同之处在于，如何为我们分配内存

栈的分配，实际上是移动栈顶指针；栈中的数据都是挨着的，只是把东西叠在一起，因此栈分配非常块，只需要移动栈指针并返回即可

堆的分配，内存不是连续的，除了智能指针外，需要手动释放内存；程序会维护一个 free list，跟踪哪些内存块是空闲的。堆上分配内存，需要：检查空闲列表，请求内存，做好记录

非必要不在堆上分配内存，都在栈上分配

## **宏**

字符串替换，反斜杠\用于多行

## **auto**

自动推断类型，一种变成风格

## **函数指针**

原始函数指针，函数名称提供了内存地址的索引，可以当作函数指针

```
void Hello()
{
	std::cout << "Hello!" << std::endl;
}

int main(void)
{
	void(*func_name)() = Hello;
	func_name();

	return 0;
}
```

## **lambda 表达式**

用完既弃的函数，不用声明，在运行过程中生成

不通过函数定义就可以定义一个函数的方法，使用函数指针的地方都可以设置为 lambda

## **命名空间**

尽量限制在一个小的作用域之内

## **二维数组**

指针数组，有内存碎片问题，会导致 cache miss，尽量使用一位数组；优化代码最重要的一点，就是优化内存访问

## **联合体**

类似于结构体，但一次只能占用一个成员的内存

---

## **一些补充**

volatile 影响编译器编译的结果,volatile 指出 变量是随时可能发生变化的，与 volatile 变量有关的运算，不要进行编译优化，以免出错，(VC++ 在产生 release 版可执行码时会 进行编译优化，加 volatile 关键字的变量有关的运算，将不进行编译优化。)

~按位取反
