# DocuVerify — hackathon MVP

A local multi-institution document integrity and signature-verification demo.

## Stack
- React + Vite frontend
- FastAPI backend
- SQLite + SQLAlchemy
- SHA-256 file hashing
- Ed25519 manifest signatures

## Run it

### 1. Backend
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```
API: http://127.0.0.1:8000  
Swagger: http://127.0.0.1:8000/docs

### 2. Frontend (new terminal)
```bash
cd frontend
npm install
npm run dev
```
Open the URL Vite prints (usually http://localhost:5173).

## Demo flow
1. Open the Issuer tab and select an institution.
2. Upload a PDF or other file and issue a record.
3. Open Verify and upload the exact same file — it should pass.
4. Change even one byte / upload a different file — it should fail as tampered or unregistered.
5. Open Institutions to see the demo issuer registry and key status.

## Demo institutions
Two sample institutions are seeded automatically:
- ABC University
- XYZ College

The private signing keys are generated locally into `backend/keys/` and are deliberately not stored in SQLite. This is a hackathon-only local setup. Do not deploy this configuration as-is.

## Important prototype limitations
- Demo institutions are pre-seeded; there is no real-world institutional identity proofing.
- Local private-key files are not a production key-management solution. Use a KMS/HSM and access controls in production.
- The registry/database is centralized. This is not a blockchain or fully decentralized network.
- Verification checks exact file bytes. Re-saving a PDF can change its hash even if it looks identical.
- A valid signature proves that the registered key signed the manifest; it does not prove that the document's claims are true.
