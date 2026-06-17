import { ThemeProvider } from '@/components/layout/theme-provider'
import { CurrencyProvider } from '@/components/layout/currency-provider'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { MobileTabBar } from '@/components/layout/mobile-tab-bar'
import { getOrCreateTenant } from '@/lib/auth'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { tenant } = await getOrCreateTenant()

  return (
    <ThemeProvider>
      <CurrencyProvider currency={tenant.currency}>
        <div className="fb-app">
          <Sidebar />
          <div className="fb-main">
            <Topbar />
            <main className="fb-content">
              <div className="fb-content-inner">
                {children}
              </div>
            </main>
            <MobileTabBar />
          </div>
        </div>
      </CurrencyProvider>
    </ThemeProvider>
  )
}
