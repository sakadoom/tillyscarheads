import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { registerSchema, type RegisterInput } from 'shared';

import { AuthLayout } from '../components/layout/AuthLayout';
import { Button } from '../components/ui/Button';
import { Field, Input, useFieldId } from '../components/ui/Input';
import { useAuth } from '../hooks/useAuth';
import { ApiClientError } from '../lib/api';

export function RegisterPage() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const nameId = useFieldId('register-name');
  const emailId = useFieldId('register-email');
  const passwordId = useFieldId('register-password');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await registerUser(values.name, values.email, values.password);
      navigate('/projects', { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiClientError
          ? error.message
          : 'Pendaftaran gagal. Coba lagi sebentar lagi.',
      );
    }
  });

  return (
    <AuthLayout
      title="Daftar akun"
      description="Buat akun untuk mulai menyusun jadwal proyek pertama Anda."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {formError ? (
          <p role="alert" className="rounded-md border border-danger/30 bg-danger-bg px-3 py-2 text-body-sm text-danger">
            {formError}
          </p>
        ) : null}

        <Field label="Nama lengkap" htmlFor={nameId} error={errors.name?.message} required>
          <Input
            id={nameId}
            autoComplete="name"
            placeholder="Nama Anda"
            invalid={Boolean(errors.name)}
            {...register('name')}
          />
        </Field>

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

        <Field
          label="Password"
          htmlFor={passwordId}
          error={errors.password?.message}
          hint="Minimal 8 karakter"
          required
        >
          <Input
            id={passwordId}
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            invalid={Boolean(errors.password)}
            {...register('password')}
          />
        </Field>

        <Button type="submit" variant="primary" size="md" loading={isSubmitting} className="w-full">
          Daftar
        </Button>

        <p className="text-body-sm text-ink-3">
          Sudah punya akun?{' '}
          <Link to="/login" className="font-medium text-brand-700 hover:underline">
            Masuk
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
