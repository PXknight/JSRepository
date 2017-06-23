# 静态分析

## 介绍
您可能会熟悉一个花哨的IDE，它会在您的代码部分不编译的情况下绘制红色的下划线。您可能在代码上运行了一个linter来检查格式或样式问题。您可以在超级挑剔模式下运行编译器，并启用所有警告。所有这些工具都是静态分析的应用。

静态分析是一种在不运行代码的情况下检查代码中的问题的方法。“静态”是指在编译时而不是在运行时，“分析”意味着我们正在分析代码。当您使用上述工具时，可能会感觉到魔术。但是这些工具只是程序，它们是由一个人编写的源代码，像你这样的程序员。在本章中，我们将讨论如何实现一些静态分析检查。为了做到这一点，我们需要知道我们想要做的检查以及我们想做什么。

我们可以通过将过程描述为三个阶段来更具体地了解您需要知道的内容：

#### 1.决定你想要检查的内容。
您应该能够解释您想要解决的一般问题，就是编程语言的用户将会认识到。示例包括：

查找拼写错误的变量名
查找并行代码中的竞争条件
查找未实现的功能的调用
#### 2.决定如何检查它。
虽然我们可以请朋友做上面列出的任务之一，但它们并不足以说明电脑。例如，为了解决“拼错变量名”，我们需要确定这里是什么拼写错误的。一个选择是声明变量名称应该由字典中的英文单词组成; 另一个选择是查找只使用一次的变量（一次你输入错误）。

如果我们知道我们正在寻找只使用一次的变量，我们可以讨论各种可变用法（将其值分配给读取），以及什么代码将触发或不会触发警告。

#### 实施细节。
这包括编写代码的实际行为，阅读使用的库的文档的时间，以及如何获取编写分析所需的信息。这可能涉及阅读代码文件，解析它以了解结构，然后对该结构进行特定的检查。

我们将为本章中实施的每个单独检查来完成这些步骤。第1步需要对我们正在分析的语言有足够的了解，才能使用户面对问题。本章中的所有代码都是Julia代码，用于分析Julia代码。

## Julia的一个很简单的介绍
朱莉娅是一种针对技术计算的年轻语言。2012年春季发布版本为0.1版; 截至2015年初，已达到0.3版。一般来说，Julia看起来很像Python，但有一些可选的类型注释，没有任何面向对象的东西。大多数程序员将在Julia中发现小说的功能是多重调度，它对API设计和语言中的其他设计选择都有很大的影响。

以下是茱莉亚代码片段：
```js
# A comment about increment
function increment(x::Int64)
  return x + 1
end
```
increment(5)
该代码定义了一个函数的方法，该方法使用increment一个名为xtype的参数Int64。该方法返回值x + 1。然后，这个新定义的方法称为值5; 您可能已经猜到的函数调用将被评估6。

Int64是一种类型，其值是在内存中表示64位的有符号整数; 它们是您的硬件了解您的计算机是否具有64位处理器的整数。Julia中的类型除了影响方法分派之外，还定义了内存中数据的表示。

该名称increment是指通用函数，可能有很多方法。我们刚刚定义了一种方法。在许多语言中，术语“功能”和“方法”可互换使用; 在朱莉娅，他们有不同的含义。如果您谨慎理解“函数”作为命名的方法集合，则本章将更有意义，其中“方法”是特定类型签名的特定实现。

我们来定义increment函数的另一种方法：
```js
# Increment x by y
function increment(x::Int64, y::Number)
  return x + y
end
```
increment(5) # => 6
increment(5,4) # => 9
现在函数increment有两种方法。Julia根据参数的数量和类型决定运行给定调用的方法; 这被称为动态多调度：

* **动态**因为它是基于运行时使用的值的类型。
* **多个**因为它查看所有参数的类型和顺序。
* **调度**，因为这是一种匹配函数调用方法定义的方式。
要将其放在您可能已经知道的语言的上下文中，面向对象语言使用单个调度，因为它们只考虑第一个参数。（在x.foo(y)，第一个参数是x。）

单个和多个分派都基于参数的类型。的x::Int64上面是一个类型注释纯粹是为了调度。在Julia的动态类型系统中，您可以x在函数期间为任何类型的值分配一个值，而不会发生错误。

我们还没有真正看到“多重”部分，但如果你对朱莉娅好奇，你必须自己去看看。我们需要继续进行第一次检查。

检查循环中变量的类型
与大多数编程语言一样，在Julia中编写非常快速的代码涉及到计算机的工作原理以及Julia的工作原理。帮助编译器为您创建快速代码的重要部分是编写类型稳定的代码; 这在Julia和JavaScript中很重要，也有助于其他JIT的语言。当编译器可以看到代码部分中的变量将始终包含相同的特定类型时，编译器可以做出更多的优化，而不是认为（正确的或不正确的）该变量有多种可能的类型。您可以阅读更多关于为什么类型稳定性（也称为“单态”）对于JavaScript 在线很重要。

为什么这是重要的
我们来写一个函数，Int64并增加一些数量。如果数字小（小于10），我们可以增加一个数字（50），但是如果它很大，那我们只需要增加0.5。
```js
# Increment x by y

  if x < 10
    x = x + 50
  else
    x = x + 0.5
  end
  return x
end
```
这个功能看起来很简单，但是类型x不稳定。我选了两个数字：50，an Int64和0.5，a Float64。根据它的价值x，它可能被添加到其中之一。如果你添加一个Int6422，像一个Float640.5，你会得到一个Float64（22.5）。因为function（x）中变量的类型可以根据函数的参数值而改变x，所以这个increment变量的方法x是类型不稳定的。

Float64是表示以64位存储的浮点值的类型; 在C中，它被称为a double。这是64位处理器理解的浮点类型之一。

与大多数效率问题一样，当循环发生时，这个问题更加明显。代码里面的for循环和while循环运行很多次，所以使它快速比加速只运行一次或两次的代码更重要。因此，我们的第一个检查是在循环中查找不稳定类型的变量。

首先，我们来看一个我们想要捕捉的例子。我们将看两个功能。它们中的每一个将1到100的数字相加，而不是对整数进行求和，它们在将其加起来之前将它们除以2。两个函数都会得到相同的答案（2525.0）; 两者都将返回相同类型（Float64）。然而，第一个功能，unstable是类型不稳定，而第二个功能，stable不是。
```js
function unstable()
  sum = 0
  for i=1:100
    sum += i/2
  end
  return sum
end
```
```js
function stable()
  sum = 0.0
  for i=1:100
    sum += i/2
  end
  return sum
end
```
这两个函数之间唯一的文本差异在于初始化sum：sum = 0对sum = 0.0。在朱莉娅，0是一个Int64字面意思，0.0是一个Float64字面意思。这个微小变化有多大的区别？

因为Julia是Just-In-Time（JIT）编译的，所以函数的首次运行将比后续运行需要更长的时间。（第一次运行包括编译这些参数类型的函数所需的时间。）在对函数进行基准测试时，我们必须在定时之前运行一次（或预编译它们）。
```js
julia> unstable()
2525.0

julia> stable()
2525.0

julia> @time unstable()
elapsed time: 9.517e-6 seconds (3248 bytes allocated)
2525.0

julia> @time stable()
elapsed time: 2.285e-6 seconds (64 bytes allocated)
2525.0
```
在@time它运行时，宏打印出来的功能花了多长时间来运行和多少字节分配。每次需要新的内存时，分配的字节数增加; 当垃圾收集器吸收不再使用的存储器时，它不会减少。这意味着分配的字节与我们分配和管理内存的时间量有关，但并不意味着我们同时使用了所有的内存。

如果我们想获得的固体编号stable与unstable我们需要使循环更长的时间或运行的功能很多次。但是，看起来unstable可能比较慢。更有趣的是，我们可以看到分配的字节数量有很大的差距; unstable已经分配了大约3 KB的内存，其中stable使用64字节。

既然我们可以看到多么简单unstable，我们可能会猜测这个分配是在循环中发生的。为了测试这个，我们可以使循环更长，看看分配是否相应增加。让循环从1到10000，这是迭代次数的100倍; 我们将查找分配的字节数也增加约100倍，达到约300 KB。
```js
function unstable()
  sum = 0
  for i=1:10000
    sum += i/2
  end
  return sum
end
```
由于我们重新定义了这个函数，所以我们需要运行它，以便在我们测量之前编译它。我们期望从新功能定义中获得不同的更大的答案，因为它现在总结了更多的数字。
```js
julia> unstable()
2.50025e7

julia>@time unstable()
elapsed time: 0.000667613 seconds (320048 bytes allocated)
2.50025e7
```
新unstable分配了大约320 KB，这是我们期望的，如果分配发生在循环中。为了解释这里发生了什么，我们将看看朱莉娅如何在引擎盖下工作。

之间的这种差异unstable，并stable发生是因为sum在unstable必须装箱，而sum在stable可以拆箱。盒装值包括一个类型标签和代表该值的实际位; 未装箱的值只有其实际位。但是类型标签很小，所以这不是为什么拳击值分配更多的内存。

差异来自于编译器可以做出哪些优化。当一个变量有一个具体的，不变的类型时，编译器可以在函数内取消它。如果不是这样，那么必须在堆上分配变量，并参与垃圾回收器。不变类型是Julia特有的概念。不可变类型的值不能更改。

不变类型通常是表示值的类型，而不是值的集合。例如，大多数数字类型，包括Int64和Float64，是不可变的。（Julia中的数值类型是普通类型，不是特殊的原始类型;可以定义MyInt64与提供的类型相同的新的类型。）由于不可变类型无法修改，因此每次要更改一个时，都必须创建一个新的副本。例如，4 + 6必须使一个新的Int64来保持结果。相反，可变类型的成员可以就地更新; 这意味着你不必做一个整件事情的变更。

x = x + 2分配内存的想法听起来很奇怪; 为什么要让这样一个基本的操作变慢，使Int64价值不变？这就是编译器优化所在：使用不可变类型不会（通常）减慢这种速度。如果x有一个稳定的具体类型（如Int64），那么编译器可以自由地x在堆栈上进行分配并进行变异x。问题只有当x一个不稳定的类型（所以编译器不知道它是多大或什么类型）; 一旦x被装箱，在堆上，编译器并不完全确定某些其他代码片段没有使用该值，因此无法编辑它。

因为sum在stable具有具体类型（Float64），编译器知道它可以在功能本地存储它装箱和变异其值; sum不会在堆上分配，每次添加新副本都不需要i/2。

因为sum在unstable没有具体类型的情况下，编译器会将其分配到堆上。每次我们修改总和，我们在堆上分配了一个新的值。所有这一次，在堆上分配值（并且每次我们想要读取它的值时检索它们sum）是昂贵的。

使用0对比0.0是一个容易的错误，特别是当你刚刚到朱莉娅。自动检查循环中使用的变量是否类型稳定有助于程序员更好地了解其变量的类型在代码的性能关键部分。

### 实施细节
我们需要找出在循环中使用哪些变量，我们需要找到这些变量的类型。然后，我们需要决定如何以人类可读的格式打印它们。

* 我们如何找到循环？
* 我们如何在循环中找到变量？
* 我们如何找到变量的类型？
* 我们如何打印结果？
* 我们如何判断类型是否不稳定？
我要先解决最后一个问题，因为这一切都取决于它。我们已经看过一个不稳定的函数，作为程序员看到，如何识别一个不稳定的变量，但是我们需要我们的程序来找到它们。这听起来像是需要模拟函数来寻找其值可能改变的变量，这听起来像需要一些工作。幸运的是，对于我们来说，Julia的类型推断已经跟踪函数的执行情况来确定类型。

sumin 的类型unstable是Union(Float64,Int64)。这是一种UnionType特殊类型的类型，表示变量可以包含一组类型的值中的任何一种。类型的变量Union(Float64,Int64)可以保存类型的值Int64或Float64; 一个值只能有一个类型。A UnionType连接任何数量的类型（例如，UnionType(Float64, Int64, Int32)连接三种类型）。我们要查找UnionType循环中的d个变量。

将代码解析为代表性的结构是一项复杂的业务，随着语言的发展，代码越来越复杂。在本章中，我们将依赖于编译器使用的内部数据结构。这意味着我们不必担心读取文件或解析它们，但这意味着我们必须处理不受我们控制的数据结构，有时候会感到笨拙或丑陋。

除了所有的工作，我们将无需自己解析代码，因此使用编译器使用的相同数据结构意味着我们的检查将基于对编译器理解的准确评估 - 这意味着我们的检查将与代码实际运行的一致。

从Julia代码检查Julia代码的这个过程称为内省。当你或我内省时，我们正在考虑我们如何和为什么思考和感受。当代码内省时，它会以相同的语言（可能是其自己的代码）检查代码的表示或执行属性。当代码的内省扩展到修改被检查的代码时，它被称为元编程（编写或修改程序的程序）。

#### 朱莉娅的内省
朱莉娅很容易内省。有建于四大功能，让我们来看看编译器在想：code_lowered，code_typed，code_llvm，和code_native。那些按照编译过程中的输出顺序排列的顺序列出; 第一个最接近我们输入的代码，最后一个是最接近CPU运行的代码。对于本章，我们将重点介绍code_typed，这给了我们优化的类型推断的抽象语法树（AST）。
code_typed有两个参数：感兴趣的函数和一个元组的参数类型。例如，如果我们想在foo两Int64秒钟调用函数时看到AST ，那么我们将调用code_typed(foo, (Int64,Int64))。
```js
function foo(x,y)
  z = x + y
  return 2 * z
end
```
code_typed(foo,(Int64,Int64))
这是code_typed将返回的结构：
```js
1-element Array{Any,1}:
:($(Expr(:lambda, {:x,:y}, {{:z},{{:x,Int64,0},{:y,Int64,0},{:z,Int64,18}},{}},
 :(begin  # none, line 2:
        z = (top(box))(Int64,(top(add_int))(x::Int64,y::Int64))::Int64 # line 3:
        return (top(box))(Int64,(top(mul_int))(2,z::Int64))::Int64
    end::Int64))))
```
这是一个Array; 这允许code_typed返回多个匹配的方法。函数和参数类型的一些组合可能不能完全确定应该调用哪个方法。例如，您可以传递类似Any（而不是Int64）的类型。Any是类型层次结构顶部的类型; 所有类型都是Any（包括Any）的子类型。如果我们包括Any在我们的参数类型的元组，并有多个匹配方法，那么Array自code_typed会有它包含多个元素; 它将具有每个匹配方法一个元素。

让我们举出例子Expr，让它更容易谈论。
```js
julia> e = code_typed(foo,(Int64,Int64))[1]
:($(Expr(:lambda, {:x,:y}, {{:z},{{:x,Int64,0},{:y,Int64,0},{:z,Int64,18}},{}},
 :(begin  # none, line 2:
        z = (top(box))(Int64,(top(add_int))(x::Int64,y::Int64))::Int64 # line 3:
        return (top(box))(Int64,(top(mul_int))(2,z::Int64))::Int64
    end::Int64))))
```
我们感兴趣的结构在于Array：它是一个Expr。朱莉娅使用Expr（表达式的简称）代表其AST。（一个抽象的语法树是编译器如何看待代码的意义，就像当你必须在小学生中绘制句子时）。Expr我们得到的代表了一种方法。它有一些元数据（关于方法中出现的变量）和构成方法体的表达式。

现在我们可以问一些问题e。

我们可以Expr通过使用该names功能来查询哪些属性，它适用于任何Julia值或类型。它返回Array由该类型定义的名称（或值的类型）。
```js
julia> names(e)
3-element Array{Symbol,1}:
 :head
 :args
 :typ 
```
我们刚刚询问e了它的名字，现在我们可以问每个名字对应的值。一个Expr有三个属性：head，typ和args。
```js
julia> e.head
:lambda

julia> e.typ
Any

julia> e.args
3-element Array{Any,1}:
 {:x,:y}                                                                                                                                                                                     
 {{:z},{{:x,Int64,0},{:y,Int64,0},{:z,Int64,18}},{}}                                                                                                                                         
 :(begin  # none, line 2:
        z = (top(box))(Int64,(top(add_int))(x::Int64,y::Int64))::Int64 # line 3:
        return (top(box))(Int64,(top(mul_int))(2,z::Int64))::Int64
    end::Int64)
```
我们刚刚看到一些印刷品的印刷品，但这并不能告诉我们什么是他们的意思，或是如何使用它们。

head告诉我们这是什么样的表情？通常情况下，您可以在Julia中为此使用单独的类型，但是Expr可以对分析器中使用的结构进行建模。解析器是用Scheme的方言编写的，它将所有内容都作为嵌套列表构成。head告诉我们其余部分Expr是如何组织的，它代表什么样的表达方式。
typ是表达式的推断返回类型; 当您评估任何表达式时，它会产生一些价值。typ是表达式将评估的值的类型。对于几乎所有的Exprs，这个值将是Any（总是正确的，因为每个可能的类型都是一个子类型Any）。只有body类型推断的方法和其中的大多数表达式才能使其typ具体化。（因为type是一个关键字，此字段不能使用该字作为其名称。）
args是最复杂的部分Expr; 其结构根据其价值而有所不同head。它总是一个Array{Any}（一个无类型的数组），但是超出这个结构的变化。
在Expr代表一种方法中，将有三个要素e.args：
```js
julia> e.args[1] # names of arguments as symbols
2-element Array{Any,1}:
 :x
 :y
```
符号是用于表示变量，常量，函数和模块名称的特殊类型。它们是与字符串不同的类型，因为它们具体表示程序结构的名称。
```js
julia> e.args[2] # three lists of variable metadata
3-element Array{Any,1}:
 {:z}                                     
 {{:x,Int64,0},{:y,Int64,0},{:z,Int64,18}}
 {}
 ```                                       
上面的第一个列表包含所有局部变量的名称; 我们只有一个（z）在这里。第二个列表包含方法中每个变量的元组和参数; 每个元组都有变量名，变量的推断类型和数字。该数字以机器（而不是人为）友好的方式传达关于变量如何使用的信息。最后一个列表是捕获的变量名; 这个例子是空的。
```js
julia> e.args[3] # the body of the method
:(begin  # none, line 2:
        z = (top(box))(Int64,(top(add_int))(x::Int64,y::Int64))::Int64 # line 3:
        return (top(box))(Int64,(top(mul_int))(2,z::Int64))::Int64
    end::Int64)
```
前两个args元素是关于第三个的元数据。虽然元数据非常有趣，但现在还没有必要。重要的部分是方法的主体，这是第三个要素。这是另一种Expr。
```js
julia> body = e.args[3]
:(begin  # none, line 2:
        z = (top(box))(Int64,(top(add_int))(x::Int64,y::Int64))::Int64 # line 3:
        return (top(box))(Int64,(top(mul_int))(2,z::Int64))::Int64
    end::Int64)

julia> body.head
:body
```
这Expr是:body因为它是该方法的主体。
```js
julia> body.typ
Int64
这typ是该方法的推断返回类型。

julia> body.args
4-element Array{Any,1}:
 :( # none, line 2:)                                              
 :(z = (top(box))(Int64,(top(add_int))(x::Int64,y::Int64))::Int64)
 :( # line 3:)                                                    
 :(return (top(box))(Int64,(top(mul_int))(2,z::Int64))::Int64)  
 ```  
args持有表达式列表：方法的正文中的表达式列表。有几行注释的行号（即:( # line 3:)），但是大部分的正文都设置了z（z = x + y）的值并返回2 * z。请注意，这些操作已被Int64特定的内在函数所取代。所述top(function-name)表示的特性函数; 这是在茱莉亚的代码生成中实现的，而不是在朱莉娅。

我们还没有看到一个循环，所以让我们来试试看。
```js
julia> function lloop(x)
         for x = 1:100
           x *= 2
         end
       end
lloop (generic function with 1 method)

julia> code_typed(lloop, (Int,))[1].args[3]
:(begin  # none, line 2:
        #s120 = $(Expr(:new, UnitRange{Int64}, 1, :(((top(getfield))(Intrinsics,
         :select_value))((top(sle_int))(1,100)::Bool,100,(top(box))(Int64,(top(
         sub_int))(1,1))::Int64)::Int64)))::UnitRange{Int64}
        #s119 = (top(getfield))(#s120::UnitRange{Int64},:start)::Int64        unless 
         (top(box))(Bool,(top(not_int))(#s119::Int64 === (top(box))(Int64,(top(
         add_int))((top(getfield))
         (#s120::UnitRange{Int64},:stop)::Int64,1))::Int64::Bool))::Bool goto 1
        2: 
        _var0 = #s119::Int64
        _var1 = (top(box))(Int64,(top(add_int))(#s119::Int64,1))::Int64
        x = _var0::Int64
        #s119 = _var1::Int64 # line 3:
        x = (top(box))(Int64,(top(mul_int))(x::Int64,2))::Int64
        3: 
        unless (top(box))(Bool,(top(not_int))((top(box))(Bool,(top(not_int))
         (#s119::Int64 === (top(box))(Int64,(top(add_int))((top(getfield))(
         #s120::UnitRange{Int64},:stop)::Int64,1))::Int64::Bool))::Bool))::Bool
         goto 2
        1:         0: 
        return
    end::Nothing)
```
你会注意到身体里没有一个或者一个循环。由于编译器将代码从我们编写的代码转换为CPU了解的二进制指令，因此对人类有用的但不被CPU（如循环）理解的功能将被删除。循环已被重写为label和goto表达式。它goto有一个数字; 每个label也有一个数字。将goto跳转到该label用相同的号码。

### 检测和提取循环
我们将通过查找goto向后跳转的表达式来找到循环。

我们需要找到标签和gotos，并找出哪些匹配。我将首先给你全面的实施。在代码之后，我们将把它分开，检查这些片段。
```js
# This is a function for trying to detect loops in the body of a Method
# Returns lines that are inside one or more loops
function loopcontents(e::Expr)
  b = body(e)
  loops = Int[]
  nesting = 0
  lines = {}
  for i in 1:length(b)
    if typeof(b[i]) == LabelNode
      l = b[i].label
      jumpback = findnext(x-> (typeof(x) == GotoNode && x.label == l) 
                              || (Base.is_expr(x,:gotoifnot) && x.args[end] == l),
                          b, i)
      if jumpback != 0
        push!(loops,jumpback)
        nesting += 1
      end
    end
    if nesting > 0
      push!(lines,(i,b[i]))
    end

    if typeof(b[i]) == GotoNode && in(i,loops)
      splice!(loops,findfirst(loops,i))
      nesting -= 1
    end
  end
  lines
end
```
现在要解释一下：
```js
b = body(e)
```
我们首先得到方法体中的所有表达式Array。body是我已经实现的功能：
```js
  # Return the body of a Method.
  # Takes an Expr representing a Method,
  # returns Vector{Expr}.
  function body(e::Expr)
    return e.args[3].args
  end
```
接着：
```js
  loops = Int[]
  nesting = 0
  lines = {}
```
loops是一个Array标签行号，其中gotos是循环发生的。nesting表示我们当前在里面的循环数。lines是一个Array（索引，Expr）元组。
```js
  for i in 1:length(b)
    if typeof(b[i]) == LabelNode
      l = b[i].label
      jumpback = findnext(
        x-> (typeof(x) == GotoNode && x.label == l) 
            || (Base.is_expr(x,:gotoifnot) && x.args[end] == l),
        b, i)
      if jumpback != 0
        push!(loops,jumpback)
        nesting += 1
      end
    end
```
我们看看身体中的每个表情e。如果它是一个标签，我们检查是否有一个goto跳转到此标签（并发生在当前索引之后）。如果结果findnext大于零，那么这样一个goto节点就存在，所以我们将把它添加到loops（Array我们当前处于的循环）中，并增加我们的nesting级别。
```js
    if nesting > 0
      push!(lines,(i,b[i]))
    end
如果我们目前在循环中，我们将当前行推到我们的行数组中。

    if typeof(b[i]) == GotoNode && in(i,loops)
      splice!(loops,findfirst(loops,i))
      nesting -= 1
    end
  end
  lines
end
```
如果我们在GotoNode，那么我们检查一下循环结束。如果是这样，我们删除条目loops并减少我们的嵌套级别。

这个函数的结果是lines数组，一个数组（index，value）元组。这意味着数组中的每个值都具有方法body-body Expr的索引和该索引的值。每个元素lines都是一个发生在一个循环内的表达式。

#### 查找和输入变量
我们刚刚完成了loopcontents返回Expr循环内部的s 的函数。我们的下一个函数将是loosetypes一个Exprs 列表，并返回一个松散类型的变量列表。稍后，我们将通过输出loopcontents入loosetypes。

在循环中发生的每个表达式中，loosetypes搜索符号及其关联类型的出现。变量用法SymbolNode在AST中显示为s; SymbolNodes持有变量的名称和推断类型。

我们不能检查loopcontents收集的每个表达式，以查看它是否是SymbolNode。问题是每个Expr可能包含一个或多个Expr; 每个Expr可能包含一个或多个SymbolNodes。这意味着我们需要拉出任何嵌套Expr的东西，以便我们可以查看它们中的每一个SymbolNode。
```js
# given `lr`, a Vector of expressions (Expr + literals, etc)
# try to find all occurrences of a variables in `lr`
# and determine their types
function loosetypes(lr::Vector)
  symbols = SymbolNode[]
  for (i,e) in lr
    if typeof(e) == Expr
      es = copy(e.args)
      while !isempty(es)
        e1 = pop!(es)
        if typeof(e1) == Expr
          append!(es,e1.args)
        elseif typeof(e1) == SymbolNode
          push!(symbols,e1)
        end
      end
    end
  end
  loose_types = SymbolNode[]
  for symnode in symbols
    if !isleaftype(symnode.typ) && typeof(symnode.typ) == UnionType
      push!(loose_types, symnode)
    end
  end
  return loose_types
end
  symbols = SymbolNode[]
  for (i,e) in lr
    if typeof(e) == Expr
      es = copy(e.args)
      while !isempty(es)
        e1 = pop!(es)
        if typeof(e1) == Expr
          append!(es,e1.args)
        elseif typeof(e1) == SymbolNode
          push!(symbols,e1)
        end
      end
    end
  end
  ```
while循环遍历所有Exprs的内容，递归。每次循环找到一个SymbolNode，它将它添加到向量symbols。
```js
  loose_types = SymbolNode[]
  for symnode in symbols
    if !isleaftype(symnode.typ) && typeof(symnode.typ) == UnionType
      push!(loose_types, symnode)
    end
  end
  return loose_types
end
```
现在我们有变量及其类型的列表，所以很容易检查一个类型是否松动。loosetypes通过寻找一种特定类型的非混凝土类型，a UnionType。当我们认为所有非具体类型都是“失败”时，我们会得到更多的“失败”结果。这是因为我们使用其注释的参数类型来评估每个方法，这些参数类型可能是抽象的。

## 使此可用
现在我们可以对表达式进行检查，我们应该更容易地调用用户的代码。我们将创建两种方式来调用checklooptypes：

整体功能; 这将检查给定功能的每个方法。

一个表达 如果用户提取code_typed自己的结果，这将工作。
```js
## for a given Function, run checklooptypes on each Method
function checklooptypes(f::Callable;kwargs...)
  lrs = LoopResult[]
  for e in code_typed(f)
    lr = checklooptypes(e)
    if length(lr.lines) > 0 push!(lrs,lr) end
  end
  LoopResults(f.env.name,lrs)
end

# for an Expr representing a Method,
# check that the type of each variable used in a loop
# has a concrete type
checklooptypes(e::Expr;kwargs...) = 
 LoopResult(MethodSignature(e),loosetypes(loopcontents(e)))
 ```
我们可以通过一种方法看到这两个选项对于函数的功能相同：
```js
julia> using TypeCheck

julia> function foo(x::Int)
         s = 0
         for i = 1:x
           s += i/2
         end
         return s
       end
foo (generic function with 1 method)

julia> checklooptypes(foo)
foo(Int64)::Union(Int64,Float64)
    s::Union(Int64,Float64)
    s::Union(Int64,Float64)


julia> checklooptypes(code_typed(foo,(Int,))[1])
(Int64)::Union(Int64,Float64)
    s::Union(Int64,Float64)
    s::Union(Int64,Float64)
```
#### 漂亮的印刷
我在这里跳过了一个实现细节：我们如何将结果打印到REPL？

首先，我做了一些新的类型。LoopResults是检查整个功能的结果; 它具有每种方法的功能名称和结果。LoopResult是检查一种方法的结果; 它有参数类型和松散类型的变量。

该checklooptypes函数返回a LoopResults。这个类型有一个叫做show定义的函数。REPL调用display它想要显示的值; display然后会调用我们的show实现。

该代码对于使静态分析可用，但不进行静态分析很重要。您应该使用漂亮打印类型的首选方法，并以实现语言输出; 这是在朱莉娅如何做的。
```js
type LoopResult
  msig::MethodSignature
  lines::Vector{SymbolNode}
  LoopResult(ms::MethodSignature,ls::Vector{SymbolNode}) = new(ms,unique(ls))
end

function Base.show(io::IO, x::LoopResult)
  display(x.msig)
  for snode in x.lines
    println(io,"\t",string(snode.name),"::",string(snode.typ))
  end
end

type LoopResults
  name::Symbol
  methods::Vector{LoopResult}
end

function Base.show(io::IO, x::LoopResults)
  for lr in x.methods
    print(io,string(x.name))
    display(lr)
  end
end
```
## 寻找未使用的变量
有时候，当你输入你的程序时，你会输入一个变量名。该程序不能告诉你，这意味着与之前拼写正确的变量是一样的; 它看到一个变量只使用一次，您可能会看到一个变量名称拼写错误。需要变量声明的语言自然会捕获这些拼写错误，但是许多动态语言不需要声明，因此需要额外的分析层来捕捉它们。

我们可以通过查找仅使用一次的变量（或仅使用一种方式）来找到拼写错误的变量名称（和其他未使用的变量）。

这是一个有一个拼写错误的名字的代码的例子。
```js
function foo(variable_name::Int)
  sum = 0
  for i=1:variable_name
    sum += variable_name
  end
  variable_nme = sum
  return variable_name
end
```
这种错误可能会导致您的代码中的问题，只有在运行时才会被发现。我们假设你每个变量名称只拼错一次。我们可以将变量用法分成写入和读取。如果拼写是写（即worng = 5），则不会抛出任何错误; 你只是默默地把这个值放在错误的变量中 - 找到这个错误可能是令人沮丧的。如果拼写错误是读（即right = worng + 2），那么运行代码时会出现运行时错误; 我们希望有一个静态警告，所以你可以尽快找到这个错误，但你仍然必须等到运行代码才能看到问题。

随着代码变得越来越复杂，除非你有静态分析的帮助，否则变得越来越难。

### 左手边和右手边
谈论“阅读”和“写”用法的另一种方法是将其称为“右侧”（RHS）和“左侧”（LHS）用法。这是指变量相对于=符号的位置。

以下是一些用法x：

* 左手边：
```js
x = 2
x = y + 22
x = x + y + 2
x += 2（去糖x = x + 2）
```
* 右侧：
```js
y = x + 22
x = x + y + 2
x += 2（去糖x = x + 2）
2 * x
x
```
请注意，由于出现在符号的两侧，因此在两个部分中都会出现x = x + y + 2并x += 2出现。x=

### 寻找一次性变量
有两种情况需要寻找：

1. 变量使用一次。
2. 仅在LHS上使用的变量或仅在RHS上使用。
我们将寻找所有可变的用法，但我们将分别寻找LHS和RHS用法，以涵盖这两种情况。

#### 查找LHS用法
要在LHS上，变量需要=在左边有一个标志。这意味着我们可以=在AST中查找符号，然后在左边找到相关的变量。

在AST中，一个=是Expr头:(=)。（括号中有明确的说明，这是=另一个运算符的符号，而不是另一个运算符:=。）第一个值args将是LHS上的变量名。因为我们正在看一下编译器已经清理的AST，所以几乎总是只是我们=标志左边的一个符号。

我们来看看代码中的含义：
```js
julia> :(x = 5)
:(x = 5)

julia> :(x = 5).head
:(=)

julia> :(x = 5).args
2-element Array{Any,1}:
  :x
 5  

julia> :(x = 5).args[1]
:x
```
下面是完整的实现，接下来是一个解释。
```js
# Return a list of all variables used on the left-hand-side of assignment (=)
#
# Arguments:
#   e: an Expr representing a Method, as from code_typed
#
# Returns:
#   a Set{Symbol}, where each element appears on the LHS of an assignment in e.
#
function find_lhs_variables(e::Expr)
  output = Set{Symbol}()
  for ex in body(e)
    if Base.is_expr(ex,:(=))
      push!(output,ex.args[1])
    end
  end
  return output
end
  output = Set{Symbol}()
我们有一套符号; 那些是我们在LHS上找到的变量名。

  for ex in body(e)
    if Base.is_expr(ex,:(=))
      push!(output,ex.args[1])
    end
  end
```
我们没有深入到表达中，因为code_typedAST是相当平坦的; 循环和ifs已经转换为带有gotos的平坦语句用于控制流程。在函数调用的参数中隐藏任何任务。如果符号位于等号左侧，则该代码将失败。这丢失了两个特定的边缘情况：数组访问（如a[5]，将被表示为:ref表达式）和属性（如a.head，将被表示为:.表达式）。这些仍然会有相关的符号作为他们的第一个值args，它可能只是被埋葬了一些a.property.name.head.other_property。该代码不处理这些情况，但是if语句中的几行代码可以解决这个问题。

      push!(output,ex.args[1])
当我们找到一个LHS变量的用法时，我们push!将变量名称放入Set。在Set将确保我们只有每个名称的一个副本。

#### 查找RHS用法
要找到所有其他变量用法，我们还需要查看每个变量Expr。这是一个更多的参与，因为我们基本上关心所有Expr的，而不只是:(=)那些，因为我们必须挖掘嵌套Expr（以处理嵌套函数调用）。

这是完整的实现，下面的解释。
```js
# Given an Expression, finds variables used in it (on right-hand-side)
#
# Arguments: e: an Expr
#
# Returns: a Set{Symbol}, where each e is used in a rhs expression in e
#
function find_rhs_variables(e::Expr)
  output = Set{Symbol}()

  if e.head == :lambda
    for ex in body(e)
      union!(output,find_rhs_variables(ex))
    end
  elseif e.head == :(=)
    for ex in e.args[2:end]  # skip lhs
      union!(output,find_rhs_variables(ex))
    end
  elseif e.head == :return
    output = find_rhs_variables(e.args[1])
  elseif e.head == :call
    start = 2  # skip function name
    e.args[1] == TopNode(:box) && (start = 3)  # skip type name
    for ex in e.args[start:end]
      union!(output,find_rhs_variables(ex))
    end
  elseif e.head == :if
   for ex in e.args # want to check condition, too
     union!(output,find_rhs_variables(ex))
   end
  elseif e.head == :(::)
    output = find_rhs_variables(e.args[1])
  end

  return output
end
```
该函数的主要结构是一个大的if-else语句，其中每种情况都处理不同的头符号。
```js
  output = Set{Symbol}()
```
output是一组变量名，我们将在函数结束时返回。由于我们只关心这些变量每个至少被读取一次的事实，所以Set我们不用担心每个名字的唯一性。
```js
  if e.head == :lambda
    for ex in body(e)
      union!(output,find_rhs_variables(ex))
    end
```
这是if-else语句中的第一个条件。A :lambda代表一个函数的正文。我们在定义的正文上递归，这应该在定义中得到所有的RHS变量用法。
```js
  elseif e.head == :(=)
    for ex in e.args[2:end]  # skip lhs
      union!(output,find_rhs_variables(ex))
    end
```
如果头是:(=)，那么表达是一个赋值。我们跳过第一个元素，args因为这是分配给的变量。对于每个剩下的表达式，我们递归地找到RHS变量并将它们添加到我们的集合中。
```js
  elseif e.head == :return
    output = find_rhs_variables(e.args[1])
```
如果这是一个return语句，那么第一个元素args是返回其值的表达式; 我们将把任何变量添加到我们的集合中。
```js
  elseif e.head == :call
    # skip function name
    for ex in e.args[2:end]
      union!(output,find_rhs_variables(ex))
    end
```
对于函数调用，我们要获取调用所有参数中使用的所有变量。我们跳过函数名，这是第一个元素args。
```js
  elseif e.head == :if
   for ex in e.args # want to check condition, too
     union!(output,find_rhs_variables(ex))
   end
```
一个Expr表示if语句的head值:if。我们想要从if语句正文中的所有表达式获得变量用法，所以我们在每个元素上递归args。
```js
  elseif e.head == :(::)
    output = find_rhs_variables(e.args[1])
  end
```
该:(::)运营商用于添加类型注释。第一个参数是被注释的表达式或变量; 我们在注释表达式中检查变量用法。
```js
  return output
```
在函数结束时，我们返回一组RHS变量的用法。

还有一些更多的代码简化了上面的方法。因为上面的版本只处理Exprs，而是递归传递的一些值可能不是Exprs，我们需要更多的方法来适当地处理其他可能的类型。
```js
# Recursive Base Cases, to simplify control flow in the Expr version
find_rhs_variables(a) = Set{Symbol}()  # unhandled, should be immediate val e.g. Int
find_rhs_variables(s::Symbol) = Set{Symbol}([s])
find_rhs_variables(s::SymbolNode) = Set{Symbol}([s.name])
```
#### 把它放在一起
现在我们有上面定义的两个函数，我们可以一起使用它们来查找只读取或只写入的变量。找到它们的函数将被调用unused_locals。
```js
function unused_locals(e::Expr)
  lhs = find_lhs_variables(e)
  rhs = find_rhs_variables(e)
  setdiff(lhs,rhs)
end
```
unused_locals将返回一组变量名。写一个函数很容易，它确定unused_locals计数的输出是否为“通过”。如果集合为空，则该方法通过。如果函数的所有方法都通过，则函数通过。check_locals下面的功能实现了这个逻辑。
```js
check_locals(f::Callable) = all([check_locals(e) for e in code_typed(f)])
check_locals(e::Expr) = isempty(unused_locals(e))
```
## 结论
我们已经对Julia代码一进行了两次静态分析，其中基于类型和基于变量的用法。

静态类型语言已经进行了基于类型分析的工作; 其他基于类型的静态分析主要用于动态类型语言。已有（主要研究）项目为Python，Ruby和Lisp等语言构建静态类型推理系统。这些系统通常围绕可选类型注释构建; 您可以在需要静态类型时使用静态类型，如果没有静态类型，则可以使用静态类型。这对于将一些静态类型集成到现有代码库中尤其有用。

非基于类型的检查，如我们的可变用例检查，适用于动态和静态类型的语言。然而，许多静态类型的语言（如C ++和Java）要求您声明变量，并已经提供了类似于我们创建的基本警告。仍然可以编写自定义检查; 例如，基于安全策略的特定于项目风格指南的检查或额外的安全预防措施。

虽然Julia确实有很好的工具来实现静态分析，但并不孤单。当然，Lisp以将代码作为嵌套列表的数据结构而闻名，因此在AST中往往很容易。Java也暴露了它的AST，尽管AST比Lisp复杂得多。一些语言或语言工具链并不是为了允许用户在内部表示中使用。对于开源工具链（特别是评论较好的工具链），一个选项是添加钩子到环境，让您访问AST。

如果这种情况不起作用，最后的回退就是自己编写一个解析器; 这是可以避免的。涵盖大多数编程语言的完整语法是很多工作，您必须自己更新，因为新功能被添加到语言（而不是从上游自动获取更新）。根据您要做的检查，您可能只能解析一些行或一部分语言功能，从而大大降低编写自己的解析器的成本。

希望您对如何编写静态分析工具的新了解将有助于您了解您在代码中使用的工具，也可能激励您编写自己的工具。