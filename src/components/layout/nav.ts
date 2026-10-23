import type { IconType } from 'react-icons'
import {
  MdAssessment,
  MdAttachMoney,
  MdBadge,
  MdEventAvailable,
  MdHome,
  MdInventory2,
  MdPayments,
  MdPersonSearch,
  MdReceiptLong,
  MdSettings,
} from 'react-icons/md'
import type { Role } from '../../auth/roles'

export type NavItem = {
  to: string
  label: string
  description: string
  icon: IconType
}

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'المناجر',
  branch_manager: 'مدير الفرع',
  sales: 'السيلز',
}

// أول عنصر في كل دور هو الرئيسية (نفس ROLE_HOME)
export const NAV: Record<Role, NavItem[]> = {
  owner: [
    { to: '/owner', label: 'الرئيسية', description: '', icon: MdHome },
    {
      to: '/owner/finance',
      label: 'الملخصات المالية',
      description: 'إيرادات ومصروفات وصافي كل فرع (يومي، أسبوعي، شهري، سنوي)',
      icon: MdAssessment,
    },
    {
      to: '/owner/operations',
      label: 'العمليات',
      description: 'كل الفواتير في الفروع: مين عمل إيه والمصروفات والصافي',
      icon: MdReceiptLong,
    },
    {
      to: '/owner/settings',
      label: 'الإعدادات',
      description: 'حسابات مدير الفرع والسيلز لكل فرع، وتغيير الباسوردات',
      icon: MdSettings,
    },
  ],
  branch_manager: [
    { to: '/branch', label: 'الرئيسية', description: '', icon: MdHome },
    {
      to: '/branch/employees',
      label: 'الموظفين والنسب',
      description: 'أسماء الموظفين واليومية، ونسب الوش والضهر والجنب',
      icon: MdBadge,
    },
    {
      to: '/branch/inventory',
      label: 'المخزون',
      description: 'إضافة ومتابعة الرولات',
      icon: MdInventory2,
    },
    {
      to: '/branch/expenses',
      label: 'المصروفات',
      description: 'تسجيل مصروف مع السبب',
      icon: MdPayments,
    },
    {
      to: '/branch/payroll',
      label: 'القبض الأسبوعي',
      description: 'PDF بقبض كل موظف بالتفاصيل',
      icon: MdReceiptLong,
    },
  ],
  sales: [
    { to: '/branch-sells', label: 'الرئيسية', description: '', icon: MdHome },
    {
      to: '/branch-sells/new-invoice',
      label: 'فاتورة جديدة',
      description: 'فاتورة العميل والفاتورة الداخلية وخصم الرول',
      icon: MdAttachMoney,
    },
    {
      to: '/branch-sells/attendance',
      label: 'الحضور والانصراف',
      description: 'تسجيل حضور وانصراف موظفي المكان',
      icon: MdEventAvailable,
    },
    {
      to: '/branch-sells/customers',
      label: 'العملاء',
      description: 'البحث بالاسم وعرض الفواتير القديمة',
      icon: MdPersonSearch,
    },
  ],
}
