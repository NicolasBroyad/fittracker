import { useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { api } from '@/api';
import { Button } from '@/ui/button';
import { Field, TextInput } from '@/ui/fields';
import { LogoMark } from '@/ui/Logo';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api().signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión');
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col pt-safe px-page pb-safe">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10"
      >
        <LogoMark size={64} />
        <h1 className="mt-6 text-[34px] leading-none font-bold tracking-[-0.03em]">FitTracker</h1>
        <p className="mt-2 text-[15px] text-muted">Tu peso, tus rutinas y tu progreso, todo en un lugar.</p>

        <form onSubmit={submit} className="mt-10 space-y-3.5">
          <Field label="Email">
            <TextInput
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field label="Contraseña">
            <TextInput
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-1 text-[14px] font-medium text-bad">
              {error}
            </motion.p>
          )}
          <Button type="submit" size="lg" block loading={loading} className="!mt-6">
            Ingresar
          </Button>
        </form>
      </motion.div>
      <p className="text-center text-[12px] text-faint">FitTracker 2.0</p>
    </div>
  );
}
