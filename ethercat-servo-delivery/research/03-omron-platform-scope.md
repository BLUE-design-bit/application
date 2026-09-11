# Omron NJ/NX 第三方伺服交付路径与平台边界

查阅日期：2026-09-11。状态：桌面调研，尚未完成本产品实机适配。**[事实]** 表示厂商资料明示；**[建议]** 表示本项目应做的验收；**[未知]** 表示需产品规格或实测确认。

## 1. 客户路径与适配资格

**[事实]** Sysmac Studio 支持安装 ESI、编辑 EtherCAT 参数/PDO、比较合并实际网络，并把从站关联到运动轴。其公开规格列出：非管理员运行时存在不能安装 ESI 的限制。[S4]

**[建议]** 交付演练从“客户新电脑、空白工程、出厂驱动器”开始：安装软件与 ESI → 接线/设置节点 → 扫描和配置比对 → PDO 配置 → 建立 Servo Axis 并关联从站 → 单位与机械参数 → 下载 → 使能 → 单轴/联动动作 → 故障恢复 → 更换备机。每一步都应有截图、可复现工程和失败时的定位入口。

**[事实]** W505 允许导入其他厂商 ESI，但明确 ESI 版本和数据类型有支持限制；导入成功不是 Omron 对本产品运动功能的适配背书。[S1，A-3] **[未知]** 当前驱动器的 Vendor ID/Product Code/Revision、ESI 版本、CoE/PDO 实现、允许映射及固件组合均待确认。

## 2. 运动指令与对象的关键差异

**[事实]** W508 的 Servo Axis 基本 PDO 要求为输出 `6040/607A`、输入 `6041/6064`；缺基本对象报 `3460h`，缺特定指令所需对象报 `3461h`。`6060/6061` 的省略行为受 CPU 版本影响，不能照搬旧工程；涉及 CSV/CST 时应按对应指令成对配置。[S3，2-3]

**[事实]** `MC_MoveVelocity` 在驱动器位置控制模式下工作；验证 CSV 要另测 `MC_SyncMoveVelocity`。`MC_Home` 的部分回零方式需要 `60B8/60B9/60BA`，方式 11、12、14 有例外；锁存功能还受 Drive/Controller Mode、LatchID 选择影响。[S3，指令总表、2-3、MC_Home、MC_SyncMoveVelocity]

**[建议]** 建立“客户功能块 → 实际 6061 模式 → PDO → 物理输入 → 预期完成条件”的映射表。不能用 Jog 或一次定位通过替代回零、CSV、CST、电子齿轮/凸轮通过；也不能把 PLC 回零方式编号直接当成驱动器 `6098h` 方法编号。

**[事实]** W507 分别设置单位、每转指令脉冲数、每转位移、减速比、正负限位、编码器类型和回零参数；PDS 关使能后的目标状态及主回路掉电检测也有设置与版本差异。[S2，5-2、A-5] **[建议]** 用实测一圈/一个已知行程校准，检查正反向、速度单位、转矩基准、循环位置跨界及绝对位置掉电恢复。避免 PLC 与驱动器两端重复缩放。

## 3. 时钟、异常与维护

**[事实]** W505 中，NX 的参考时钟由主站提供，NJ 使用距主站最近且支持参考时钟的从站；PDO 周期关联相应任务周期。主站还存在启动等待、通信超时和 Stop/Fail-soft 等配置。[S1，3-1、5-4] **[建议]** 因此 NJ/NX 应独立留证；周期、轴数、PDO 长度、拓扑、混合 I/O 和任务负载必须成组测试，不能只发布一个“最短周期”。

**[建议]** 分开注入驱动器报警、缺主回路电、单从站断电、网线中断、PLC 重启、RUN/PROGRAM 切换；记录通信状态、轴状态、控制字/状态字、原始报警与功能块 ErrorID。恢复流程须能区分网络恢复、驱动报警清除、轴复位、重新使能和重新定原点，检查是否意外续跑。第三方诊断文本、参数备份和替换恢复是否与 Omron 原厂设备相同，均列 **[未知]**，不可默认承诺。

## 4. 候选验收项

下表均为 **[建议]**；每项最终需填“适用组合、步骤、量化阈值、结果、证据路径、负责人”。未承诺功能填 N/A 并说明依据，不能填通过。

| ID | 验收场景 | 通过证据/条件 |
|---|---|---|
| OMR-01 | 新环境安装 ESI，离线建站及在线扫描 | 软件版本与权限明确；身份/版本比对正确，Servo Axis 可关联 |
| OMR-02 | 所有发布 PDO 方案 | 轴功能关联完整；SDO 启动写入成功；必需/可选对象与数据类型一致 |
| OMR-03 | MC_Power、Jog、绝对/相对定位、MC_Stop | 状态转移、方向、位移与 Done/Busy/Error/CommandAborted 符合工程约定 |
| OMR-04 | MC_MoveVelocity、MC_SyncMoveVelocity、MC_TorqueControl | 分别留实际模式、命令/反馈波形；只测声明支持的模式 |
| OMR-05 | 回零、限位、原点占用和无触发 | 回零方式与接线匹配；成功重复性合格；失败可诊断并退出 |
| OMR-06 | TouchProbe/中断定位 | Drive/Controller Mode 分开；边沿、Latch1/2、快速重复触发和未触发超时可解释 |
| OMR-07 | 机械单位与绝对值/循环轴 | 一圈/已知行程、方向、跨零、掉电前后位置均与机械相符 |
| OMR-08 | 每种承诺周期、满轴及混合网络 | 无未解释掉站/超时/同步报警；误差与恢复时间达到预先约定阈值 |
| OMR-09 | 故障注入及复位 | 客户能从 PLC 找到故障节点与原因；有唯一恢复步骤，无意外运动 |
| OMR-10 | PLC 重启、备机替换、固件/ESI 升级 | 参数和身份检查生效；恢复结果可复现；不支持路径被明确阻止 |
| OMR-11 | 客户独立完成完整路径 | 按交付包操作成功；研发无需临时修改内部对象或接管现场工程 |

## 5. 平台承诺的边界

**[事实]** Siemens S7-1500 官方资料明确列出集成 PROFINET；Mitsubishi RJ71EC93 官方产品页明确是 EtherCAT **slave** 模块。[S5][S6] **[建议]** 平台矩阵应记录“CPU 型号/固件 + 实际 EtherCAT 主站或运动模块 + 工程软件 + 运动库/许可证 + 驱动器固件/ESI”，不能仅写“支持西门子/三菱”。若客户通过网关或独立运动控制器接入，还需单验其时序、轴指令与诊断链，不能据品牌或以太网接口推定可用。

**[未知/待用户确认]** 首批客户 PLC 的准确型号与版本、使用哪些 MC 指令和控制模式、轴数/周期/机械单位、原点与限位接线、是否绝对值编码器，以及最近一次现场故障的工程和报警；这些答案决定首批必验组合。

## 官方来源

以下均于 2026-09-11 查阅；Omron `latest` 下载内容可能变化，执行验收时应固定本地手册版本。此处仅保存研究结论与链接，不分发原厂 PDF。

- **S1** [Omron W505 — CPU Unit Built-in EtherCAT Port User's Manual](https://assets.omron.eu/downloads/latest/manual/en/w505_nj_nx-series_cpu_unit_built-in_ethercat_port_users_manual_en.pdf)，本次下载封面 **W505-E1-33**；3-1、5-4、A-3。
- **S2** [Omron W507 — CPU Unit Motion Control User's Manual](https://files.omron.eu/downloads/latest/manual/en/w507_nj_nx-series_cpu_unit_motion_control_users_manual_en.pdf?v=3)，本次下载封面 **W507-E1-29**；5-2、A-5。
- **S3** [Omron W508 — Motion Control Instructions Reference Manual](https://files.omron.eu/downloads/latest/manual/en/w508_nj_nx-series_motion_control_instructions_reference_manual_en.pdf?v=2)，本次下载封面 **W508-E1-28**；2-3（手册页 2-39～2-42）及各指令章节。
- **S4** [Omron Sysmac Studio 功能规格](https://www.omron.com.tw/products/family/3077/specification.html)，页面更新日期 2025-01-20；操作环境、EtherCAT 配置、运动控制设置。
- **S5** [Siemens SIMATIC S7-1500 官方产品说明](https://www.siemens.com/en-gb/products/simatic/s7-1500/)，通信能力及集成接口。
- **S6** [Mitsubishi Electric RJ71EC93 官方产品页](https://mitsubishi-electric-eshop.mee.com/mee/FA_IA/en/EUR/Catalogue/PLC/PLC-Modular/Network-Module/RJ71EC93/p/000000000000495273)，产品描述为 iQ-R EtherCAT slave。
