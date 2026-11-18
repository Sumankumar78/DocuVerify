from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pathlib import Path
from datetime import datetime, timezone
import uuid, json, qrcode, io, base64

from database import Base, engine, get_db, SessionLocal
from models import Institution, SigningKey, Document, AuditLog
from crypto_utils import sha256, generate_keypair, sign, verify_signature

app = FastAPI(title="DocuVerify API", version="1.0.0",
              description="Hackathon prototype for cross-institution document integrity verification.")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
Base.metadata.create_all(bind=engine)

KEY_DIR = Path(__file__).parent / "keys"
KEY_DIR.mkdir(exist_ok=True)
MAX_FILE_BYTES = 12 * 1024 * 1024

def seed():
    db = SessionLocal()
    try:
        for iid, name in [("INST-ABC", "ABC University"), ("INST-XYZ", "XYZ College")]:
            inst = db.get(Institution, iid)
            if not inst:
                db.add(Institution(id=iid, name=name, status="APPROVED"))
                db.flush()
            kid = f"KEY-{iid}"
            if not db.get(SigningKey, kid):
                private_path = KEY_DIR / f"{iid}.pem"
                if private_path.exists():
                    private_pem = private_path.read_bytes()
                    from cryptography.hazmat.primitives import serialization
                    private = serialization.load_pem_private_key(private_pem, password=None)
                    from cryptography.hazmat.primitives import serialization as ser
                    public_pem = private.public_key().public_bytes(
                        encoding=ser.Encoding.PEM, format=ser.PublicFormat.SubjectPublicKeyInfo).decode()
                else:
                    private_pem, public_pem_bytes = generate_keypair()
                    private_path.write_bytes(private_pem)
                    try: private_path.chmod(0o600)
                    except Exception: pass
                    public_pem = public_pem_bytes.decode()
                db.add(SigningKey(id=kid, institution_id=iid, public_key=public_pem, status="ACTIVE"))
        db.commit()
    finally:
        db.close()

seed()

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "DocuVerify"}

@app.get("/api/institutions")
def institutions(db: Session = Depends(get_db)):
    rows = db.query(Institution).order_by(Institution.name).all()
    result = []
    for row in rows:
        keys = db.query(SigningKey).filter(SigningKey.institution_id == row.id).all()
        result.append({"id": row.id, "name": row.name, "status": row.status,
                       "keys": [{"id": k.id, "status": k.status} for k in keys]})
    return result

@app.get("/api/documents")
def documents(db: Session = Depends(get_db)):
    rows = db.query(Document).order_by(desc(Document.issued_at)).limit(100).all()
    return [{"id": d.id, "issuer_id": d.issuer_id, "document_type": d.document_type,
             "issued_at": d.issued_at, "file_hash": d.file_hash} for d in rows]

@app.post("/api/register")
async def register_document(
    issuer_id: str = Form(...),
    document_type: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    inst = db.get(Institution, issuer_id)
    if not inst or inst.status != "APPROVED":
        raise HTTPException(400, "Issuer is not an approved institution.")
    key = db.query(SigningKey).filter_by(institution_id=issuer_id, status="ACTIVE").first()
    if not key:
        raise HTTPException(400, "No active signing key for this institution.")
    content = await file.read(MAX_FILE_BYTES + 1)
    if not content:
        raise HTTPException(400, "Please upload a non-empty file.")
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(413, "File exceeds the 12 MB demo limit.")
    private_path = KEY_DIR / f"{issuer_id}.pem"
    if not private_path.exists():
        raise HTTPException(500, "Issuer signing key is missing on this server.")
    document_id = "DV-" + uuid.uuid4().hex[:10].upper()
    issued_at = datetime.now(timezone.utc).isoformat()
    manifest = {
        "document_id": document_id,
        "issuer_id": issuer_id,
        "document_type": document_type.strip()[:80],
        "file_hash": sha256(content),
        "issued_at": issued_at,
        "key_id": key.id,
    }
    signature = sign(private_path.read_bytes(), manifest)
    doc = Document(id=document_id, issuer_id=issuer_id, key_id=key.id,
                   file_hash=manifest["file_hash"], document_type=manifest["document_type"],
                   issued_at=issued_at, manifest_json=json.dumps(manifest, sort_keys=True),
                   signature=signature)
    db.add(doc)
    db.add(AuditLog(id=uuid.uuid4().hex, event="REGISTER", document_id=document_id, result="ISSUED"))
    db.commit()
    verify_url = f"http://localhost:5173/?verify={document_id}"
    qr = qrcode.make(verify_url)
    buf = io.BytesIO()
    qr.save(buf, format="PNG")
    qr_data = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    return {"document_id": document_id, "issuer": inst.name, "document_type": manifest["document_type"],
            "file_hash": manifest["file_hash"], "issued_at": issued_at, "signature": signature,
            "qr_code": qr_data, "verification_url": verify_url}

@app.post("/api/verify")
async def verify_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read(MAX_FILE_BYTES + 1)
    if not content:
        raise HTTPException(400, "Please upload a non-empty file.")
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(413, "File exceeds the 12 MB demo limit.")
    digest = sha256(content)
    doc = db.query(Document).filter_by(file_hash=digest).first()
    if not doc:
        db.add(AuditLog(id=uuid.uuid4().hex, event="VERIFY", result="UNREGISTERED"))
        db.commit()
        return {"status": "UNREGISTERED", "authentic": False,
                "message": "No issued document record matches this exact file."}
    inst = db.get(Institution, doc.issuer_id)
    key = db.get(SigningKey, doc.key_id)
    manifest = json.loads(doc.manifest_json)
    sig_ok = bool(key and verify_signature(key.public_key, manifest, doc.signature))
    if not inst or inst.status != "APPROVED":
        status, message = "UNTRUSTED_ISSUER", "The issuing institution is not currently approved."
    elif not key or key.status != "ACTIVE":
        status, message = "REVOKED_KEY", "The signing key is revoked or unavailable. Treat this record as requiring review."
    elif not sig_ok:
        status, message = "INVALID_SIGNATURE", "The stored manifest signature could not be validated."
    else:
        status, message = "AUTHENTIC", "The file hash and issuer signature both match the registered record."
    db.add(AuditLog(id=uuid.uuid4().hex, event="VERIFY", document_id=doc.id, result=status))
    db.commit()
    return {"status": status, "authentic": status == "AUTHENTIC", "message": message,
            "document_id": doc.id, "issuer": inst.name if inst else doc.issuer_id,
            "document_type": doc.document_type, "issued_at": doc.issued_at,
            "file_hash": digest, "signature_valid": sig_ok, "key_status": key.status if key else "MISSING"}

@app.get("/api/verify/{document_id}")
def verify_by_id(document_id: str, db: Session = Depends(get_db)):
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "Document record not found.")
    inst = db.get(Institution, doc.issuer_id)
    key = db.get(SigningKey, doc.key_id)
    manifest = json.loads(doc.manifest_json)
    sig_ok = bool(key and verify_signature(key.public_key, manifest, doc.signature))
    return {"document_id": doc.id, "issuer": inst.name if inst else doc.issuer_id,
            "document_type": doc.document_type, "issued_at": doc.issued_at,
            "file_hash": doc.file_hash, "signature_valid": sig_ok,
            "key_status": key.status if key else "MISSING",
            "issuer_status": inst.status if inst else "UNKNOWN"}

@app.post("/api/keys/{key_id}/revoke")
def revoke_key(key_id: str, db: Session = Depends(get_db)):
    key = db.get(SigningKey, key_id)
    if not key:
        raise HTTPException(404, "Key not found.")
    key.status = "REVOKED"
    db.add(AuditLog(id=uuid.uuid4().hex, event="REVOKE_KEY", result=key_id))
    db.commit()
    return {"key_id": key_id, "status": key.status}

@app.get("/api/audit")
def audit(db: Session = Depends(get_db)):
    rows = db.query(AuditLog).order_by(desc(AuditLog.created_at)).limit(100).all()
    return [{"id": x.id, "event": x.event, "document_id": x.document_id,
             "result": x.result, "created_at": x.created_at.isoformat() if x.created_at else None} for x in rows]
