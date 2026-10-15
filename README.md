# Aplikasi Manajemen Proyek Gantt Chart

Aplikasi web full-stack untuk mengelola jadwal proyek: menyusun WBS, mengatur dependensi,
menghitung critical path (CPM), menaksir biaya, dan melihat diagram PERT. Semua perhitungan
jadwal ada di satu paket mesin (`shared`) yang dipakai bersama oleh server dan client, sehingga
angka di layar selalu sama dengan angka yang disimpan.

## Fitur

- **Autentikasi**: register, login, logout. Token JWT di `localStorage`, password di-hash bcrypt.
- **Proyek**: daftar dan CRUD proyek; setiap data hanya bisa diakses pemiliknya (selain pemilik → 404).
- **Gantt**: tabel tugas (WBS, durasi, mulai, selesai, prioritas, penanggung jawab, progres) + timeline SVG
  dengan zoom Hari/Minggu/Bulan, garis hari ini, arsiran akhir pekan dan hari libur, bar progres,
  bar induk bergaya bracket, panah dependensi FS/SS, sorot jalur kritis, serta drag dan resize bar.
- **Tugas**: hierarki sampai 3 level; tugas induk menghitung rentang dan progres dari anaknya.
  Dialog tugas memuat deskripsi, warna, prioritas, progres, estimasi optimistis/pesimistis,
  editor predecessor (FS/SS + lag), dan alokasi anggota tim.
- **Penjadwalan otomatis** (recompute): setiap perubahan tugas, dependensi, durasi, atau kalender
  menjadwalkan ulang semua tugas daun (topological sort) dan mengembalikan seluruh daftar tugas.
- **Kalender**: pilih hari akhir pekan dan kelola hari libur; jadwal bergeser otomatis.
- **Tim**: CRUD anggota (nama, email, peran, gaji), daftar tugas yang dialokasikan, total biaya
  per anggota, dan peringatan over-alokasi (> 100% pada hari kerja yang sama).
- **Analisis**: ringkasan proyek, tabel CPM (ES/EF/LS/LF/float/kritis), jalur kritis, diagram PERT
  yang bisa di-zoom dan di-scroll, total biaya, dan sebaran beban anggota.

## Tech stack

| Lapisan | Teknologi |
| --- | --- |
| Monorepo | npm workspaces (`shared`, `server`, `client`), TypeScript strict |
| Mesin bisnis | TypeScript murni + zod (`shared`) |
| Backend | Node.js, Express, Prisma + SQLite, bcryptjs, helmet, cors, express-rate-limit |
| Frontend | React 18, Vite, React Router, TanStack Query, react-hook-form + zod, Tailwind CSS 4 |
| Test | Vitest, Testing Library (jsdom), Supertest |

## Prasyarat

- Node.js >= 20.11 (disarankan 22) dan npm >= 10
- Tidak perlu database eksternal: SQLite membuat file `server/prisma/dev.db`

## Instalasi

```bash
npm install
cp .env.example .env      # Windows PowerShell: Copy-Item .env.example .env
npm run prisma:generate
npm run db:migrate        # membuat struktur database (server/prisma/dev.db)
npm run db:seed           # mengisi data contoh (idempoten, aman dijalankan ulang)
```

Isi `.env` (lihat `.env.example`):

| Variabel | Contoh | Keterangan |
| --- | --- | --- |
| `DATABASE_URL` | `file:./dev.db` | SQLite relatif terhadap `server/prisma` |
| `JWT_SECRET` | string acak | Wajib diisi; ganti dengan nilai acak |
| `PORT` | `3001` | Port API |

## Menjalankan

```bash
npm run dev
```

- Aplikasi: <http://localhost:5173>
- API: <http://localhost:3001/api> (cek hidup: <http://localhost:3001/api/health>)

Vite mem-proxy `/api` ke `http://localhost:3001`, jadi frontend cukup memanggil `/api/...`.

**Akun demo** (dari `npm run db:seed`):

- Email: `demo@example.com`
- Password: `Demo12345`

## Test dan build

```bash
npm run typecheck   # tsc strict untuk shared, server, dan client
npm test            # unit + integrasi (Vitest): 130 test, 19 file
npm run build       # build shared, server (tsc), client (vite)
```

Test terpisah per workspace bila perlu: `npm test -w shared`, `npm test -w server`, `npm test -w client`.
Test server memakai database SQLite terpisah di `server/prisma/tests.db` sehingga data `dev.db` tidak terganggu.

## Skrip

| Skrip | Fungsi |
| --- | --- |
| `npm run dev` | Build `shared` lalu jalankan server dan client paralel |
| `npm run build` | Build ketiga workspace |
| `npm run typecheck` | Build `shared` + typecheck semua workspace |
| `npm test` | Build `shared` + jalankan seluruh test |
| `npm run prisma:generate` | Regenerasi Prisma Client |
| `npm run db:migrate` | Terapkan migrasi Prisma |
| `npm run db:seed` | Isi data contoh (idempoten) |
| `npm run db:reset` | Reset database lalu migrasi ulang (menghapus data lokal) |

## Ringkasan API

Prefiks `/api`. Semua rute selain `/auth/register`, `/auth/login`, dan `/health` butuh
header `Authorization: Bearer <token>`. Error memakai bentuk
`{ "error": { "code": "...", "message": "...", "details": {} } }`.

| Method dan path | Fungsi |
| --- | --- |
| `GET /health` | Cek server hidup |
| `POST /auth/register`, `POST /auth/login`, `GET /auth/me` | Autentikasi |
| `GET, POST /projects` | Daftar dan buat proyek |
| `GET, PATCH, DELETE /projects/:id` | Snapshot lengkap, ubah, hapus proyek |
| `POST /projects/:id/tasks` | Buat tugas (opsional `parentId`) |
| `PATCH, DELETE /tasks/:id` | Ubah (recompute) dan hapus tugas beserta anaknya |
| `POST /tasks/:id/move` | Ubah induk dan posisi tugas |
| `POST /tasks/:id/dependencies`, `PATCH, DELETE /dependencies/:id` | Dependensi predecessor |
| `GET, POST /projects/:id/resources`, `PATCH, DELETE /resources/:id` | Anggota tim |
| `POST /tasks/:id/assignments`, `PATCH, DELETE /assignments/:id` | Alokasi anggota ke tugas |
| `PUT /projects/:id/calendar`, `POST /projects/:id/holidays`, `DELETE /holidays/:id` | Kalender |
| `GET /projects/:id/analysis` | CPM, jalur kritis, data PERT, biaya, beban anggota |

Setiap mutasi yang mengubah jadwal mengembalikan `{ "tasks": [...] }` berisi seluruh tugas terbaru.

## Aturan penjadwalan

- Tanggal diproses sebagai UTC murni; durasi dihitung dalam hari kerja (akhir pekan dan hari libur dilewati).
- `scheduledEnd = shiftWorkingDays(scheduledStart, durationDays - 1)`.
- Batas dependensi (lag dalam hari kerja): **FS** `shiftWorkingDays(pred.scheduledEnd, 1 + lag)`,
  **SS** `shiftWorkingDays(pred.scheduledStart, lag)`; `scheduledStart = nextWorkingDay(max(startDate, batas))`.
- Hanya tugas daun yang boleh punya dependensi dan assignment; siklus ditolak dengan 422 `CYCLE_DETECTED`.
- CPM dihitung dari ordinal hari kerja; kritis bila `totalFloat = 0`.
- Biaya tugas = Σ (gaji / 22) × durasi × persen alokasi; peringatan over-alokasi bila > 100% pada hari yang sama.
- Semua logika ini hanya ada di `shared` dan dipakai server maupun client (tidak diduplikasi).

## Struktur repository

```
shared/src/    mesin bisnis: tanggal, kalender, scheduler, CPM, PERT, biaya, zod schema, fixture seed
server/src/    Express: middleware, services (recompute, snapshot), routes
server/prisma/ schema, migrasi, seed
client/src/    React: pages, komponen Gantt/PERT, api hooks, hooks auth
```

## Asumsi

- Proyek dibangun di root repository ini (bukan subfolder), sesuai instruksi.
- Aplikasi diasumsikan dipakai satu pengguna per proyek (kepemilikan per `ownerId`); tidak ada
  kolaborasi multi-pengguna dalam satu proyek.
- Tidak ada fitur lupa/reset password, verifikasi email, atau refresh token; masa berlaku JWT 12 jam.
- Baseline jadwal, kalender kerja global per proyek (bukan per anggota), dan mata uang Rupiah (IDR) tanpa kurs.
- `npm run db:seed` menghapus proyek contoh milik akun demo lalu membuatnya ulang supaya tetap idempoten;
  jangan dijalankan pada database berisi data nyata.
- Pagination belum diterapkan pada daftar proyek/tugas karena skala data contoh kecil.
