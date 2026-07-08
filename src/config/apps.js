// apps config for portal sidebar footer menu
export const APPS = [
  {
    name: 'WDG Dashboard',
    url: '/admin',
    icon: '📊',
    description: '数据总览与用户管理',
  },
  {
    name: 'Agent Chat',
    url: '/chat',
    current: true,
    icon: '💬',
    description: 'AI 对话助手',
  },
  {
    name: 'Deploy 管理',
    url: 'https://github.com/wdg-data-platform/deploy',
    icon: '⚙️',
    description: '系统部署配置',
  },
] as const