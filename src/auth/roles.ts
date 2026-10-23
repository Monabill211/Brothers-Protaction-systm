export type Role = 'owner' | 'branch_manager' | 'sales'

// الصفحة اللي كل دور بيروحلها بعد الدخول
export const ROLE_HOME: Record<Role, string> = {
  owner: '/owner',
  branch_manager: '/branch',
  sales: '/branch-sells',
}
