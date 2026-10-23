import type { ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Login from './pages/Login'
import Home from './pages/Home'
import ComingSoon from './pages/ComingSoon'
import Settings from './pages/owner/Settings'
import Finance from './pages/owner/Finance'
import Operations from './pages/owner/Operations'
import Employees from './pages/branch/Employees'
import Payroll from './pages/branch/Payroll'
import Expenses from './pages/branch/Expenses'
import Inventory from './pages/branch/Inventory'
import Attendance from './pages/branch-sells/Attendance'
import Customers from './pages/branch-sells/Customers'
import ProtectedRoute from './auth/ProtectedRoute'
import AppShell from './components/layout/AppShell'
import { ROLE_HOME, type Role } from './auth/roles'
import { NAV } from './components/layout/nav'

const ROLES: Role[] = ['owner', 'branch_manager', 'sales']

// الصفحات اللي اتعملت فعلاً. أي مسار تاني في القايمة بيظهر "تحت التطوير".
const PAGES: Record<string, ReactElement> = {
  '/owner/finance': <Finance />,
  '/owner/operations': <Operations />,
  '/branch/employees': <Employees />,
  '/branch/payroll': <Payroll />,
  '/branch/expenses': <Expenses />,
  '/branch/inventory': <Inventory />,
  '/branch-sells/attendance': <Attendance />,
  '/branch-sells/customers': <Customers />,
  '/owner/settings': <Settings />,
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />

      {ROLES.map((role) => (
        <Route key={role} element={<ProtectedRoute allow={[role]} />}>
          <Route element={<AppShell />}>
            <Route path={ROLE_HOME[role]} element={<Home />} />
            {NAV[role]
              .filter((item) => item.to !== ROLE_HOME[role])
              .map((item) => (
                <Route
                  key={item.to}
                  path={item.to}
                  element={PAGES[item.to] ?? <ComingSoon title={item.label} />}
                />
              ))}
          </Route>
        </Route>
      ))}

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
