# CiA 402 标准资料下载

获取与核验日期：2026-09-16。PDF保存在本目录的 `downloads/`，仅在本机留存；Git同步此来源索引，不重新分发第三方标准原文。

## 已下载

| 本地文件 | 封面版本与页数 | 来源及范围 |
| --- | --- | --- |
| [CiA DSP 402 V2.0 英文原文公开副本](downloads/CiA_DSP402_v2.0_2002-07-26_EN_public-copy.pdf) | Version 2.0，26 July 2002，199页 | CiA编写的历史草案，来自Pollen Robotics公开仓库；不是厂家改写的实施手册，但也不是从CiA官网登录取得的现行版本 |
| [IEC 61800-7-201:2015 出版社预览](downloads/IEC_61800-7-201_2015_PREVIEW.pdf) | Edition 2.0，2015-11，47页 | VDE出版社公开预览，英法双语，仅含部分页面；不是412页的标准全文 |

第一份封面明确写有“This draft standard proposal is not recommended for implementation”。仅作为历史资料，不将它直接冻结为本项目当前实现或验收的规范依据。文件可以解析，末页印刷页码为199；原始PDF保持原样，未重排或翻译。

原始下载地址：

- [CiA旧版PDF公开副本](https://raw.githubusercontent.com/pollen-robotics/firmware_Poulpe/develop/docs/dsp402.pdf)
- [VDE的IEC公开预览PDF](https://www.vde-verlag.de/iec-normen/preview-pdf/info_iec61800-7-201%7Bed2.0%7Db.pdf)

## 现行资料入口与未取得内容

- [CiA官方技术文档目录](https://www.can-cia.org/cia-groups/technical-documents)：本次查到CiA 402-1 V5.0.0（2023-12-05）、402-2 V5.0.0和402-3 V5.0.0（均2024-02-06），状态为DSP，下载入口显示Login。当前未登录，未取得这些全文。
- [CiA 402系列官方说明](https://www.can-cia.org/can-knowledge/cia-402-series-canopen-device-profile-for-drives-and-motion-control)：说明该驱动配置文件与IEC 61800-7系列的关系。新版CiA与IEC版本不能直接视为逐条相同；官方目录明确402-2 V5.0.0包含尚未纳入IEC 61800-7-201:2015的差异。
- [IEC 61800-7-201:2015官方购买页](https://webstore.iec.ch/en/publication/23753)：Edition 2.0，412页，现行下载需购买相应授权。本次仅下载了出版社公开预览，没有购买或取得全文。

本次没有取得CiA或IEC受限文档的访问授权。后续获得公司已有授权版本后，应单独记录其确切版本，再核对EtherCAT实现及现有验收清单。

## 本地文件校验

| 文件 | 字节数 | SHA-256 |
| --- | --- | --- |
| CiA_DSP402_v2.0_2002-07-26_EN_public-copy.pdf | 662978 | `9f5ca1e502add8cfb0006003e4104b89a1eb52ab5bfc060b0e3d3625771725ae` |
| IEC_61800-7-201_2015_PREVIEW.pdf | 713354 | `0c1b745f3af460ea71c7c2c3575b347624893d977bc4b00e8c4700ea00aecc90` |

核验内容：PDF文件头、全部页面可解析、封面版本和日期、页数及末页、SHA-256；已渲染并查看两份封面。下载不代表已完成条款审查或实机符合性测试。
