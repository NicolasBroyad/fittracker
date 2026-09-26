import { useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { offlineNote } from '@/api/connectivity';
import { useDeleteWeight, useEntries, useSaveWeight } from '@/api/hooks';
import { useSticky } from '@/app/hooks';
import { sheets, useSheets } from '@/app/sheets';
import { fmtLong, fmtRelative, todayISO } from '@/lib/dates';
import { fmtNum, parseDecimal } from '@/lib/format';
import type { ISODate, WeightEntry } from '@/lib/types';
import { Button } from '@/ui/button';
import { ConfirmButton } from '@/ui/confirm-button';
import { Delta } from '@/ui/display';
import { DateField, Field, TextArea } from '@/ui/fields';
import { Sheet, SheetBody, SheetFooter } from '@/ui/sheet';

export function WeightSheet() {
  const { weight } = useSheets();
  const data = useSticky(weight);
  return (
    <Sheet
      open={!!weight}
      onOpenChange={(o) => !o && sheets.closeWeight()}
      bare
      title="Registrar peso"
      description="En ayunas, después de ir al baño"
    >
      {data && <WeightForm key={data.id} initialDate={data.date} />}
    </Sheet>
  );
}

function initialFor(date: ISODate, entries: WeightEntry[]) {
  const existing = entries.find((e) => e.date === date) ?? null;
  const before = entries.filter((e) => e.date < date);
  const ref = before.length ? before[before.length - 1] : null;
  return {
    existing,
    ref,
    weight: existing ? fmtNum(existing.weight, 1) : ref ? fmtNum(ref.weight, 1) : '',
    note: existing?.note ?? '',
  };
}

/** Repite `fn` mientras se mantiene apretado el botón (como los steppers nativos). */
function useHoldRepeat(fn: () => void) {
  const timer = useRef<number | null>(null);
  const stop = () => {
    if (timer.current != null) {
      clearTimeout(timer.current);
      clearInterval(timer.current);
      timer.current = null;
    }
  };
  return {
    onPointerDown: (e: PointerEvent) => {
      e.preventDefault();
      fn();
      stop();
      timer.current = window.setTimeout(() => {
        timer.current = window.setInterval(fn, 70);
      }, 380);
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onContextMenu: (e: MouseEvent) => e.preventDefault(),
  };
}

function WeightForm({ initialDate }: { initialDate: ISODate }) {
  const entries = useEntries();
  const save = useSaveWeight();
  const del = useDeleteWeight();
  const [date, setDate] = useState(initialDate);
  const init = initialFor(date, entries);
  const [value, setValue] = useState(init.weight);
  const [note, setNote] = useState(init.note);
  const [error, setError] = useState<string | null>(null);

  const { existing, ref } = initialFor(date, entries);
  const parsed = parseDecimal(value);

  const changeDate = (d: ISODate | null) => {
    if (!d) return;
    setDate(d);
    const next = initialFor(d, entries);
    setValue(next.weight);
    setNote(next.note);
    setError(null);
  };

  const step = (delta: number) =>
    setValue((v) => {
      const n = parseDecimal(v) ?? ref?.weight ?? 70;
      return fmtNum(Math.max(0, Math.round((n + delta) * 10) / 10), 1);
    });
  const minus = useHoldRepeat(() => step(-0.1));
  const plus = useHoldRepeat(() => step(0.1));

  function submit() {
    if (parsed == null || parsed < 20 || parsed > 400) {
      setError('Ingresá un peso válido (ej. 78,4)');
      return;
    }
    save.mutate({ date, weight: Math.round(parsed * 100) / 100, note: note.trim(), previous: existing });
    sheets.closeWeight();
    toast.success(existing ? 'Registro actualizado' : 'Peso registrado', {
      description: offlineNote() ?? `${fmtNum(parsed, 1)} kg · ${fmtLong(date)}`,
    });
  }

  return (
    <>
      <SheetBody className="space-y-5 pt-2">
        <DateField value={date} onChange={changeDate} max={todayISO()} />

        <div className="rounded-[24px] bg-surface-2 px-3 pt-5 pb-4">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Restar 0,1 kg"
              className="flex size-14 shrink-0 touch-none items-center justify-center rounded-full bg-surface text-fg shadow-sm active:scale-95 dark:bg-surface-3"
              {...minus}
            >
              <Minus className="size-6" strokeWidth={2.5} />
            </button>
            <div className="flex min-w-0 items-baseline justify-center">
              <input
                value={value}
                onChange={(e) => {
                  setValue(e.target.value.replace(/[^0-9.,]/g, ''));
                  setError(null);
                }}
                onFocus={(e) => e.currentTarget.select()}
                inputMode="decimal"
                enterKeyHint="done"
                aria-label="Peso en kg"
                placeholder="0,0"
                className="w-[5.2ch] bg-transparent text-center font-display text-[56px] leading-none font-semibold tracking-tight text-fg tnum outline-none placeholder:text-faint"
              />
              <span className="-ml-1 text-[20px] font-semibold text-muted">kg</span>
            </div>
            <button
              type="button"
              aria-label="Sumar 0,1 kg"
              className="flex size-14 shrink-0 touch-none items-center justify-center rounded-full bg-surface text-fg shadow-sm active:scale-95 dark:bg-surface-3"
              {...plus}
            >
              <Plus className="size-6" strokeWidth={2.5} />
            </button>
          </div>
          <div className="mt-3 h-5 text-center text-[13.5px] text-muted">
            {ref && parsed != null ? (
              <>
                <Delta value={parsed - ref.weight} unit="kg" /> vs {fmtRelative(ref.date)} ({fmtNum(ref.weight, 1)})
              </>
            ) : existing ? (
              'Editando un registro existente'
            ) : null}
          </div>
        </div>
        {error && <p className="-mt-2 px-1 text-[14px] font-medium text-bad">{error}</p>}

        <Field label="Nota" hint="Opcional">
          <TextArea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej. comí tarde, dormí mal…" rows={2} />
        </Field>
      </SheetBody>
      <SheetFooter>
        {existing && (
          <ConfirmButton
            size="lg"
            className="px-4"
            confirmLabel="¿Borrar?"
            onConfirm={() => {
              del.mutate(existing);
              sheets.closeWeight();
              toast('Registro borrado');
            }}
          >
            Borrar
          </ConfirmButton>
        )}
        <Button size="lg" block onClick={submit} className="flex-1">
          {existing ? 'Guardar cambios' : 'Guardar'}
        </Button>
      </SheetFooter>
    </>
  );
}
