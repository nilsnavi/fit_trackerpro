import { Download, LogOut, Shield } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@shared/ui/Button'
import { EmergencyContactsSection } from '@features/emergency/components'
import { DeleteAccountSection } from '@features/profile/components/DeleteAccountSection'
import { useProfile } from '@features/profile/hooks/useProfile'

export function AccountPrivacyPage() {
    const { exportData, isExporting } = useProfile()
    const logout = async () => {
        try {
            const mod = await import('@/stores/authStore')
            mod.useAuthStore.getState().clear()
        } catch {
            // The redirect still ends the session if the store cannot be loaded.
        }
        window.location.href = '/login'
    }

    return (
        <div className="space-y-6 p-4 pb-24">
            <div><h1 className="flex items-center gap-2 text-xl font-bold text-telegram-text"><Shield className="h-5 w-5 text-primary" />Аккаунт и приватность</h1><p className="mt-1 text-sm text-telegram-hint">Управляйте данными, безопасностью и доступом к аккаунту.</p></div>
            <EmergencyContactsSection />
            <section className="space-y-2 rounded-2xl bg-telegram-secondary-bg p-4">
                <h2 className="text-sm font-semibold text-telegram-text">Документы</h2>
                <Link to="/legal/privacy" className="block py-2 text-sm text-telegram-text">Политика конфиденциальности</Link>
                <Link to="/legal/consent" className="block py-2 text-sm text-telegram-text">Согласие на обработку данных о здоровье</Link>
            </section>
            <section className="space-y-3">
                <Button variant="secondary" fullWidth leftIcon={<Download className="h-5 w-5" />} onClick={() => void exportData()} isLoading={isExporting} disabled={isExporting}>Экспорт данных</Button>
                <Button variant="emergency" fullWidth leftIcon={<LogOut className="h-5 w-5" />} onClick={() => void logout()}>Выйти из аккаунта</Button>
                <DeleteAccountSection onExportData={() => void exportData()} isExporting={isExporting} />
            </section>
            <p className="text-center text-xs text-telegram-hint">FitTracker Pro v1.0.0</p>
        </div>
    )
}

export default AccountPrivacyPage
