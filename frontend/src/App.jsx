import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import AppLayout from './pages/AppLayout'
import ProtectedRoute from './pages/ProtectedRoute'
import DashboardPage from './features/reports/DashboardPage'
import TransactionsPage from './features/transactions/TransactionsPage'
import CategoriesPage from './features/categories/CategoriesPage'
import RecurringPage from './features/recurring/RecurringPage'
import QuarterlyPage from './features/reports/QuarterlyPage'
import NetWorthPage from './features/networth/NetWorthPage'
import SavingsGoalsPage from './features/goals/SavingsGoalsPage'
import SearchPage from './features/transactions/SearchPage'
import RangeReportPage from './features/reports/RangeReportPage'
import TagsPage from './features/tags/TagsPage'
import YearOverYearPage from './features/reports/YearOverYearPage'
import SettingsPage from './features/settings/SettingsPage'

function App() {
  const { loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-500 text-sm">Loading…</div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/recurring" element={<RecurringPage />} />
        <Route path="/quarterly" element={<QuarterlyPage />} />
        <Route path="/networth" element={<NetWorthPage />} />
        <Route path="/savings-goals" element={<SavingsGoalsPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/reports/range" element={<RangeReportPage />} />
        <Route path="/tags" element={<TagsPage />} />
        <Route path="/reports/yoy" element={<YearOverYearPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}

export default App
