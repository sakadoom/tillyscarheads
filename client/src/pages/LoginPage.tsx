import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { loginSchema, type LoginInput } from 'shared';

import { AuthLayout } from '../components/layout/AuthLayout';
import { Button } from '../components/ui/Button';
import { Field, Input, useFieldId } from '../components/ui/Input';
import { useAuth } from '../hooks/useAuth';
import { ApiClientError } from '../lib/api';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const emailId = useFieldId('login-email');
  const passwordId = useFieldId('login-password');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login(values.email, values.password);
      navigate('/projects', { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiClientError ? error.message : 'Tidak bisa masuk. Coba lagi sebentar lagi.',
      );
    }
  });

  return (
    <AuthLayout title="Masuk" description="Lanjutkan pengelolaan jadwal proyek Anda.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {formError ? (
          <p role="alert" className="rounded-md border border-danger/30 bg-danger-bg px-3 py-2 text-body-sm text-danger">
            {formError}
          </p>
        ) : null}

        <Field label="Email" htmlFor={emailId} error={errors.email?.message} required>
          <Input
            id={emailId}
            type="email"
            autoComplete="email"
            placeholder="nama@perusahaan.com"
            invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </Field>

        <Field label="Password" htmlFor={passwordId} error={errors.password?.message} required>
          <Input
            id={passwordId}
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            invalid={Boolean(errors.password)}
            {...register('password')}
          />
        </Field>

        <Button type="submit" variant="primary" size="md" loading={isSubmitting} className="w-full">
          Masuk
        </Button>

        <p className="text-body-sm text-ink-3">
          Belum punya akun?{' '}
          <Link to="/register" className="font-medium text-brand-700 hover:underline">
            Daftar sekarang
          </Link>
        </p>

        <p className="rounded-md border border-info/30 bg-info-bg px-3 py-2 text-caption text-info">
          Akun demo: <span className="font-semibold">demo@example.com</span> · password{' '}
          <span className="font-semibold">Demo12345</span>
        </p>
      </form>
    </AuthLayout>
  );
}
