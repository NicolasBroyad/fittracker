import { useState } from 'react';
import { LogOut, Monitor, Moon, Sun, Watch } from 'lucide-react';
import { toast } from 'sonner';
import { api, BackendError } from '@/api';
import { useConfirmWatchPairing, useUnlinkWatch, useWatchDevicesQuery } from '@/api/hooks';
import { useAuth } from '@/app/auth';
import { sheets, useSheets } from '@/app/sheets';
import { setThemePref, useThemePref, type ThemePref } from '@/app/theme';
import { fmtRelative, toISO } from '@/lib/dates';
import { Button } from '@/ui/button';
import { ConfirmButton } from '@/ui/confirm-button';
import { Segmented } from '@/ui/controls';
import { Label, TextInput } from '@/ui/fields';
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
          <Label>Reloj Garmin</Label>
          <WatchSection open={settings} />
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

/** Vincular la app del reloj (repo fittracker-garmin): el reloj muestra un código y se escribe acá. */
function WatchSection({ open }: { open: boolean }) {
  const query = useWatchDevicesQuery(open);
  const confirm = useConfirmWatchPairing();
  const unlink = useUnlinkWatch();
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const devices = query.data ?? [];

  if (query.error instanceof BackendError && query.error.missingSchema) {
    return (
      <p className="rounded-2xl bg-surface-2 px-4 py-3.5 text-[13.5px] text-muted">
        Falta aplicar la migración del reloj en Supabase.
      </p>
    );
  }

  const submit = () => {
    if (!/^\d{6}$/.test(code)) {
      setError('El código tiene 6 números');
      return;
    }
    confirm.mutate(
      { code, name: 'Reloj Garmin' },
      {
        onSuccess: (r) => {
          if (r === 'ok') {
            setCode('');
            setAdding(false);
            toast.success('Reloj vinculado', { description: 'Ya podés empezar a entrenar desde el reloj.' });
          } else
            setError(
              r === 'too_many'
                ? 'Demasiados intentos. Probá de nuevo en una hora.'
                : 'Código incorrecto o vencido: fijate el que muestra el reloj.',
            );
        },
      },
    );
  };

  return (
    <div className="space-y-2">
      {devices.map((w) => (
        <div key={w.id} className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3">
          <Watch className="size-5 shrink-0 text-muted" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-medium">{w.name}</div>
            <div className="text-[12.5px] text-muted">
              {w.last_seen_at
                ? `Última sincronización: ${fmtRelative(toISO(new Date(w.last_seen_at)))}`
                : 'Todavía no se sincronizó'}
            </div>
          </div>
          <ConfirmButton size="sm" confirmLabel="¿Seguro?" onConfirm={() => unlink.mutate(w.id)}>
            Desvincular
          </ConfirmButton>
        </div>
      ))}

      {devices.length === 0 || adding ? (
        <div className="rounded-2xl bg-surface-2 p-3.5">
          <p className="mb-2.5 px-0.5 text-[13px] text-muted">
            Abrí FitTracker en el reloj: te muestra un código de 6 números para escribir acá.
          </p>
          <div className="flex gap-2">
            <TextInput
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                setError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Código"
              aria-label="Código del reloj"
              className="bg-surface text-center font-display text-[19px] tracking-[0.3em] tnum placeholder:tracking-normal dark:bg-surface-3"
            />
            <Button size="lg" className="shrink-0" onClick={submit} loading={confirm.isPending}>
              Vincular
            </Button>
          </div>
          {error && <p className="mt-2 px-0.5 text-[13px] font-medium text-bad">{error}</p>}
        </div>
      ) : (
        <Button variant="ghost" size="sm" block className="text-accent-ink" onClick={() => setAdding(true)}>
          Vincular otro reloj
        </Button>
      )}
    </div>
  );
}
