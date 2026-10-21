# WDCC 2026 · 五天见闻预览

[在线浏览 →](https://sodawater14.github.io/wdcc-2026-0929/five-days/)

9.26—9.30 的 40 张现场记录，按作者在 Figma 画板中选定的顺序排列。图片统一为 1920×1080 WebP，等比保留完整画面。结尾可进入 9.29 同济大学的 15 场报告。

静态 HTML、CSS、JavaScript，全部图片和动效依赖均位于本目录。可双击 index.html，或运行 node server.mjs 后访问 http://127.0.0.1:8795/。

动效基于 Codrops / Manoela Ilic 的 [Staggered 3D Grid Animations](https://github.com/codrops/Staggered3DGridAnimations)，相关许可见 licenses/。

## 封面与结尾交互

封面保留展馆背景，顶部中央显示“报告分享”。结尾五行文案整体居中，报告入口位于底部；桌面鼠标悬停时显示 SVG 十字线扭曲与逐字错位变色，离开结尾后停止更新。图片总览淡出和文字浮现由滚动驱动，可反向返回。系统减少动态效果时保留静态文案与链接。

交互参考 [Codrops CrosshairDistortion](https://github.com/codrops/CrosshairDistortion)，MIT 许可证见 licenses/CrosshairDistortion-LICENSE。相关资源本地加载，不增加运行时 CDN。
