# TwinCAT 3 与 CODESYS：客户接入路径及验收候选项

检索日期：2026-09-11。范围：第三方 EtherCAT CoE/CiA402 驱动接入 TwinCAT 3 NC PTP、CODESYS SoftMotion。本文为公开资料调研，未接入本产品实机；“事实”仅指对应厂商文档，“建议”是拟议验收要求，“未知”须由产品资料或实测关闭。不同 PLC 的同名功能块不能直接视为相同行为。

## 已核实的客户路径

**事实：TwinCAT 有配置、运动控制、PLC 三层路径。** 客户先安装厂商 ESI，再在线扫描或离线添加从站。缺少对应描述时，TwinCAT 可能提出使用从站在线描述；这一路径与安装正式 ESI 的交付应分别验证。[T1] 对 CiA402 轴，第三方 Zaber 的官方实例展示 NC 轴与 I/O 的关联；Beckhoff 文档再要求 PLC 的 `AXIS_REF` 与 NC 轴关联，使用 `Tc2_MC2` 运动块。[T2][T3] 因此，I/O 已 OP、NC 面板能点动、PLC 程序能运动是三个检查点，不能互相替代。

**事实：配置来源会改变重启结果。** TwinCAT Startup 邮箱请求按列表顺序在指定状态转换执行；CODESYS Start Parameters 也按列表顺序下发，并提供错误中止或继续策略。[T4][C4] **建议：** 明确 ESI 默认值、PLC 启动参数、在线 SDO 写入、驱动非易失存储的归属和优先级；交付“改参数→重启主站→驱动断电→读回”的实例，解释为何在线修改可能被启动列表覆盖。

**事实：CODESYS 接入也有前置条件。** 官方 EtherCAT 教程要求安装 ESI 到设备库；网络扫描前需先下载工程，让控制器加载协议栈，否则扫描会报协议栈不可用。[C1] 添加 Generic SoftMotion CiA402 轴要求 ESI 声明 `ProfileNo 402`。[C2] 通用轴文档明确兼容性取决于驱动实现：ESI 通道声明影响轴数，`0x1000` 的低位必须标识 402；使能时的状态字位12、`0x6060/0x6061` 模式握手、停止及回零等待均有适配参数。[C3] **建议：** 发布经过验证的驱动参数配置，而不是让客户逐个关闭检查直到能动。

**事实：周期、单位和任务归属不是一个设置。** TwinCAT NC 位置比例由编码器输入比例设置；数字速度输出另有速度比例设置。[T5] CODESYS 总线周期任务承担实际 I/O 交换，多任务写同一输出会产生未定义结果。[C5] CODESYS 的 DC 主站周期、同步偏移会影响数据到达时刻；SoftMotion 还检查功能块是否在轴的总线任务调用。[C6][C7] **建议：** 每个支持模式交付 PDO 模板、对象单位、总线/运动任务周期、DC 配置及 `0x60C2` 写入策略；不把某厂商要求的 Sync0 比例或某个周期数值写成本产品通用要求。

**事实：同名回零、使能、复位容易误解。** TwinCAT `MC_Home` 使用 NC 编码器 Reference Mode；CODESYS `MC_Home` 启动驱动回零，而 `SMC_Homing` 由控制器执行。[T6][C8] TwinCAT `MC_Power` 管软件使能，必要的硬件使能需另外处理；`MC_Reset` 复位 NC 后，部分驱动仍需单独复位。[T7][T8] Zaber 甚至明确其 E-MCC 不能直接按常规 TwinCAT `MC_Home` 路径使用，并提供驱动回零示例；此结论仅适用于该产品，作为交付差异的实例。[T2]

**事实：恢复流程存在版本差异。** CODESYS SoftMotion 从 4.18.0.0 起，默认在现场总线通信恢复后自动重新初始化轴；此前通常需显式调用 `SMC3_ReinitDrive`，设置也可恢复旧行为。[C9] 这不等于授权自动恢复运动。**建议：** 分别定义通信重连、轴初始化、清除驱动故障、重新使能、重新执行运动的条件；恢复后旧命令是否残留必须实测。

## 可执行验收候选项（均为建议，尚未执行）

所有项目均保留工程、ESI/固件版本及哈希、PLC/运行时/运动库版本、操作步骤、日志或波形。性能容差、最大恢复时间及次数待产品规格确定，空白不能判通过。

| ID | 客户操作与分支 | 通过条件与证据 |
|---|---|---|
| TC-CS-01 | 干净工程安装正式 ESI；分别离线添加、在线扫描 | 厂商/产品/修订、轴数、默认 PDO 一致；说明版本冲突及错误 ESI 的诊断 |
| TC-CS-02 | TwinCAT 建 NC 轴、关联 I/O；再建 PLC 轴引用 | 两层关联均正确；面板点动与 PLC 点动均成功，无错轴 |
| TC-CS-03 | CODESYS 下载空总线工程、扫描、添加通用轴 | 能识别从站并创建正确通道；记录所用专用/通用驱动及全部适配参数 |
| TC-CS-04 | 默认 PDO；再逐一使用每个承诺的可选 PDO 模板 | 对象、子索引、方向、位宽、符号、映射限制与固件一致；重启后进入 OP |
| TC-CS-05 | Startup SDO 写入、在线改值、主站重启及驱动断电 | 每一步读回值符合已说明的配置归属；不支持的写入返回可定位的错误 |
| TC-CS-06 | 每个支持周期/DC模式；额定最大轴数和实际负载 | 无超周期/失同步；记录主站抖动、同步诊断、跟随误差，满足已定指标 |
| TC-CS-07 | 正负低速点动、已知距离、减速比及方向反转 | 命令/反馈/实测距离、速度和方向一致；单位换算不重复，边界不溢出 |
| TC-CS-08 | 上电使能、运动中撤使能、快速重使能 | PLC块、CiA402状态、硬件使能及制动时序一致；位12/模式不匹配有明确诊断 |
| TC-CS-09 | 绝对/相对/速度运动；重复 Execute、Halt、Stop、缓冲/中断 | Busy/Done/CommandAborted/Error符合所选库；Stop解除条件明确，无残留命令 |
| TC-CS-10 | 所有承诺回零方法；初始在开关上、找不到开关、反向触限 | 方向、超时、原点与完成信号正确；PLC回零和驱动回零分别留证据 |
| TC-CS-11 | 回零中 Stop/失使能/断网；复位后再次回零和定位 | 无假完成；模式正确切回；位置连续性及回零有效性符合约定 |
| TC-CS-12 | 正负软/硬限位；故障仍存在时复位、清因后复位 | 能定位 PLC、NC/轴、驱动错误；拒绝不合法运动，允许约定的脱离方向 |
| TC-CS-13 | PLC Stop/Run、断网重连、驱动重启、不同上电先后 | 分层恢复行为符合约定；旧运动不自行重发，位置/回零状态正确 |
| TC-CS-14 | 在另一台工程电脑恢复交付工程，更换同型驱动 | 不依赖开发者缓存或口头步骤；配置可恢复，设备修订差异有处置流程 |

## 仍需产品方确认

复核补充两类客户路径：TwinCAT `MC_MoveAbsolute` 在两种位置监控都关闭时，`Done` 可仅表示逻辑轨迹结束，因此物理定位精度必须独立测量。[Beckhoff：完成判据](https://infosys.beckhoff.com/content/1033/tcplclib_tc2_mc2/70094731.html) CODESYS `MC_SetOverride` 的作用依功能块而异：不作用于 `MC_Stop` 和驱动执行的 `MC_Home`，速度倍率也不作用于 `MC_Halt`；建议逐项测试倍率降低、置零与恢复，不能以倍率零替代停止功能。[CODESYS：Dynamic Adaptation](https://content.helpme-codesys.com/en/CODESYS%20SoftMotion/_sm_adjust_dynamics.html) 两页均于2026-09-11读取官方正文。

优先确认客户 PLC 品牌/型号/版本及故障案例；承诺的 CSP/CSV/CST、PP/PV/HM 等模式；单/多轴 ESI 与固件版本；PDO 是否可变、周期/DC限制、单位和电子齿轮；原点/限位接驱动还是 PLC、编码器类型与断电位置策略；失联、使能撤销和制动策略。通用 EtherCAT I/O 直接写 CiA402 的客户路径、SoftMotion Light、NC/CNC/插补同步扩展须另立适用范围，不能用本表一次通过替代。

## 一手来源

以下均于 2026-09-11 检索。在线帮助可能滚动更新；正式验收还须冻结实际版本对应手册。

| 引用 | 厂商官方页面与用途 |
|---|---|
| T1 | [Beckhoff：ESI device description](https://infosys.beckhoff.com/content/1033/em7004/1036998411.html)，安装、在线描述、异常ESI |
| T2 | [Zaber：TwinCAT3 Setup Guide](https://www.zaber.com/manuals/E-MCC/TwinCAT3-Setup-Guide)，第三方接入、双层绑定及产品专属回零限制实例 |
| T3 | [Beckhoff：Simple movement via the PLC](https://infosys.beckhoff.com/content/1033/tf50x0_tc3_nc_ptp/10541540363.html)，AXIS_REF 与 PLCopen |
| T4 | [Beckhoff：EtherCAT subscriber configuration](https://infosys.beckhoff.com/content/1033/el3692/1037003019.html)，Startup 下发时机与顺序 |
| T5 | [Beckhoff：Position and Velocity Scaling](https://infosys.beckhoff.com/content/1033/tf50x0_tc3_nc_ptp/3443848843.html)，NC 比例设置 |
| T6 | [Beckhoff：MC_Home](https://infosys.beckhoff.com/content/1033/tcplclib_tc2_mc2/70117515.html)，NC 回零语义 |
| T7 | [Beckhoff：MC_Power](https://infosys.beckhoff.com/content/1033/tcplclib_tc2_mc2/70049419.html)，软件与硬件使能 |
| T8 | [Beckhoff：MC_Reset](https://infosys.beckhoff.com/content/1033/tcplclib_tc2_mc2/70050955.html)，轴与驱动复位边界 |
| C1 | [CODESYS：EtherCAT commissioning tutorial](https://content.helpme-codesys.com/en/CODESYS%20EtherCAT/_ecat_tutorial.html)，ESI、协议栈加载与扫描 |
| C2 | [CODESYS：Add SoftMotion CiA402 Axis](https://content.helpme-codesys.com/en/CODESYS%20SoftMotion/_sm_cmd_add_softmotion_cia402_axis.html)，ESI ProfileNo 前提 |
| C3 | [CODESYS：Generic CiA402 Axis](https://content.helpme-codesys.com/en/CODESYS%20SoftMotion/_sm_drives_generic_cia402_axis.html)，兼容性、对象及握手参数 |
| C4 | [CODESYS：Start Parameters](https://content.helpme-codesys.com/en/CODESYS%20EtherCAT/_ecat_edt_slave_start_parameter.html)，启动SDO顺序及错误策略 |
| C5 | [CODESYS：Bus Cycle Task – EtherCAT](https://content.helpme-codesys.com/en/CODESYS%20EtherCAT/_ecat_buscycle_task.html)，I/O与任务关系 |
| C6 | [CODESYS：EtherCAT Master – General](https://content.helpme-codesys.com/en/CODESYS%20EtherCAT/_ecat_edt_master_master.html)，DC周期及偏移 |
| C7 | [CODESYS：Common Errors](https://content.helpme-codesys.com/en/CODESYS%20SoftMotion/_sm_basic_common_errors.html)，任务调用和失同步诊断 |
| C8 | [CODESYS：Single Axis Movement Overview](https://content.helpme-codesys.com/en/CODESYS%20SoftMotion/_sm_overview_single_axis_movement.html)，两种回零入口 |
| C9 | [CODESYS：Standard Use Cases](https://content.helpme-codesys.com/en/CODESYS%20SoftMotion/_sm_special_use_cases.html)，版本相关重初始化 |
