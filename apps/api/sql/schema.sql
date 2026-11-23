CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA IF NOT EXISTS park_reports;

CREATE TABLE IF NOT EXISTS park_reports.demo_parks (
  id text PRIMARY KEY,
  name text NOT NULL,
  locality text NOT NULL,
  boundary geometry(MultiPolygon, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS demo_parks_boundary_idx
  ON park_reports.demo_parks USING gist (boundary);

CREATE SEQUENCE IF NOT EXISTS park_reports.reference_seq START WITH 1042;

CREATE TABLE IF NOT EXISTS park_reports.reports (
  reference text PRIMARY KEY DEFAULT ('DEMO-' || nextval('park_reports.reference_seq')),
  access_hash text NOT NULL UNIQUE,
  request_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  category text NOT NULL CHECK (category IN ('lighting','water','play','cleaning','paths','other')),
  description text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 500),
  location geometry(Point, 4326) NOT NULL,
  location_method text NOT NULL CHECK (location_method IN ('gps','manual')),
  accuracy_m double precision,
  detail text NOT NULL CHECK (char_length(detail) BETWEEN 3 AND 120),
  park_name text,
  locality text,
  park_source text CHECK (park_source IN ('public','snapshot')),
  risk text NOT NULL CHECK (risk IN ('yes','no','unsure')),
  email text,
  consent_version text,
  photo_jpeg bytea,
  CHECK ((email IS NULL) = (consent_version IS NULL))
);

ALTER TABLE park_reports.reports
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review','in_review','approved','in_progress','resolved','rejected')),
  ADD COLUMN IF NOT EXISTS priority text CHECK (priority IN ('critical','medium','low')),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS reports_queue_idx
  ON park_reports.reports (status, created_at DESC, reference DESC);

CREATE TABLE IF NOT EXISTS park_reports.ticket_history (
  reference text NOT NULL REFERENCES park_reports.reports (reference),
  version integer NOT NULL,
  status text NOT NULL CHECK (status IN ('pending_review','in_review','approved','in_progress','resolved','rejected')),
  priority text CHECK (priority IN ('critical','medium','low')),
  public_note text CHECK (char_length(public_note) <= 240),
  changed_at timestamptz NOT NULL,
  PRIMARY KEY (reference, version)
);
