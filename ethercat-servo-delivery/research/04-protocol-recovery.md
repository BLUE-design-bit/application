# 协议、同步、异常恢复与售后诊断调研

检索日期：2026-09-11。适用对象：通过 EtherCAT CoE / CiA 402 接入 PLC 的伺服驱动器。本文是验收设计输入，尚未执行实机测试。

## 已确认事实及边界

1. **通信就绪与驱动使能分属不同状态机。** ESM 管理 INIT、PREOP、SAFEOP、OP 等通信阶段；CiA 402 PDS FSA 管理驱动功率与命令接受状态，由控制字、状态字及内部事件共同决定。因此不能用“已到 OP”证明轴已使能或可以运动。[ESM](https://infosys.beckhoff.com/content/1033/el15xx/1036980875.html)、[CiA 官方概述](https://www.can-cia.org/can-knowledge/cia-402-series-canopen-device-profile-for-drives-and-motion-control)
2. **PDO 与 SDO 要分别验收。** CoE SDO 访问对象字典；Complete Access 一次访问对象的多个子项，是需声明和验证的能力。Beckhoff 官方诊断包含整对象写失败后改用单项访问的案例，不能由单项成功推出整对象成功。[SDO 功能块](https://infosys.beckhoff.com/content/1033/tcplclib_tc2_ncdrive/2299303947.html)、[Complete Access 配置](https://infosys.beckhoff.com/content/1033/tc3_io_intro/1357984011.html)、[实际错误说明](https://infosys.beckhoff.com/content/1033/ax8xxx_diags/18793768715.html)
3. **同步、数据有效性与超时是不同问题。** DC 提供分布式时钟；WKC 用于检查数据报预期参与情况；SM watchdog 监测过程数据通信超时，PDI watchdog 监测 ESC 与本地处理器间通信。不能用 WKC 正常证明轨迹及时更新。厂商 watchdog 默认值及退态行为不可推广为通用伺服要求。[ETG 技术介绍](https://www.ethercat.org/en/technology.html)、[Beckhoff watchdog 说明](https://infosys.beckhoff.com/content/1033/el40xx/1036979339.html)
4. **模式决定部分位的含义。** 状态字存在模式专用位；PP、Homing、CSP 的确认或完成逻辑不能共用固定整字相等判断。CSP 由控制器周期下发目标位置；重新接管时须验证目标和实际坐标的一致性，这是由其工作机制导出的工程建议。[状态字实现示例](https://doc-legacy.synapticon.com/software/44/documentation_html/object_htmls/6041/index.html)、[Kollmorgen CSP](https://webhelp.kollmorgen.com/studio/Content/Kollmorgen%20Studio/3%207%20Cyclic%20Synchronous%20Position%20mode%20%28csp%29.htm)
5. **绝对编码器不等于机器坐标总是有效。** PLC 对反馈的绝对值、增量、模数解释及保持数据会影响重启恢复。CiA 官网指出 2024 修订引入 64 位位置，验收应按产品声明位宽，不能把所有设备硬定为 32 位。[编码器解释](https://infosys.beckhoff.com/content/1033/tf50x0_tc3_nc_ptp/3439907723.html)、[CiA 修订说明](https://www.can-cia.org/can-knowledge/cia-402-series-canopen-device-profile-for-drives-and-motion-control)

ETG 会员规范与相关 IEC / CiA 规范全文本次未获取核验，故不提供强制条款号。公开厂商手册只证明特定实现；选配功能、位定义、可写状态及阈值须以本产品声明和适用规范为准。

## 验收候选：从启动到现场恢复

以下均为**工程建议**。共用记录：PLC 型号及软件版本、驱动硬件/固件、ESI、参数备份、拓扑、PDO/DC 配置、步骤、期望、实测、日志。时间/误差/循环次数先填产品承诺与客户需求，未定义不判通过。运动故障注入先在受控试验台完成。

| ID | 客户操作或异常 | 应验证的结果与证据 |
|---|---|---|
| PR-01 | PLC、控制电、动力电以不同先后上电 | 状态转换和等待条件可解释；动力电晚到不引起未授权运动。记录 ESM、6040/6041 与电源。 |
| PR-02 | 分别请求 INIT→PREOP→SAFEOP→OP 及退态 | 每层输入/输出有效性符合声明；失败记录 AL 状态码，OP 与轴使能分开显示。 |
| PR-03 | 首次使能、撤使能、Quick Stop、Fault Reset | 按已支持转换验证；记录减速、抱闸、扭矩行为及复位前置条件，不仅检查位变化。 |
| PR-04 | 对象逐项读写、错误索引/长度/权限/状态 | 正确操作生效，错误操作给出可定位 SDO abort；无半写参数或挂死。 |
| PR-05 | PLC 启动列表使用 Single / Complete Access | 声明、ESI 与实际一致；不支持项按约定报错或主站回退，保存失败对象及原始字节。 |
| PR-06 | 切换已支持 PDO 模板、重启与重复下载 | 长度、顺序、符号、大小端和映射保持一致；动态映射仅在声明支持时测试。 |
| PR-07 | 支持的运动模式互切，含使能状态限制 | 6060 请求与 6061 显示一致；按当前模式解释状态位，不接受未就绪模式的旧命令。 |
| PR-08 | 最小/典型/最大声明周期及 DC 配置边界 | 同步锁定、误差和轨迹达到承诺；不支持周期能定位拒绝原因，记录配置与同步诊断。 |
| PR-09 | 主站计算超时，但 EtherCAT 仍发送旧目标 | 检查应用侧陈旧命令检测及停机策略；证明仅靠 WKC/watchdog 是否足够，明确责任边界。 |
| PR-10 | 断链、间歇接触、受控损坏帧 | WKC、链路/端口计数、AL 错误与驱动反应关联；测检测至停机过程，保留抓包。 |
| PR-11 | PLC RUN→STOP、重启、工程重新激活 | 分别记录实际 PDO 是否继续、输出替代值、轴反应；不能把三种操作等同拔线。 |
| PR-12 | 分别丢失控制电、动力电，再恢复 | 编码器/参数/报警保持按声明执行；轴和下游设备影响可解释，恢复电源不自动续跑。 |
| PR-13 | CSP 首次使能、重新使能、网络恢复 | PLC 从有效反馈建立接管目标，验证偏置/比例后的同坐标值；无旧目标导致的位置跳变。 |
| PR-14 | 增量、单圈/多圈绝对编码器重启 | 首/中/末位置及断电移动后坐标准确；位置失效能告知 PLC，按约定回零或恢复。 |
| PR-15 | 反馈/目标跨符号边界、计数溢出与模数零点 | 按声明位宽双向测试；机器坐标、速度计算和跟随误差连续，PLC/驱动回绕语义一致。 |
| PR-16 | 故障仍存在时反复复位，再消除故障复位 | 原因未解除不可假恢复；复位不等于重启运动；记录首次原因与后续派生报警。 |
| PR-17 | 故障后断电、网络重连、再次报警 | 当前错误、历史/EMCY（若支持）及厂商记录对应；明确哪些信息易失、保存深度及读取方法。 |
| PR-18 | PLC 启动参数与本地保存参数冲突 | 优先级和生效时机明确；冷启动重复一致；备份可证明客户实际运行参数。 |
| PR-19 | 同型号备件及声明兼容的修订替换 | 身份、ESI、参数、电机/编码器数据可恢复；不兼容替件清晰拒绝，零点/轴绑定不串位。 |
| PR-20 | 已支持的升级方式，含传输中断 | 校验版本与恢复入口；参数迁移和升级后身份/PDO 回归可重复；FoE/BOOT 仅按声明测试。 |
| PR-21 | Touch Probe 已声明功能 | 测输入源、正负边沿、重装载、连续/单次及运动中锁存；不支持的通道/位明确标注。 |
| PR-22 | 硬接线 STO 或选配 FSoE 的触发与恢复 | 分别验证安全功能链与普通控制链；通讯恢复不代表安全复位或运动授权，依据专用安全手册。 |
| PR-23 | 售后人员仅获得客户故障包 | 独立复现并区分接线、主站、配置、驱动故障；验证包内含时间线、版本、原始码和复位前信息。 |

## 可选项及待确认问题

FoE 是文件访问/固件传输机制；是否支持 BOOT、升级恢复及参数迁移须另行声明。[ETG FoE 介绍](https://www.ethercat.org/en/technology.html) Touch Probe 是否支持双通道、时间戳、连续锁存取决于实现，例如 Synapticon 此文仅支持 Probe 1。[官方实现范围](https://doc.synapticon.com/actilink_s/sw5.6/encoders_and_io/touch_probe.htm?TocPath=Device+Information%7CTouch+Probe+Functionality+Specification%7C_____0)

STO 是安全转矩关闭功能，FSoE 是传输安全数据的通信协议；有 STO 不等于支持 FSoE，普通 CiA 402 停止/故障复位也不能替代安全链验收。[ETG FSoE 介绍](https://www.ethercat.org/en/technology.html)、[Omron 1S 配置说明](https://store.omron.com.au/knowledge-base/how-to-configure-fsoe-on-1s-servo)

尚未知：本机支持模式与周期、PDO/Complete Access 能力、通讯丢失反应、编码器与位宽、抱闸/垂直轴需求、位置保持机制、报警保存、升级恢复入口、客户 PLC 与安全功能范围。应先填能力矩阵，再决定候选项适用性；不支持的选配项记录为 N/A 并说明原因。
