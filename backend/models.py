from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base

class Institution(Base):
    __tablename__ = "institutions"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    status = Column(String, default="APPROVED", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class SigningKey(Base):
    __tablename__ = "signing_keys"
    id = Column(String, primary_key=True)
    institution_id = Column(String, ForeignKey("institutions.id"), nullable=False)
    public_key = Column(Text, nullable=False)
    status = Column(String, default="ACTIVE", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Document(Base):
    __tablename__ = "documents"
    id = Column(String, primary_key=True)
    issuer_id = Column(String, ForeignKey("institutions.id"), nullable=False)
    key_id = Column(String, ForeignKey("signing_keys.id"), nullable=False)
    file_hash = Column(String(64), nullable=False)
    document_type = Column(String, nullable=False)
    issued_at = Column(String, nullable=False)
    manifest_json = Column(Text, nullable=False)
    signature = Column(Text, nullable=False)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(String, primary_key=True)
    event = Column(String, nullable=False)
    document_id = Column(String, nullable=True)
    result = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
