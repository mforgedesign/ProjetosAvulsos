#!/usr/bin/env python3
"""Fila transacional e retomável para análises de conversas."""
import argparse
import datetime as dt
import hashlib
import json
import pathlib
import re
import sqlite3
import sys

CLIENT_TERMS = (
    "convite", "orçamento", "orcamento", "modelo", "festa", "aniversário",
    "aniversario", "casamento", "15 anos", "save the date", "valor"
)


def connect(database):
    connection = sqlite3.connect(database)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
          source_path TEXT PRIMARY KEY,
          source_hash TEXT NOT NULL,
          phone_e164 TEXT,
          first_message_at TEXT,
          last_message_at TEXT,
          priority INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'pending',
          attempts INTEGER NOT NULL DEFAULT 0,
          claimed_at TEXT,
          analyzed_hash TEXT,
          analysis_path TEXT,
          classification TEXT,
          last_error TEXT,
          updated_at TEXT NOT NULL
        )
    """)
    return connection


def metadata(filename):
    text = filename.read_text(encoding="utf-8", errors="replace")
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    timestamps = re.findall(r"^## (\d{4}-\d{2}-\d{2}T[^\s]+)", text, re.MULTILINE)
    phone_match = re.search(r"Telefone E\.164:\s*`(\+\d{12,15})`", text)
    heading = re.search(r"^# ([^\n]+)", text)
    heading_digits = re.sub(r"\D", "", heading.group(1) if heading else "")
    if len(heading_digits) in (10, 11):
        heading_digits = "55" + heading_digits
    heading_phone = "+" + heading_digits if 12 <= len(heading_digits) <= 15 else None
    phone = heading_phone or (phone_match.group(1) if phone_match else None)
    lower = text.lower()
    priority = 100 if any(term in lower for term in CLIENT_TERMS) else 0
    return {
        "source_hash": digest,
        "phone_e164": phone,
        "first_message_at": min(timestamps) if timestamps else None,
        "last_message_at": max(timestamps) if timestamps else None,
        "priority": priority
    }


def scan(args):
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    since = args.since
    count = 0
    with connect(args.database) as db:
        for filename in pathlib.Path(args.conversations).glob("*.md"):
            item = metadata(filename)
            if since and item["last_message_at"] and item["last_message_at"][:10] < since:
                continue
            existing = db.execute(
                "SELECT source_hash, analyzed_hash, status FROM conversations WHERE source_path=?",
                (str(filename),)
            ).fetchone()
            status = "pending"
            if existing and existing["source_hash"] == item["source_hash"]:
                status = existing["status"]
            elif existing and existing["analyzed_hash"] == item["source_hash"]:
                status = "analyzed"
            db.execute("""
              INSERT INTO conversations
                (source_path, source_hash, phone_e164, first_message_at,
                 last_message_at, priority, status, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(source_path) DO UPDATE SET
                source_hash=excluded.source_hash,
                phone_e164=excluded.phone_e164,
                first_message_at=excluded.first_message_at,
                last_message_at=excluded.last_message_at,
                priority=excluded.priority,
                status=?,
                updated_at=excluded.updated_at
            """, (
                str(filename), item["source_hash"], item["phone_e164"],
                item["first_message_at"], item["last_message_at"],
                item["priority"], status, now, status
            ))
            count += 1
    print(json.dumps({"scanned": count}, ensure_ascii=False))


def claim(args):
    now = dt.datetime.now(dt.timezone.utc)
    stale = (now - dt.timedelta(minutes=args.stale_minutes)).isoformat()
    with connect(args.database) as db:
        db.execute("BEGIN IMMEDIATE")
        db.execute("""
          UPDATE conversations SET status='pending', claimed_at=NULL,
            last_error=COALESCE(last_error || '\n', '') || 'Lease expirada; devolvida à fila.'
          WHERE status='analyzing' AND claimed_at < ?
        """, (stale,))
        row = db.execute("""
          SELECT * FROM conversations
          WHERE status IN ('pending', 'failed') AND attempts < ?
          ORDER BY priority DESC, COALESCE(last_message_at, '') DESC, source_path
          LIMIT 1
        """, (args.max_attempts,)).fetchone()
        if not row:
            print("{}")
            return
        db.execute("""
          UPDATE conversations SET status='analyzing', claimed_at=?,
            attempts=attempts+1, updated_at=? WHERE source_path=?
        """, (now.isoformat(), now.isoformat(), row["source_path"]))
        output = dict(row)
        output["claimed_at"] = now.isoformat()
        print(json.dumps(output, ensure_ascii=False))


def complete(args):
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    with connect(args.database) as db:
        row = db.execute(
            "SELECT source_hash FROM conversations WHERE source_path=?", (args.source,)
        ).fetchone()
        if not row:
            raise SystemExit("Conversa não encontrada.")
        db.execute("""
          UPDATE conversations SET status='analyzed', analyzed_hash=source_hash,
            analysis_path=?, classification=?, claimed_at=NULL, last_error=NULL,
            updated_at=? WHERE source_path=?
        """, (args.analysis, args.classification, now, args.source))


def fail(args):
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    with connect(args.database) as db:
        db.execute("""
          UPDATE conversations SET status='failed', claimed_at=NULL,
            last_error=?, updated_at=? WHERE source_path=?
        """, (args.error[:2000], now, args.source))


def status(args):
    with connect(args.database) as db:
        rows = db.execute(
            "SELECT status, COUNT(*) AS count FROM conversations GROUP BY status"
        ).fetchall()
        print(json.dumps({row["status"]: row["count"] for row in rows}, ensure_ascii=False))


parser = argparse.ArgumentParser()
parser.add_argument("--database", default="/opt/mforge-insights/state/queue.sqlite3")
subparsers = parser.add_subparsers(dest="command", required=True)
scan_parser = subparsers.add_parser("scan")
scan_parser.add_argument("--conversations", required=True)
scan_parser.add_argument("--since", default="2025-12-01")
scan_parser.set_defaults(function=scan)
claim_parser = subparsers.add_parser("claim")
claim_parser.add_argument("--stale-minutes", type=int, default=90)
claim_parser.add_argument("--max-attempts", type=int, default=4)
claim_parser.set_defaults(function=claim)
complete_parser = subparsers.add_parser("complete")
complete_parser.add_argument("--source", required=True)
complete_parser.add_argument("--analysis", required=True)
complete_parser.add_argument("--classification", required=True)
complete_parser.set_defaults(function=complete)
fail_parser = subparsers.add_parser("fail")
fail_parser.add_argument("--source", required=True)
fail_parser.add_argument("--error", required=True)
fail_parser.set_defaults(function=fail)
status_parser = subparsers.add_parser("status")
status_parser.set_defaults(function=status)
arguments = parser.parse_args()
try:
    arguments.function(arguments)
except Exception as error:
    print(json.dumps({"ok": False, "error": str(error)}, ensure_ascii=False), file=sys.stderr)
    raise
