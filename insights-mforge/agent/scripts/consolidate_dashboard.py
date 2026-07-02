#!/usr/bin/env python3
"""Consolida análises em dashboard.json, criptografa e publica somente envelope cifrado."""
from __future__ import annotations
import datetime as dt, json, os, pathlib, re, sqlite3, subprocess, sys
BASE=pathlib.Path('/opt/mforge-insights')
REPO=BASE/'repo/ProjetosAvulsos'
APP=REPO/'insights-mforge'
DB=BASE/'state/queue.sqlite3'
ANALYSES=BASE/'analyses'
WORK=BASE/'work/dashboard.json'
ENC=APP/'data/insights.enc.json'

def parse_frontmatter(path):
    text=path.read_text(encoding='utf-8', errors='replace')
    m=re.match(r'^---\s*\n(.*?)\n---\s*\n(.*)$', text, re.S)
    meta={}; body=text
    if m:
        body=m.group(2)
        for line in m.group(1).splitlines():
            if ':' in line:
                k,v=line.split(':',1); meta[k.strip()]=v.strip().strip('"\'')
    return meta, body

def section(body, title):
    pat=re.compile(rf'#+\s*{re.escape(title)}\s*\n(.*?)(?=\n#|\Z)', re.S|re.I)
    m=pat.search(body); return re.sub(r'\s+',' ',m.group(1)).strip()[:480] if m else ''

def first_suggested(body):
    m=re.search(r'##\s*Mensagem sugerida\s*\n(.*?)(?=\n#|\Z)', body, re.S|re.I)
    if not m: return ''
    return re.sub(r'\s+',' ',m.group(1)).strip().strip('"')[:260]

def queue_counts():
    if not DB.exists(): return {}
    db=sqlite3.connect(DB); db.row_factory=sqlite3.Row
    return {r['status']:r['count'] for r in db.execute('SELECT status, COUNT(*) count FROM conversations GROUP BY status')}

def load_sheets():
    p=BASE/'state/susie_journey.last_valid.json'
    if not p.exists(): return {}
    try: return json.loads(p.read_text(encoding='utf-8'))
    except Exception: return {}

def build_dashboard():
    counts=queue_counts(); total=sum(counts.values())
    analyzed=counts.get('analyzed',0)
    conversations=[]; objections={}; opps=[]
    for path in sorted(ANALYSES.glob('**/*.md'), key=lambda p:p.stat().st_mtime, reverse=True):
        meta, body=parse_frontmatter(path)
        phone=meta.get('phone_e164') or 'unmatched'
        cls=meta.get('classification') or 'indeterminado'
        score=int(meta.get('lead_score') or 0) if str(meta.get('lead_score') or '').isdigit() else 0
        insight=section(body,'Síntese') or section(body,'Inferências') or 'Análise sem síntese extraída.'
        suggested=first_suggested(body)
        name='Contato ' + (phone[-4:] if phone!='unmatched' else meta.get('conversation_key','')[:6])
        rel=''
        conversations.append({'name':name,'phoneE164':phone,'stage':cls,'score':score,'insight':insight,'suggestedMessage':suggested,'lastMessageAt':meta.get('last_source_message_at') or '', 'analysisUrl': rel})
        if score>=7: opps.append({'score':score,'title':f'Retomar {name}','detail':insight[:180]})
        if 'preço' in body.lower() or 'valor' in body.lower(): objections['Preço/valor']=objections.get('Preço/valor',0)+1
        if 'resposta automática' in body.lower(): objections['Parou na resposta automática']=objections.get('Parou na resposta automática',0)+1
        if 'prazo' in body.lower(): objections['Prazo']=objections.get('Prazo',0)+1
    data={
      'generatedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
      'period': 'Desde 2025-12-01',
      'coverage': {'analyzed': analyzed, 'eligible': total, 'complete': total>0 and analyzed==total, 'queue': counts},
      'kpis': [
        {'label':'Conversas elegíveis','value':total,'note':'fila local'},
        {'label':'Analisadas','value':analyzed,'note':f'{analyzed}/{total}' if total else 'sem conversas'},
        {'label':'Pendentes','value':counts.get('pending',0)+counts.get('failed',0),'note':'inclui backoff'},
        {'label':'Oportunidades altas','value':len([c for c in conversations if c['score']>=7]),'note':'score >= 7'}
      ],
      'funnel': [
        {'label':'Elegíveis','value':total}, {'label':'Analisadas','value':analyzed},
        {'label':'Convites','value':len(list((ANALYSES/'convites').glob('*.md')))}, {'label':'Outros','value':len(list((ANALYSES/'outros').glob('*.md')))}
      ],
      'objections': [{'label':k,'value':v} for k,v in sorted(objections.items(), key=lambda x:x[1], reverse=True)] or [{'label':'Sem padrão consolidado ainda','value':0}],
      'opportunities': sorted(opps, key=lambda x:x['score'], reverse=True)[:12],
      'conversations': conversations[:100]
    }
    return data

def validate(data):
    for key in ['generatedAt','period','coverage','kpis','funnel','objections','opportunities','conversations']:
        if key not in data: raise ValueError(f'dashboard sem {key}')
    for c in data['conversations']:
        for key in ['name','phoneE164','stage','score','insight','suggestedMessage','lastMessageAt','analysisUrl']:
            if key not in c: raise ValueError(f'conversation sem {key}')

def secret_scan():
    proc=subprocess.run(['git','diff','--cached','--name-only'], cwd=REPO, text=True, capture_output=True)
    names=proc.stdout.splitlines()
    forbidden=[n for n in names if n.endswith('.md') or (n.endswith('.json') and n != 'insights-mforge/data/insights.enc.json')]
    if forbidden: raise RuntimeError('Arquivos em texto claro staged: '+', '.join(forbidden))
    grep=subprocess.run(['git','grep','-nE','(ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{20,})','--','insights-mforge'], cwd=REPO, text=True, capture_output=True)
    if grep.returncode == 0: raise RuntimeError('Possível segredo real encontrado no repo')

def main():
    data=build_dashboard(); validate(data)
    WORK.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    if not os.getenv('DASHBOARD_PASSPHRASE'):
        print(json.dumps({'ok':False,'reason':'missing_DASHBOARD_PASSPHRASE','dashboard_json':str(WORK),'committed':False}, ensure_ascii=False)); return 2
    proc=subprocess.run(['node','insights-mforge/scripts/encrypt-dashboard.mjs',str(WORK),'insights-mforge/data/insights.enc.json'], cwd=REPO, text=True, capture_output=True, env=os.environ.copy())
    WORK.unlink(missing_ok=True)
    if proc.returncode: print(proc.stderr or proc.stdout, file=sys.stderr); return proc.returncode
    subprocess.run(['git','add','insights-mforge/data/insights.enc.json'], cwd=REPO, check=True)
    secret_scan()
    diff=subprocess.run(['git','diff','--cached','--name-only'], cwd=REPO, text=True, capture_output=True, check=True).stdout.splitlines()
    if diff:
        subprocess.run(['git','commit','-m','chore: update encrypted MForge insights'], cwd=REPO, check=True)
        push=subprocess.run(['git','push','origin','main'], cwd=REPO, text=True, capture_output=True)
        if push.returncode: print(push.stderr or push.stdout, file=sys.stderr); return push.returncode
    print(json.dumps({'ok':True,'encrypted':str(ENC),'changed':diff}, ensure_ascii=False)); return 0
if __name__=='__main__': raise SystemExit(main())
