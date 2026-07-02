#!/usr/bin/env python3
"""Watchdog: libera lock sem heartbeat, mata somente o PID registrado e reinicia cadeia se seguro."""
from __future__ import annotations
import datetime as dt, json, os, pathlib, signal, subprocess, sys, time
BASE=pathlib.Path('/opt/mforge-insights')
LOCK=BASE/'state/worker.lock'; QUEUE=BASE/'scripts/queue_state.py'; DISPATCHER=BASE/'scripts/dispatcher.py'
LEASE_MINUTES=90

def parse_time(s):
    return dt.datetime.fromisoformat(str(s).replace('Z','+00:00'))
def run(cmd, **kw): return subprocess.run(cmd, text=True, capture_output=True, **kw)
def main():
    stale=False; data=None
    if LOCK.exists():
        try: data=json.loads(LOCK.read_text())
        except Exception: data={'invalid':True}
        hb=data.get('heartbeat_at') or data.get('started_at')
        try: stale=(dt.datetime.now(dt.timezone.utc)-parse_time(hb)) > dt.timedelta(minutes=LEASE_MINUTES)
        except Exception: stale=True
        if stale:
            pid=data.get('pid')
            if pid:
                try:
                    os.kill(int(pid), signal.SIGTERM); time.sleep(5)
                    try: os.kill(int(pid), 0); os.kill(int(pid), signal.SIGKILL)
                    except ProcessLookupError: pass
                except ProcessLookupError: pass
                except Exception as exc: print(f'kill-error: {exc}', file=sys.stderr)
            LOCK.unlink(missing_ok=True)
            if data.get('source_path'):
                run(['python3',str(QUEUE),'fail','--source',data['source_path'],'--source-hash',data.get('source_hash','unknown'),'--attempt',str(data.get('attempt',1)),'--max-attempts','4','--model',data.get('model','watchdog'),'--error','watchdog: heartbeat expirado após 90 minutos'], timeout=60)
    status=run(['python3',str(QUEUE),'status'], timeout=60)
    print(json.dumps({'ok':True,'stale_recovered':stale,'queue':status.stdout.strip()}, ensure_ascii=False))
    # Reinicia cadeia apenas se não houver lock ativo.
    if not LOCK.exists():
        subprocess.Popen(['python3',str(DISPATCHER)], stdout=open(BASE/'logs/dispatcher-watchdog.log','a'), stderr=subprocess.STDOUT)
    return 0
if __name__=='__main__': raise SystemExit(main())
