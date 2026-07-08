<<autonomous-loop>>
# Admin Claude Style Redesign

## Meta
- name: admin-claude-redesign
- description: 重写 admin UI 到 claude 浅色风格
- phases:
  - [Design] 定义 Claude 调色板
  - [Create Components] 创建新的 admin 组件
  - [Update Pages] 更新 3 个 admin 页面
  - [Cleanup] 删除旧的玻璃风格组件

## Steps
1. Create src/components/admin/ 目录
2. 创建 6 个新组件:
   - AdminCard: 卡片组件 (bg-paper border-line
   - AdminTopBar: 顶部栏 (无)
   - AdminSideNav: 侧导航 (list of items, active state)
   - AdminModal: 弹窗
   - AdminInput: 输入框
   - AdminButton: 按钮 (primary/secondary/danger/ghost)
3. 重写 3 个 admin 页面,使用新组件和 claude 色板
4. 删除旧的 glass 组件
EW