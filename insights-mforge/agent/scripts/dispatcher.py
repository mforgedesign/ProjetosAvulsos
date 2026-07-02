#!/usr/bin/env python3
"""Dispatcher sequencial: sincroniza fila e chama um worker por vez até esvaziar."""
from __future__ import annotations
import json, os, pathlib, subprocess, sys, time
BASE=pathlib.Path('/opt/mforge-insights')
QUEUE=BASE/'scripts/queue_state.py'
WORKER=BASE/'scripts/analyzer_worker.py'
CONSOLIDATOR=BASE/'scripts/consolidate_dashboard.py'
LOCK=BASE/'state/worker.lock'

def run(cmd, **kw): return subprocess.run(cmd, text=True, capture_output=True, **kw)
def lock_active():
    if not LOCK.exists(): return False
    try: data=json.loads(LOCK.read_text())
    except Exception: return True
    pid=data.get('pid')
    if not pid: return True
    try: os.kill(int(pid),0); return True
    except ProcessLookupError:
        LOCK.unlink(missing_ok=True); return False
    except PermissionError: return True

def main():
    scan=run(['python3',str(QUEUE),'scan','--conversations',str(BASE/'inbox/conversas'),'--since','2025-12-01'], timeout=120)
    if scan.returncode: print(scan.stderr or scan.stdout, file=sys.stderr); return scan.returncode
    processed=0
    while True:
        if lock_active():
            print(json.dumps({'ok':False,'reason':'lock_active'}, ensure_ascii=False)); return 3
        worker=run(['python3',str(WORKER),'--once'], timeout=7200)
        sys.stdout.write(worker.stdout); sys.stderr.write(worker.stderr)
        if '"claimed": false' in worker.stdout:
            break
        processed += 1
        if worker.returncode not in (0,):
            # respeita backoff; não fica martelando o mesmo item com erro.
            break
    # Consolida sempre que a cadeia esvazia ou quando houve progresso parcial.
    cons=run(['python3',str(CONSOLIDATOR)], timeout=600)
    sys.stdout.write(cons.stdout); sys.stderr.write(cons.stderr)
    print(json.dumps({'ok': True, 'processed': processed}, ensure_ascii=False))
    return 0
if __name__=='__main__': raise SystemExit(main())
