import { useRef, useState } from 'react';
import { Reorder, useDragControls } from 'motion/react';
import { GripVertical } from 'lucide-react';
import { useSaveRoutineDay } from '@/api/hooks';
import { slotLabel, type Slot } from '@/lib/training';
import { cn } from '@/ui/cn';

/**
 * Reordenar los puestos de un día desde la pantalla de Entrenamiento. Cada puesto se mueve entero,
 * con todas sus alternativas. Se guarda al soltar.
 */
export function ReorderSlots({
  routineId,
  dayOfWeek,
  dayName,
  isRest,
  slots: initial,
}: {
  routineId: string;
  dayOfWeek: number;
  dayName: string;
  isRest: boolean;
  slots: Slot[];
}) {
  const save = useSaveRoutineDay();
  const [slots, setSlots] = useState(initial);
  const last = useRef(initial.map((s) => s.orderIndex).join(','));

  function persist() {
    const sig = slots.map((s) => s.orderIndex).join(',');
    if (sig === last.current) return;
    last.current = sig;
    save.mutate({
      routineId,
      dayOfWeek,
      name: dayName,
      isRest,
      items: slots.flatMap((s, i) =>
        s.items.map((it, v) => ({
          exercise_id: it.exercise_id,
          order_index: i + 1,
          variant: v,
          sets_target: it.sets_target,
          reps_target: it.reps_target,
        })),
      ),
    });
  }

  return (
    <>
      <p className="px-1 text-center text-[12.5px] text-muted">Arrastrá desde la manija para cambiar el orden.</p>
      <Reorder.Group axis="y" values={slots} onReorder={setSlots} className="space-y-2">
        {slots.map((slot, i) => (
          <Row key={slot.items.map((it) => it.exercise_id).join('|')} slot={slot} position={i + 1} onDrop={persist} />
        ))}
      </Reorder.Group>
    </>
  );
}

function Row({ slot, position, onDrop }: { slot: Slot; position: number; onDrop: () => void }) {
  const controls = useDragControls();
  const count = slot.items.length;
  return (
    <Reorder.Item
      value={slot}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDrop}
      className="flex list-none items-center gap-3 rounded-[18px] border border-line bg-surface py-2 pr-3 pl-1 shadow-card"
      whileDrag={{ scale: 1.03, boxShadow: '0 16px 40px rgba(0,0,0,0.3)', zIndex: 20 }}
    >
      <button
        onPointerDown={(e) => controls.start(e)}
        aria-label="Mover"
        className="flex h-11 w-9 shrink-0 cursor-grab touch-none items-center justify-center text-faint active:cursor-grabbing active:text-fg"
      >
        <GripVertical className="size-5" />
      </button>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[13px] font-bold tnum">
        {position}
      </span>
      <div className="min-w-0 flex-1">
        {slot.items.map((it, v) => (
          <div
            key={it.exercise_id}
            className={cn('truncate text-[15px]', v === 0 ? 'font-semibold' : 'text-[13.5px] text-muted')}
          >
            {count > 1 && <span className="mr-1 text-faint tnum">{slotLabel(position, v, count)}</span>}
            {it.exercise.name}
          </div>
        ))}
      </div>
    </Reorder.Item>
  );
}
