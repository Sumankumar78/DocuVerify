import React, { useEffect, useState } from 'react';
import { ShieldCheck, FileCheck2, Building2, ScanSearch, History, UploadCloud, Fingerprint, LockKeyhole, CheckCircle2, XCircle, AlertTriangle, ArrowUpRight, Copy, RefreshCw } from 'lucide-react';

const API = 'http://127.0.0.1:8000/api';
async function request(path, options={}) {
  const res = await fetch(API + path, options);
  const data = await res.json().catch(()=>({detail:'Unexpected server response'}));
  if (!res.ok) throw new Error(data.detail || 'Request failed');
  return data;
}
function shortHash(s=''){ return s.length > 24 ? `${s.slice(0,14)}…${s.slice(-8)}` : s; }
function fmt(s){ return s ? new Date(s).toLocaleString() : '—'; }

export default function App(){
  const [tab,setTab]=useState('overview');
  const [institutions,setInstitutions]=useState([]);
  const [docs,setDocs]=useState([]);
  const [audit,setAudit]=useState([]);
  const [loading,setLoading]=useState(true);
  const [toast,setToast]=useState('');
  const [issuer,setIssuer]=useState('INST-ABC');
  const [docType,setDocType]=useState('Degree Certificate');
  const [issueFile,setIssueFile]=useState(null);
  const [issued,setIssued]=useState(null);
  const [verifyFile,setVerifyFile]=useState(null);
  const [result,setResult]=useState(null);
  const [busy,setBusy]=useState(false);

  async function refresh(){
    setLoading(true);
    try{
      const [i,d,a]=await Promise.all([request('/institutions'),request('/documents'),request('/audit')]);
      setInstitutions(i);setDocs(d);setAudit(a);
    }catch(e){setToast(e.message)}finally{setLoading(false)}
  }
  useEffect(()=>{refresh();},[]);
  useEffect(()=>{const id=new URLSearchParams(location.search).get('verify');if(id){request('/verify/'+id).then(setResult).catch(e=>setToast(e.message));setTab('verify')}},[]);
  useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(''),3600);return()=>clearTimeout(t)}},[toast]);

  async function issue(e){
    e.preventDefault(); if(!issueFile)return setToast('Choose a document first.');
    setBusy(true);setIssued(null);
    try{const f=new FormData();f.append('file',issueFile);f.append('issuer_id',issuer);f.append('document_type',docType);
      const d=await request('/register',{method:'POST',body:f});setIssued(d);setToast('Document successfully issued and signed.');await refresh();
    }catch(e){setToast(e.message)}finally{setBusy(false)}
  }
  async function verify(e){
    e.preventDefault();if(!verifyFile)return setToast('Choose a file to verify.');
    setBusy(true);setResult(null);
    try{const f=new FormData();f.append('file',verifyFile);setResult(await request('/verify',{method:'POST',body:f}));await refresh()}
    catch(e){setToast(e.message)}finally{setBusy(false)}
  }
  async function revoke(id){
    if(!confirm('Revoke this signing key? Future verifications will be flagged for review.'))return;
    try{await request(`/keys/${id}/revoke`,{method:'POST'});setToast('Signing key revoked.');await refresh()}catch(e){setToast(e.message)}
  }
  const nav=[['overview','Overview',ShieldCheck],['issue','Issue document',FileCheck2],['verify','Verify document',ScanSearch],['institutions','Institutions',Building2],['audit','Audit trail',History]];
  const authentic=result?.authentic===true || result?.status==='AUTHENTIC';
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><ShieldCheck size={23}/></div><div><b>DocuVerify</b><span>TRUST NETWORK</span></div></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav>{nav.map(([id,label,Icon])=><button key={id} className={`nav-item ${tab===id?'active':''}`} onClick={()=>{setTab(id);if(id==='verify')setResult(null)}}><Icon size={18}/><span>{label}</span>{id==='verify'&&<ArrowUpRight size={14} className="nav-arrow"/>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="secure-card"><div className="secure-icon"><LockKeyhole size={16}/></div><b>Cryptographically secured</b><p>SHA-256 integrity · Ed25519 signatures</p><span className="live-dot">● Demo environment</span></div><div className="profile"><div className="avatar">DV</div><div><b>Demo administrator</b><span>Local workspace</span></div><span className="profile-dots">···</span></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <b>{nav.find(n=>n[0]===tab)?.[1]}</b></div><div className="top-actions"><span className="environment"><i/> SYSTEM OPERATIONAL</span><button className="icon-button" onClick={refresh} title="Refresh"><RefreshCw size={17}/></button><div className="avatar small">DV</div></div></header>
      <div className="content">
        {tab==='overview'&&<Overview docs={docs} institutions={institutions} audit={audit} setTab={setTab}/>}
        {tab==='issue'&&<section><PageTitle eyebrow="ISSUER WORKSPACE" title="Issue a document" subtitle="Register an official file and create a signed, independently verifiable record."/><div className="two-col"><div className="panel"><div className="panel-head"><div><h3>New document record</h3><p>Upload the exact file you want recipients to verify.</p></div><span className="step-pill">01 / ISSUE</span></div><form onSubmit={issue} className="form">
          <label>Issuing institution</label><select value={issuer} onChange={e=>setIssuer(e.target.value)}>{institutions.map(i=><option value={i.id} key={i.id}>{i.name}</option>)}</select>
          <label>Document type</label><select value={docType} onChange={e=>setDocType(e.target.value)}><option>Degree Certificate</option><option>Academic Transcript</option><option>Employment Letter</option><option>Government Record</option><option>Other Official Document</option></select>
          <label>Document file</label><label className="dropzone"><input type="file" onChange={e=>setIssueFile(e.target.files?.[0]||null)}/><UploadCloud size={25}/><b>{issueFile?issueFile.name:'Choose a file to issue'}</b><span>{issueFile?`${(issueFile.size/1024).toFixed(1)} KB · ready to upload`:'PDF, image or other file · max 12 MB'}</span></label>
          <div className="crypto-note"><Fingerprint size={18}/><span><b>Signing process</b> The file is hashed with SHA-256. The manifest is signed using the institution's Ed25519 private key.</span></div>
          <button className="primary-btn" disabled={busy}>{busy?'Issuing…':'Generate signed record'} <ArrowUpRight size={17}/></button>
        </form></div><div className="side-info"><InfoCard icon={<LockKeyhole/>} title="Your file stays yours" text="This demo stores the document fingerprint and signed manifest, not the uploaded file itself."/><InfoCard icon={<Fingerprint/>} title="Tamper-evident" text="A changed file produces a different SHA-256 fingerprint and will not match the issued record."/><InfoCard icon={<ShieldCheck/>} title="Institution-backed" text="The manifest is signed by the issuer's registered Ed25519 key."/><div className="hint-box"><b>Demo tip</b><p>Issue a sample PDF, then switch to Verify and upload the exact same file.</p></div></div></div>
          {issued&&<div className="panel success-panel"><div className="result-heading"><CheckCircle2/><div><h3>Document issued successfully</h3><p>Your signed record is now in the trust registry.</p></div></div><div className="issued-grid"><div><span>DOCUMENT ID</span><b>{issued.document_id}</b></div><div><span>ISSUER</span><b>{issued.issuer}</b></div><div><span>FILE FINGERPRINT</span><b className="mono">{shortHash(issued.file_hash)}</b></div></div><div className="qr-row">{issued.qr_code&&<img src={issued.qr_code} alt="Verification QR code"/>}<div><b>Share the verification record</b><p>Scan the QR code or share the document ID with a verifier.</p><button className="secondary-btn" onClick={()=>{navigator.clipboard?.writeText(issued.document_id);setToast('Document ID copied.')}}><Copy size={15}/> Copy document ID</button></div></div></div>}
        </section>}
        {tab==='verify'&&<section><PageTitle eyebrow="INDEPENDENT VERIFICATION" title="Verify a document" subtitle="Check whether a file matches an institution-issued record and a trusted signing key."/><div className="verify-layout"><div className="panel"><div className="panel-head"><div><h3>Document authenticity check</h3><p>Upload the original file received from the issuer.</p></div><span className="step-pill">02 / VERIFY</span></div><form className="form" onSubmit={verify}><label>Document file</label><label className="dropzone verify-drop"><input type="file" onChange={e=>{setVerifyFile(e.target.files?.[0]||null);setResult(null)}}/><ScanSearch size={28}/><b>{verifyFile?verifyFile.name:'Drop your document here'}</b><span>{verifyFile?`${(verifyFile.size/1024).toFixed(1)} KB · ready to verify`:'or browse files · max 12 MB'}</span></label><button className="primary-btn" disabled={busy}>{busy?'Verifying…':'Verify authenticity'} <ArrowUpRight size={17}/></button></form><div className="verify-steps"><span><i>1</i> Fingerprint comparison</span><span><i>2</i> Signature validation</span><span><i>3</i> Issuer & key status</span></div></div><div className="side-info"><InfoCard icon={<Fingerprint/>} title="Integrity check" text="SHA-256 compares the exact uploaded bytes against the issued record."/><InfoCard icon={<ShieldCheck/>} title="Issuer validation" text="Ed25519 verifies that the trusted institution key signed the manifest."/><div className="hint-box"><b>What does a pass mean?</b><p>The file matches a registered record and its issuer signature and key status pass this prototype's checks.</p></div></div></div>
          {result&&<div className={`panel result-panel ${authentic?'result-good':'result-bad'}`}><div className="result-heading">{authentic ? <CheckCircle2/> : result.status === 'UNREGISTERED' ? <AlertTriangle/> : <XCircle/>}<div><span className="eyebrow">VERIFICATION RESULT</span><h2>{authentic?'Document is authentic':result.status==='UNREGISTERED'?'No matching record found':'Verification requires attention'}</h2><p>{result.message||'Record information retrieved.'}</p></div><span className={`status-chip ${authentic?'good':'bad'}`}>{result.status||'RECORD'}</span></div>{result.document_id&&<div className="result-details"><div><span>ISSUER</span><b>{result.issuer||'—'}</b></div><div><span>DOCUMENT TYPE</span><b>{result.document_type||'—'}</b></div><div><span>ISSUED</span><b>{fmt(result.issued_at)}</b></div><div><span>SIGNATURE</span><b>{result.signature_valid?'Valid':'Not validated'}</b></div><div><span>KEY STATUS</span><b>{result.key_status||'—'}</b></div><div><span>DOCUMENT ID</span><b>{result.document_id}</b></div></div>}</div>}
        </section>}
        {tab==='institutions'&&<section><PageTitle eyebrow="TRUST REGISTRY" title="Institutions" subtitle="Organizations represented in the DocuVerify demo trust network."/><div className="stat-grid"><Stat label="REGISTERED INSTITUTIONS" value={institutions.length} icon={<Building2/>}/><Stat label="ACTIVE SIGNING KEYS" value={institutions.reduce((n,i)=>n+i.keys.filter(k=>k.status==='ACTIVE').length,0)} icon={<LockKeyhole/>}/><Stat label="ISSUED RECORDS" value={docs.length} icon={<FileCheck2/>}/></div><div className="panel table-panel"><div className="panel-head"><div><h3>Institution directory</h3><p>Each institution has its own signing identity.</p></div><span className="status-chip good">REGISTRY ONLINE</span></div><div className="table-wrap"><table><thead><tr><th>INSTITUTION</th><th>INSTITUTION ID</th><th>STATUS</th><th>SIGNING KEY</th><th>ACTION</th></tr></thead><tbody>{institutions.map(i=><tr key={i.id}><td><div className="institution-cell"><div className="institution-icon"><Building2 size={17}/></div><b>{i.name}</b></div></td><td className="mono muted">{i.id}</td><td><span className="status-chip good">{i.status}</span></td><td>{i.keys.map(k=><span key={k.id} className={`status-chip ${k.status==='ACTIVE'?'good':'bad'}`}>{k.status}</span>)}</td><td>{i.keys.filter(k=>k.status==='ACTIVE').map(k=><button className="text-btn danger" key={k.id} onClick={()=>revoke(k.id)}>Revoke key</button>)}</td></tr>)}</tbody></table></div></div><p className="footnote">This prototype seeds two demo institutions. Real institutional onboarding and identity proofing are outside the hackathon scope.</p></section>}
        {tab==='audit'&&<section><PageTitle eyebrow="SYSTEM ACTIVITY" title="Audit trail" subtitle="A trace of document issuance, verification attempts and key lifecycle events."/><div className="panel table-panel"><div className="panel-head"><div><h3>Recent activity</h3><p>Latest 100 events recorded by the prototype.</p></div><button className="secondary-btn" onClick={refresh}><RefreshCw size={14}/> Refresh</button></div><div className="table-wrap"><table><thead><tr><th>EVENT</th><th>DOCUMENT</th><th>RESULT</th><th>TIMESTAMP</th></tr></thead><tbody>{audit.map(a=><tr key={a.id}><td><span className="event-tag">{a.event}</span></td><td className="mono muted">{a.document_id||'—'}</td><td><span className={`status-chip ${a.result==='AUTHENTIC'||a.result==='ISSUED'?'good':'bad'}`}>{a.result||'—'}</span></td><td className="muted">{fmt(a.created_at)}</td></tr>)}{!audit.length&&<tr><td colSpan="4" className="empty">No activity yet. Issue or verify a document to get started.</td></tr>}</tbody></table></div></div></section>}
      </div>
      <footer><span>DOCUVERIFY <b>·</b> INSTITUTIONAL TRUST NETWORK</span><span>SHA-256 <b>·</b> ED25519 <b>·</b> LOCAL DEMO</span></footer>
    </main>
    {toast&&<div className="toast"><AlertTriangle size={16}/>{toast}</div>}
  </div>
}
function PageTitle({eyebrow,title,subtitle}){return <div className="page-title"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>}
function Stat({label,value,icon}){return <div className="stat-card"><div className="stat-icon">{icon}</div><span>{label}</span><b>{value}</b><small>Live demo data</small></div>}
function InfoCard({icon,title,text}){return <div className="info-card"><div className="info-icon">{icon}</div><div><b>{title}</b><p>{text}</p></div></div>}
function Overview({docs,institutions,audit,setTab}){
 const passed=audit.filter(a=>a.result==='AUTHENTIC').length;
 return <section><div className="hero"><div className="hero-copy"><span className="hero-kicker"><i/> MULTI-INSTITUTION TRUST NETWORK</span><h1>Trust every document.<br/><em>Verify every detail.</em></h1><p>Issue cryptographically signed document records and let any trusted organization independently verify authenticity — without chasing the issuer.</p><div className="hero-actions"><button className="primary-btn" onClick={()=>setTab('issue')}>Issue a document <ArrowUpRight size={17}/></button><button className="hero-link" onClick={()=>setTab('verify')}>Verify a document <ArrowUpRight size={15}/></button></div><div className="hero-proof"><span><CheckCircle2 size={15}/> SHA-256 integrity</span><span><CheckCircle2 size={15}/> Ed25519 signatures</span><span><CheckCircle2 size={15}/> Cross-institution checks</span></div></div><div className="hero-visual"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orbit-core"><ShieldCheck size={45}/></div><div className="float-card float-top"><div className="float-icon"><Fingerprint size={17}/></div><div><b>Fingerprint matched</b><span>SHA-256 verified</span></div><CheckCircle2 className="float-check" size={17}/></div><div className="float-card float-bottom"><div className="float-icon purple"><LockKeyhole size={17}/></div><div><b>Issuer signature valid</b><span>Ed25519 · trusted key</span></div><CheckCircle2 className="float-check" size={17}/></div><div className="orbit-dot dot-a"/><div className="orbit-dot dot-b"/></div></div>
 <div className="stat-grid overview-stats"><Stat label="TRUSTED INSTITUTIONS" value={institutions.length} icon={<Building2/>}/><Stat label="ISSUED DOCUMENTS" value={docs.length} icon={<FileCheck2/>}/><Stat label="SUCCESSFUL VERIFICATIONS" value={passed} icon={<ShieldCheck/>}/><Stat label="RECENT AUDIT EVENTS" value={audit.length} icon={<History/>}/></div>
 <div className="section-row"><div><h2>Get started</h2><p>Three steps to trusted document verification.</p></div><span className="live-label"><i/> LIVE WORKSPACE</span></div><div className="action-grid"><button className="action-card" onClick={()=>setTab('issue')}><div className="action-icon"><FileCheck2/></div><span className="action-number">01 / ISSUER</span><h3>Issue a document</h3><p>Create a SHA-256 fingerprint and digitally sign its manifest with the institution's key.</p><b>Open issuer portal <ArrowUpRight size={15}/></b></button><button className="action-card" onClick={()=>setTab('verify')}><div className="action-icon blue"><ScanSearch/></div><span className="action-number">02 / VERIFIER</span><h3>Verify authenticity</h3><p>Upload a received file to validate its integrity, signature and issuer trust status.</p><b>Open verifier portal <ArrowUpRight size={15}/></b></button><button className="action-card" onClick={()=>setTab('institutions')}><div className="action-icon purple"><Building2/></div><span className="action-number">03 / TRUST</span><h3>Manage institutions</h3><p>Review participating institutions and inspect signing-key status and revocation.</p><b>View trust registry <ArrowUpRight size={15}/></b></button></div>
 <div className="bottom-note"><div className="note-icon"><ShieldCheck size={19}/></div><div><b>Built on verifiable cryptography</b><p>Hashes detect file changes. Digital signatures connect a document manifest to an institution's registered public key.</p></div><span>PROTOTYPE</span></div>
 </section>
}
