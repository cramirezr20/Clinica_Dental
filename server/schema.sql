CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE IF NOT EXISTS users (
 id serial PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE,
 password_hash text NOT NULL, role text NOT NULL CHECK(role IN ('admin','reception','dentist')),
 active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS patients (
 id serial PRIMARY KEY, first_name text NOT NULL, last_name text NOT NULL,
 birth_date date NOT NULL CHECK(birth_date <= CURRENT_DATE), phone text NOT NULL,
 address text NOT NULL, email text NOT NULL, reminder_consent boolean NOT NULL DEFAULT false,
 active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS treatments (
 id serial PRIMARY KEY, name text NOT NULL, description text NOT NULL,
 price_cents integer NOT NULL CHECK(price_cents >= 0), duration_minutes integer NOT NULL CHECK(duration_minutes BETWEEN 5 AND 480),
 active boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS appointments (
 id serial PRIMARY KEY, patient_id integer NOT NULL REFERENCES patients(id),
 dentist_id integer NOT NULL REFERENCES users(id), treatment_id integer NOT NULL REFERENCES treatments(id),
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL CHECK(ends_at>starts_at),
 status text NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','confirmed','attended','cancelled','no_show')),
 cancellation_reason text, created_at timestamptz NOT NULL DEFAULT now(),
 EXCLUDE USING gist (dentist_id WITH =, tstzrange(starts_at,ends_at,'[)') WITH &&) WHERE (status IN ('scheduled','confirmed')),
 EXCLUDE USING gist (patient_id WITH =, tstzrange(starts_at,ends_at,'[)') WITH &&) WHERE (status IN ('scheduled','confirmed'))
);
CREATE TABLE IF NOT EXISTS procedures (
 id serial PRIMARY KEY, patient_id integer NOT NULL REFERENCES patients(id), dentist_id integer NOT NULL REFERENCES users(id),
 treatment_id integer NOT NULL REFERENCES treatments(id), appointment_id integer REFERENCES appointments(id),
 performed_at timestamptz NOT NULL, notes text NOT NULL, price_cents integer NOT NULL CHECK(price_cents>=0)
);
CREATE TABLE IF NOT EXISTS invoices (
 id serial PRIMARY KEY, patient_id integer NOT NULL REFERENCES patients(id),
 created_at timestamptz NOT NULL DEFAULT now(), voided boolean NOT NULL DEFAULT false, void_reason text
);
CREATE TABLE IF NOT EXISTS invoice_items (
 id serial PRIMARY KEY, invoice_id integer NOT NULL REFERENCES invoices(id),
 procedure_id integer NOT NULL REFERENCES procedures(id), description text NOT NULL,
 amount_cents integer NOT NULL CHECK(amount_cents>=0), released boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS invoice_one_active_procedure ON invoice_items(procedure_id) WHERE NOT released;
CREATE TABLE IF NOT EXISTS payments (
 id serial PRIMARY KEY, invoice_id integer NOT NULL REFERENCES invoices(id), amount_cents integer NOT NULL CHECK(amount_cents>0),
 method text NOT NULL CHECK(method IN ('cash','card','transfer')), reference text NOT NULL DEFAULT '',
 idempotency_key uuid NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(), user_id integer NOT NULL REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS notifications (
 id serial PRIMARY KEY, appointment_id integer NOT NULL REFERENCES appointments(id),
 scheduled_at timestamptz NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed','cancelled','simulated')),
 attempts integer NOT NULL DEFAULT 0, last_error text, sent_at timestamptz, body text
);
CREATE TABLE IF NOT EXISTS audit_log (
 id bigserial PRIMARY KEY, user_id integer REFERENCES users(id), action text NOT NULL,
 entity text NOT NULL, entity_id integer, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS patient_appointments ON appointments(patient_id,starts_at);
CREATE INDEX IF NOT EXISTS patient_procedures ON procedures(patient_id,performed_at);
CREATE INDEX IF NOT EXISTS due_notifications ON notifications(scheduled_at) WHERE status='pending';
