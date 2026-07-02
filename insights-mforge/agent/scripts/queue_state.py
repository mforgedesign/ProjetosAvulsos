#!/usr/bin/env python3
"""Fila SQLite transacional para Radar Comercial MForge."""
from __future__ import annotations
import argparse, datetime as dt, hashlib, json, pathlib, re, sqlite3

DB_DEFAULT = "/opt/mforge-insights/state/queue.sqlite3"
CLIENT_TERMS = ("convite", "orçamento", "orcamento", "modelo", "festa", "aniversário", "aniversario", "casamento", "15 anos", "save the date", "valor", "rsvp", "confirmação", "confirmacao")
SKIP_SUFFIXES = (".tmp", ".part", ".swp", ".crdownload")
BACKOFF_MINUTES = [5, 20, 60]

def now_utc():
    return dt.datetime.now(dt.timezone.utc)

def iso(value=None):
    return (value or now_utc()).isoformat()

def connect(database):
    db = sqlite3.connect(database, timeout=30)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("""
        CREATE TABLE IF NOT EXISTS conversations(
          source_path TEXT PRIMARY KEY,
          conversation_key TEXT NOT NULL,
          source_hash TEXT NOT NULL,
          phone_e164 TEXT,
          first_message_at TEXT,
          last_message_at TEXT,
          priority INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'pending',
          attempts INTEGER NOT NULL DEFAULT 0,
          claimed_at TEXT,
          next_attempt_at TEXT,
          analyzed_hash TEXT,
          analysis_path TEXT,
          classification TEXT,
          last_error TEXT,
          last_model TEXT,
          updated_at TEXT NOT NULL
        )
    """)
    db.execute("""
        CREATE TABLE IF NOT EXISTS attempt_log(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source_path TEXT NOT NULL,
          source_hash TEXT NOT NULL,
          attempt INTEGER NOT NULL,
          model TEXT NOT NULL,
          status TEXT NOT NULL,
          error TEXT,
          created_at TEXT NOT NULL
        )
    """)
    return db

def read_text(path):
    return pathlib.Path(path).read_text(encoding="utf-8", errors="replace")

def file_meta(filename):
    path = pathlib.Path(filename)
    text = read_text(path)
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    # Only trust exported WhatsApp message headings, never dates mentioned inside message bodies.
    # Expected heading: ## 2026-05-29T13:44:30.000Z — Contact
    raw_timestamps = re.findall(r"^##\s+(20\d{2}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?|[ T]\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})?))\b", text, re.M)
    timestamps = []
    for value in raw_timestamps:
        try:
            date_part = value[:10]
            year, month, day = map(int, date_part.split("-"))
            if 1 <= month <= 12 and 1 <= day <= 31:
                timestamps.append(value)
        except Exception:
            continue
    phone = None
    for pattern in [r"Telefone E\.164:\s*`?(\+\d{12,15})`?", r"\b(\+55\d{10,11})\b", r"\b(55\d{10,11})\b"]:
        match = re.search(pattern, text)
        if match:
            raw = match.group(1)
            phone = raw if raw.startswith("+") else "+" + raw
            break
    if not phone:
        heading = re.search(r"^#\s*([^\n]+)", text, re.M)
        digits = re.sub(r"\D", "", heading.group(1) if heading else path.stem)
        if len(digits) in (10, 11):
            digits = "55" + digits
        if 12 <= len(digits) <= 15:
            phone = "+" + digits
    lower = text.lower()
    priority = 100 if any(term in lower for term in CLIENT_TERMS) else 0
    return {
        "conversation_key": hashlib.sha256(str(path.resolve()).encode()).hexdigest()[:16],
        "source_hash": digest,
        "phone_e164": phone,
        "first_message_at": min(timestamps) if timestamps else None,
        "last_message_at": max(timestamps) if timestamps else None,
        "priority": priority,
    }

def scan(args):
    count = 0
    conversations = pathlib.Path(args.conversations)
    with connect(args.database) as db:
        for path in sorted(conversations.rglob("*")):
            if not path.is_file() or path.name.startswith(".") or path.suffix.lower() not in (".md", ".txt", ".json") or any(str(path).endswith(s) for s in SKIP_SUFFIXES):
                continue
            meta = file_meta(path)
            if args.since and meta["last_message_at"] and meta["last_message_at"][:10] < args.since:
                continue
            row = db.execute("SELECT source_hash, analyzed_hash, status, attempts FROM conversations WHERE source_path=?", (str(path),)).fetchone()
            if row and row["source_hash"] == meta["source_hash"]:
                status, attempts = row["status"], row["attempts"]
            elif row and row["analyzed_hash"] == meta["source_hash"]:
                status, attempts = "analyzed", row["attempts"]
            else:
                status, attempts = "pending", 0
            db.execute("""
                INSERT INTO conversations(source_path, conversation_key, source_hash, phone_e164, first_message_at, last_message_at, priority, status, attempts, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(source_path) DO UPDATE SET
                  conversation_key=excluded.conversation_key,
                  source_hash=excluded.source_hash,
                  phone_e164=excluded.phone_e164,
                  first_message_at=excluded.first_message_at,
                  last_message_at=excluded.last_message_at,
                  priority=excluded.priority,
                  status=?,
                  attempts=?,
                  updated_at=excluded.updated_at
            """, (str(path), meta["conversation_key"], meta["source_hash"], meta["phone_e164"], meta["first_message_at"], meta["last_message_at"], meta["priority"], status, attempts, iso(), status, attempts))
            count += 1
    print(json.dumps({"ok": True, "scanned": count}, ensure_ascii=False))

def claim(args):
    current = now_utc()
    stale = (current - dt.timedelta(minutes=args.stale_minutes)).isoformat()
    with connect(args.database) as db:
        db.execute("BEGIN IMMEDIATE")
        db.execute("""
            UPDATE conversations
            SET status='pending', claimed_at=NULL, next_attempt_at=NULL,
                last_error=COALESCE(last_error || '\n', '') || 'Lease expirada; devolvida à fila.', updated_at=?
            WHERE status='analyzing' AND claimed_at < ?
        """, (iso(current), stale))
        row = db.execute("""
            SELECT * FROM conversations
            WHERE status IN ('pending','failed')
              AND attempts < ?
              AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
            ORDER BY priority DESC, COALESCE(last_message_at,'') DESC, source_path
            LIMIT 1
        """, (args.max_attempts, iso(current))).fetchone()
        if not row:
            print("{}")
            return
        db.execute("UPDATE conversations SET status='analyzing', claimed_at=?, attempts=attempts+1, updated_at=? WHERE source_path=?", (iso(current), iso(current), row["source_path"]))
        output = dict(row)
        output["claimed_at"] = iso(current)
        output["attempts"] = row["attempts"] + 1
        print(json.dumps(output, ensure_ascii=False))

def log_attempt(db, args, status, error=""):
    db.execute("INSERT INTO attempt_log(source_path, source_hash, attempt, model, status, error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", (args.source, args.source_hash, args.attempt, args.model, status, error[:2000], iso()))

def complete(args):
    with connect(args.database) as db:
        row = db.execute("SELECT source_hash FROM conversations WHERE source_path=?", (args.source,)).fetchone()
        if not row:
            raise SystemExit("Conversa não encontrada")
        db.execute("""
            UPDATE conversations
            SET status='analyzed', analyzed_hash=source_hash, analysis_path=?, classification=?, claimed_at=NULL,
                next_attempt_at=NULL, last_error=NULL, last_model=?, updated_at=?
            WHERE source_path=?
        """, (args.analysis, args.classification, args.model, iso(), args.source))
        log_attempt(db, args, "complete")

def fail(args):
    minutes = BACKOFF_MINUTES[min(max(args.attempt - 1, 0), len(BACKOFF_MINUTES) - 1)] if args.attempt < args.max_attempts else None
    next_at = (now_utc() + dt.timedelta(minutes=minutes)).isoformat() if minutes else None
    status = "failed_permanent" if args.attempt >= args.max_attempts else "failed"
    with connect(args.database) as db:
        db.execute("UPDATE conversations SET status=?, claimed_at=NULL, next_attempt_at=?, last_error=?, last_model=?, updated_at=? WHERE source_path=?", (status, next_at, args.error[:2000], args.model, iso(), args.source))
        log_attempt(db, args, "fail", args.error)

def status(args):
    with connect(args.database) as db:
        rows = db.execute("SELECT status, COUNT(*) count FROM conversations GROUP BY status").fetchall()
        print(json.dumps({row["status"]: row["count"] for row in rows}, ensure_ascii=False))

def list_items(args):
    with connect(args.database) as db:
        rows = db.execute("SELECT source_path, status, attempts, next_attempt_at, phone_e164, last_model, last_error FROM conversations ORDER BY updated_at DESC LIMIT ?", (args.limit,)).fetchall()
        print(json.dumps([dict(row) for row in rows], ensure_ascii=False, indent=2))

parser = argparse.ArgumentParser()
parser.add_argument("--database", default=DB_DEFAULT)
sub = parser.add_subparsers(dest="command", required=True)
scan_parser = sub.add_parser("scan")
scan_parser.add_argument("--conversations", required=True)
scan_parser.add_argument("--since", default="2025-12-01")
scan_parser.set_defaults(function=scan)
claim_parser = sub.add_parser("claim")
claim_parser.add_argument("--stale-minutes", type=int, default=90)
claim_parser.add_argument("--max-attempts", type=int, default=4)
claim_parser.set_defaults(function=claim)
complete_parser = sub.add_parser("complete")
complete_parser.add_argument("--source", required=True)
complete_parser.add_argument("--source-hash", required=True)
complete_parser.add_argument("--attempt", type=int, required=True)
complete_parser.add_argument("--model", required=True)
complete_parser.add_argument("--analysis", required=True)
complete_parser.add_argument("--classification", required=True)
complete_parser.set_defaults(function=complete)
fail_parser = sub.add_parser("fail")
fail_parser.add_argument("--source", required=True)
fail_parser.add_argument("--source-hash", required=True)
fail_parser.add_argument("--attempt", type=int, required=True)
fail_parser.add_argument("--max-attempts", type=int, default=4)
fail_parser.add_argument("--model", required=True)
fail_parser.add_argument("--error", required=True)
fail_parser.set_defaults(function=fail)
status_parser = sub.add_parser("status")
status_parser.set_defaults(function=status)
log_parser = sub.add_parser("log-attempt")
log_parser.add_argument("--source", required=True)
log_parser.add_argument("--source-hash", required=True)
log_parser.add_argument("--attempt", type=int, required=True)
log_parser.add_argument("--model", required=True)
log_parser.add_argument("--status", required=True)
log_parser.add_argument("--error", default="")
def log_attempt_cmd(args):
    with connect(args.database) as db:
        log_attempt(db, args, args.status, args.error)
log_parser.set_defaults(function=log_attempt_cmd)
list_parser = sub.add_parser("list")
list_parser.add_argument("--limit", type=int, default=20)
list_parser.set_defaults(function=list_items)
args = parser.parse_args()
args.function(args)
