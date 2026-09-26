import { LogOut, Monitor, Moon, Sun } from 'lucide-react';
import { api } from '@/api';
import { useAuth } from '@/app/auth';
import { sheets, useSheets } from '@/app/sheets';
import { setThemePref, useThemePref, type ThemePref } from '@/app/theme';
import { Button } from '@/ui/button';
import { Segmented } from '@/ui/controls';
import { Label } from '@/ui/fields';
import { Sheet } from '@/ui/sheet';

export function SettingsSheet() {
  const { settings } = useSheets();
  const pref = useThemePref();
  const auth = useAuth();

  return (
    <Sheet open={settings} onOpenChange={(o) => !o && sheets.closeSettings()} title="Ajustes">
      <div className="space-y-6 pt-2">
        <div>
          <Label>Apariencia</Label>
          <Segmented<ThemePref>
            value={pref}
            onChange={setThemePref}
            options={[
              {
                value: 'dark',
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <Moon className="size-4" />
                    Oscuro
                  </span>
                ),
              },
              {
                value: 'light',
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <Sun className="size-4" />
                    Claro
                  </span>
                ),
              },
              {
                value: 'system',
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <Monitor className="size-4" />
                    Sistema
                  </span>
                ),
              },
            ]}
          />
        </div>

        <div>
          <Label>Cuenta</Label>
          <div className="rounded-2xl bg-surface-2 px-4 py-3.5">
            <div className="text-[13px] text-muted">Sesión iniciada como</div>
            <div className="truncate text-[15px] font-medium">{auth.status === 'signedIn' ? auth.user.email : '—'}</div>
          </div>
        </div>

        <Button
          variant="secondary"
          size="lg"
          block
          icon={<LogOut className="size-[18px]" />}
          onClick={() => {
            sheets.closeSettings();
            void api().signOut();
          }}
        >
          Cerrar sesión
        </Button>

        <p className="pb-2 text-center text-[12px] text-faint">FitTracker 2.0{api().mode === 'demo' ? ' · modo demo' : ''}</p>
      </div>
    </Sheet>
  );
}
