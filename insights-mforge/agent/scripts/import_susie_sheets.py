#!/usr/bin/env python3
"""Importa a jornada Susie via endpoint Apps Script sem vazar token em logs."""
from __future__ import annotations
import json, os, pathlib, sys, tempfile, time, urllib.parse, urllib.request
BASE=pathlib.Path('/opt/mforge-insights')
OUT=BASE/'state/susie_journey.json'
LAST=BASE/'state/susie_journey.last_valid.json'

def main():
    endpoint=os.getenv('SUSIE_SHEETS_ENDPOINT')
    token=os.getenv('SUSIE_SHEETS_READ_TOKEN')
    if not endpoint or not token:
        print(json.dumps({'ok':False,'reason':'missing_env','required':['SUSIE_SHEETS_ENDPOINT','SUSIE_SHEETS_READ_TOKEN']})); return 2
    url=endpoint + ('&' if '?' in endpoint else '?') + urllib.parse.urlencode({'token': token})
    last_error=''
    for attempt in range(1,4):
        try:
            req=urllib.request.Request(url, headers={'User-Agent':'mforge-insights/1.0'})
            with urllib.request.urlopen(req, timeout=30) as resp:
                raw=resp.read()
            data=json.loads(raw.decode('utf-8'))
            if data.get('ok') is not True:
                raise ValueError('payload ok != true')
            tmp=OUT.with_suffix('.tmp'); tmp.write_bytes(json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8'))
            os.replace(tmp, OUT); os.replace(OUT, LAST)
            print(json.dumps({'ok':True,'bytes':len(raw),'attempt':attempt}, ensure_ascii=False)); return 0
        except Exception as exc:
            last_error=type(exc).__name__
            time.sleep([2,5,10][attempt-1])
    print(json.dumps({'ok':False,'error':last_error,'token_logged':False,'preserved_last_valid':LAST.exists()}, ensure_ascii=False)); return 1
if __name__=='__main__': raise SystemExit(main())
